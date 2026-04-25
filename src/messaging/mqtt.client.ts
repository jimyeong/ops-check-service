import mqtt from 'mqtt';
import type { MqttClient, IClientOptions } from 'mqtt';
import type { HumidTempReading, OutboxEvent } from '../core/db/types';
import { ingestReading } from '../services/ingestSensorReading';
import { Devices } from '../constants';
import { insertDeviceIdentifier, getDeviceIdentifier } from '../core/db/repositories/deviceIdentifiersRepo';
import { getDevice } from '../core/db/repositories/devicesRepo';

import { saveInboxMessage } from '../core/db/repositories/inboxMessagesRepo';
import crypto from "crypto";
import { insertOutboxEvent } from '../core/db/repositories/outboxEventRepo';
import type { OutboxEventInput } from '../core/db/repositories/outboxEventRepo';
import { transitionAlertStateAndEnqueue } from '../services/alertTransitionService';
import { isHumiditySustainedHigh } from '../core/db/repositories/sensorReadingRepo';
import { handleReading } from '../services/readingServices';
import { getDeviceAlertState } from '../core/db/repositories/deviceAlertStateRepo';
export type MqttSubscriberOptions = {
    url: string;
    topics: string[]
    clientId?: string;
    username?: string
    password?: string
}

export type MqttMessageHandler = (args: {
    topic: string;
    payload: unknown;
    raw: string
    receivedAt: Date;
}) => Promise<void> | void;
export function startMqttSubscriber(options: MqttSubscriberOptions, onMessage: MqttMessageHandler): { client: MqttClient; stop: () => Promise<void> } {
    const client = mqtt.connect(options.url, {
        clientId: options.clientId ?? `ops-check-service`,
        username: options.username,
        password: options.password,
        reconnectPeriod: 2000,
        clean: false,
    } as IClientOptions);
    client.on('connect', async () => {
        const topicsToSubscribe = (options.topics?.length ? options.topics : [
            `zigbee2mqtt/${Devices.TOILET_HUMID_TEMP_SENSOR}`,
            `zigbee2mqtt/${Devices.POWER_SOCKET_AIRFRYER}`
        ]);
        client.subscribe(topicsToSubscribe, { qos: 1 }, async (err, granted) => {
            if (err) {
                console.error(`Failed to subscribe to topics ${topicsToSubscribe.join(", ")}: ${err}`);
                client.emit("error", err);
                return;
            }
            try {
                console.log("subscribed", granted);
                // Ensure a device identifier exists for each concrete zigbee device topic.
                // NOTE: `connect` can fire on every reconnect, so avoid noisy logs on normal operation.
                const devicesToEnsure = [...new Set(
                    topicsToSubscribe
                        .filter((topic) => topic.startsWith('zigbee2mqtt/'))
                        .map((topic) => topic.substring('zigbee2mqtt/'.length).trim())
                        .filter((device) =>
                            device.length > 0 &&
                            !device.includes('#') &&
                            !device.includes('+') &&
                            !device.startsWith('bridge/')
                        )
                )];

                for (const deviceName of devicesToEnsure) {
                    const deviceRow = await getDevice(deviceName);
                    if (deviceRow === null) {
                        console.error(`Device not found: ${deviceName}`);
                        continue;
                    }

                    const existingIdentifier = await getDeviceIdentifier("topic_name", deviceName);
                    if (existingIdentifier !== null) continue;

                    const isDuplicated = await insertDeviceIdentifier(
                        deviceRow.id,
                        "topic_name",
                        deviceName,
                    );

                    if (!isDuplicated) {
                        console.log(`inserted device identifier: ${deviceName}`);
                    }
                }
            } catch (e) {
                console.error(`Failed to insert device identifier: ${e}`);
            }
        });
    })
    client.on("message", async (topic, message) => {

        console.log("[RAW] got message on topic:", topic);
        console.log("[RAW] payload:", message.toString());   
        // filterings
        if (!topic.startsWith('zigbee2mqtt/')) return;
        if (topic.endsWith('/bridge/state')) return;
        if (topic.endsWith('/bridge/info')) return;
        if (topic.endsWith('/bridge/devices')) return;
        const device = topic.substring('zigbee2mqtt/'.length).trim();
        if (device !== Devices.TOILET_HUMID_TEMP_SENSOR && device !== Devices.POWER_SOCKET_AIRFRYER) return;
        console.log(`[mqtt] message: ${message.toString()}`);
        // build idempotency key
        const msg = message.toString("utf-8");
        const idempotency_key = crypto.createHash('sha256').update(topic + ":" + msg).digest('hex');
        try {

            // Lookup by device name (matches the inserted id_value).
            const identifier = await getDeviceIdentifier("topic_name", device);
            if (identifier === null) {
                console.error(`Device identifier not found, IGNORE the message, topic: ${topic}`);
                return;
            }
            const device_id = identifier.device_id;

            const payload: HumidTempReading = JSON.parse(msg) as HumidTempReading;
            const receivedAt = new Date();
            const reading: HumidTempReading = {
                idempotency_key: idempotency_key,
                device_id: device_id,
                temperature: payload.temperature,
                humidity: payload.humidity,
                battery: payload.battery,
                linkquality: payload.linkquality ?? 0,
                receivedAt: receivedAt,
                comfort_humidity_min: payload.comfort_humidity_min,
                comfort_temperature_max: payload.comfort_temperature_max,
                comfort_humidity_max: payload.comfort_humidity_max,
                comfort_temperature_min: payload.comfort_temperature_min,
                humidity_calibration: payload.humidity_calibration,
                temperature_calibration: payload.temperature_calibration,
                temperature_units: payload.temperature_units,
                update: payload.update,
            }
            const outboxEvent: OutboxEventInput = {
                event_type: topic,
                payload: JSON.parse(msg),
                idempotency_key: idempotency_key,
                attempts: 0,
            };

            // ingest the reading, transition the alert state
            await handleReading(reading, device_id, idempotency_key, {
                isHumiditySustainedHigh,
                ingestReading,
                transitionAlertStateAndEnqueue,
            })
            // TODO save the message in the inbox table
            await onMessage({ topic, payload: reading, raw: msg, receivedAt: receivedAt });
            // console.log(`[mqtt] received reading: ${JSON.stringify(reading)}`);

        } catch (e) {
            let jsonPayload: unknown;
            try { jsonPayload = JSON.parse(msg); } catch (e) {
                console.error(`[mqtt] failed to parse message: ${e}`);
                jsonPayload = { raw: msg };
            }
            try {
                const duplicated = await saveInboxMessage(jsonPayload, idempotency_key);
                if (duplicated) console.log("duplicated inbox message");
            } catch (e) {
                console.error(`[mqtt] failed to save inbox message: ${e}`);
            }
        }
    });
    client.on("error", (err) => {
        console.error(`[MQTT] error: `, err);
    });

    async function stop() {
        return new Promise<void>((resolve) => {
            client.end(true, {}, () => resolve())
        })
    }
    return { client, stop };
}
