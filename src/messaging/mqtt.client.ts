import mqtt from 'mqtt';
import type { MqttClient, IClientOptions } from 'mqtt';
import type { HumidTempReading, OutboxEvent } from '../core/db/types';
import { ingestReading } from '../services/ingestSensorReading';
import { Devices } from '../constants';
import { insertDeviceIdentifier, getDeviceIdentifier } from '../core/db/repositories/deviceIdentifiersRepo';
import { getDevice } from '../core/db/repositories/devicesRepo';
const PREFIX = "zigbee2mqtt/";
import { saveInboxMessage } from '../core/db/repositories/inboxMessagesRepo';
import crypto from "crypto";
import { insertOutboxEvent } from '../core/db/repositories/outboxEventRapo';
import type { OutboxEventInput } from '../core/db/repositories/outboxEventRapo';


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
        const topicsToSubscribe = (options.topics?.length ? options.topics : [PREFIX + Devices.TOILET_HUMID_TEMP_SENSOR]);
        client.subscribe(topicsToSubscribe, { qos: 1 }, async (err, granted) => {
            if (err) {
                console.error(`Failed to subscribe to topics ${topicsToSubscribe.join(", ")}: ${err}`);
                client.emit("error", err);
                return;
            }
            try {
                console.log("subscribed", granted);
                // Ensure the device identifier exists (id_type='topic_name', id_value='<device name>').
                const deviceRow = await getDevice(Devices.TOILET_HUMID_TEMP_SENSOR);
                if (deviceRow === null) {
                    console.error(`Device not found`);
                    throw new Error(`Device not found`);
                }

                // mapping the topic name to the device id in the mapper table
                const alreadyExists = await insertDeviceIdentifier(
                    deviceRow.id,
                    "topic_name",
                    Devices.TOILET_HUMID_TEMP_SENSOR,
                );

                if (alreadyExists) console.log("existing device identifier");
            } catch (e) {
                console.error(`Failed to insert device identifier: ${e}`);
            }
        });
    })
    client.on("message", async (topic, message) => {
        console.log(`[mqtt] message: ${message.toString()}`);
        const msg = message.toString("utf-8");
        // normalise the topic and msg to lowercase
        const idempotency_key = crypto.createHash('sha256').update(topic + ":" + msg).digest('hex');
        try {
            // filterings
            if (!topic.startsWith(PREFIX)) return;

            const device = topic.substring(PREFIX.length);
            if (device !== Devices.TOILET_HUMID_TEMP_SENSOR) return;

            // Lookup by device name (matches the inserted id_value).
            const identifier = await getDeviceIdentifier("topic_name", device);
            if (identifier === null) {
                console.error(`Device identifier not found, IGNORE the message, topic: ${topic}`);
                return;
            }
            const device_id = identifier.device_id;

            const payload: HumidTempReading = JSON.parse(msg) as HumidTempReading;

            console.log("[device]", device);
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
            const outboxEvent:OutboxEventInput = {
                event_type: topic,
                payload: JSON.parse(msg),
                idempotency_key: idempotency_key,
                attempts: 0,
            };
            
            await ingestReading(reading);
            await insertOutboxEvent(outboxEvent)
            // TODO save the message in the inbox table
            await onMessage({ topic, payload: reading, raw: msg, receivedAt: receivedAt });
            // console.log(`[mqtt] received reading: ${JSON.stringify(reading)}`);

        } catch (e) {
            // QoS 1 + persistent session + stable clientId
            // idempotent DB writes
            // optionally retained messages for "latest state"
            // data can be lost but later, add mongodb to store the lost data
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
        console.error(`MQTT error: `, err);
    });

    async function stop() {
        return new Promise<void>((resolve) => {
            client.end(true, {}, () => resolve())
        })
    }
    return { client, stop };
}