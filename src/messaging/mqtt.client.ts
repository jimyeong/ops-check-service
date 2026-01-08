import mqtt from 'mqtt';
import type { MqttClient, IClientOptions } from 'mqtt';
import type { HumidTempReading } from '../core/db/types.ts';
import { ingestReading } from '../services/ingestSensorReading.ts';
import { Devices } from '../constants';
const PREFIX = "zigbee2mqtt/";


export type MqttSubscriberOptions = {
    url: string;
    topics: string[]
    cleintId?: string;
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
        clientId: options.cleintId ?? `ops-check-service-${Math.random().toString(16).slice(2)}`,
        username: options.username,
        password: options.password,
        reconnectPeriod: 2000,
    } as IClientOptions);
    client.on('connect', () => {
        client.subscribe(PREFIX + Devices.TOILET_HUMID_TEMP_SENSOR, { qos: 0 }, err => {
            if (err) {
                console.error(`Failed to subscribe to topics ${options.topics}: ${err}`);
                client.emit("error", err)
            }
        })
    })
    client.on("message", async (topic, message) => {
        console.log(`[mqtt] message: ${message.toString()}`);
        try {
            const payload: HumidTempReading = JSON.parse(message.toString()) as HumidTempReading;
            if (!topic.startsWith(PREFIX)) return;
            const device = topic.substring(PREFIX.length);
            console.log("[device]", device);
            if (device !== Devices.TOILET_HUMID_TEMP_SENSOR) return;
            const reading: HumidTempReading = {
                device_id: payload.device_id,
                temperature: payload.temperature,
                humidity: payload.humidity,
                battery: payload.battery,
                linkquality: payload.linkquality,
                receivedAt: new Date(),
            }
            await ingestReading(reading);
            await onMessage({ topic, payload: reading, raw: message.toString(), receivedAt: new Date() });
            console.log(`[mqtt] received reading: ${JSON.stringify(reading)}`);

        } catch (e) {
            // QoS 1 + persistent session + stable clientId
            // idempotent DB writes
            // optionally retained messages for "latest state"
            // data can be lost but later, add mongodb to store the lost data

            // for now Qos 0
            console.error(`[mqtt] error: ${e}`);
            console.error(`[mqtt] topic: ${topic}`);
            // db
            if(e.code === '23505') {
                console.error(`[mqtt] duplicate reading`);
            }else{
                console.error(`[mqtt] error: ${e}`);
            }
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