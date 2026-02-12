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
        const topicsToSubscribe = (options.topics?.length ? options.topics : [`zigbee2mqtt/${Devices.TOILET_HUMID_TEMP_SENSOR}`]);
        client.subscribe(topicsToSubscribe, { qos: 1 }, async (err, granted) => {
            if (err) {
                console.error(`Failed to subscribe to topics ${topicsToSubscribe.join(", ")}: ${err}`);
                client.emit("error", err);
                return;
            }
            try {
                console.log("subscribed", granted);
                // Ensure the device identifier exists (id_type='topic_name', id_value='<device name>').
                // NOTE: `connect` can fire on every reconnect, so avoid noisy logs on normal operation.
                // TODO add device process later
                const deviceRow = await getDevice(Devices.TOILET_HUMID_TEMP_SENSOR);
                if (deviceRow === null) {
                    console.error(`Device not found`);
                    throw new Error(`Device not found`);
                }

                const existingIdentifier = await getDeviceIdentifier(
                    "topic_name",
                    Devices.TOILET_HUMID_TEMP_SENSOR,
                );

                if (existingIdentifier === null) {
                    const didInsert = await insertDeviceIdentifier(
                        deviceRow.id,
                        "topic_name",
                        Devices.TOILET_HUMID_TEMP_SENSOR,
                    );

                    if (didInsert) {
                        console.log("inserted device identifier");
                    }
                    // If `didInsert` is false, another instance likely inserted it concurrently.
                }
            } catch (e) {
                console.error(`Failed to insert device identifier: ${e}`);
            }
        });
    })
    client.on("message", async (topic, message) => {
        // filterings
        if (!topic.startsWith('zigbee2mqtt/')) return;
        if (topic.endsWith('/bridge/state')) return;
        if (topic.endsWith('/bridge/info')) return;
        if (topic.endsWith('/bridge/devices')) return;
        const device = topic.substring('zigbee2mqtt/'.length).trim();
        if (device !== Devices.TOILET_HUMID_TEMP_SENSOR) return;
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
                linkquality: payload.linkquality,
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
            const result = await saveInboxMessage(jsonPayload, idempotency_key);
            if (result) console.log("saved inbox message");
            else console.log("duplicate inbox message");
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