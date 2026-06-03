import mqtt from 'mqtt';
import type { MqttClient, IClientOptions } from 'mqtt';
import { Devices, SensorLabels } from '../constants';
import { insertDeviceIdentifier, getDeviceIdentifier } from '../core/db/repositories/deviceIdentifiersRepo';
import { getDevice } from '../core/db/repositories/devicesRepo';
import crypto from "crypto";
import { handleBathroomHumidiyReading, handleHumidTempSensorReading } from '../handlers/humidityTemperatureHandlers';
import { handleSmartSocketReading } from '../handlers/socketSensorsHandler';
import { handleContactSensorReadingHandler } from '../handlers/contactSensorsHandler';

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
const sensorsToSubscribe = [
    Devices.TOILET_HUMID_TEMP_SENSOR,
    Devices.POWER_SOCKET_DEHUMIDIFIER,
    Devices.POWER_SOCKET_FAN,
    Devices.TOILET_WINDOW_SENSOR,
    Devices.TOILET_HUMID_TEMP_NEAR_WINDOW_SENSOR
]
export function startMqttSubscriber(options: MqttSubscriberOptions, onMessage: MqttMessageHandler): { client: MqttClient; stop: () => Promise<void> } {
    const client = mqtt.connect(options.url, {
        clientId: options.clientId ?? `ops-check-service`,
        username: options.username,
        password: options.password,
        reconnectPeriod: 2000,
        clean: false,
    } as IClientOptions);
    client.on('connect', async () => {
        const topicsToSubscribe = (options.topics?.length ? options.topics : sensorsToSubscribe);
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

        // add devices
        if (device !== Devices.TOILET_HUMID_TEMP_SENSOR &&
            device !== Devices.POWER_SOCKET_DEHUMIDIFIER &&
            device !== Devices.POWER_SOCKET_FAN &&
            device !== Devices.TOILET_WINDOW_SENSOR &&
            device !== Devices.TOILET_HUMID_TEMP_NEAR_WINDOW_SENSOR
        ) return;
        const msg = message.toString("utf-8");
        const payload = JSON.parse(msg);
        if (device === Devices.TOILET_HUMID_TEMP_SENSOR) {
            const idempotency_key = crypto.createHash("sha256").update(topic + ":" + msg).digest('hex');
            await handleHumidTempSensorReading(
                idempotency_key,
                topic,
                Devices.TOILET_HUMID_TEMP_SENSOR,
                msg,
                "bathroom/bathtub_shelf",
                onMessage
            );
        } else if (device === Devices.TOILET_HUMID_TEMP_NEAR_WINDOW_SENSOR) {
            const idempotency_key = crypto.createHash("sha256").update(topic + ":" + msg).digest('hex');
            await handleHumidTempSensorReading(
                idempotency_key,
                topic,
                Devices.TOILET_HUMID_TEMP_NEAR_WINDOW_SENSOR,
                msg,
                "bathroom/near_window",
                onMessage
            );
        } else if (device === Devices.POWER_SOCKET_DEHUMIDIFIER) {

            const idempotency_key = crypto.createHash("sha256").update(topic + ":" + payload.last_seen).digest('hex');
            await handleSmartSocketReading(
                idempotency_key,
                topic,
                msg,
                SensorLabels.UNIVERSAL_DEHUMIDIFIER_SOCKET,
                Devices.POWER_SOCKET_DEHUMIDIFIER,
                onMessage
            );
        } else if (device === Devices.POWER_SOCKET_FAN) {
            const idempotency_key = crypto.createHash("sha256").update(topic + ":" + payload.last_seen).digest('hex');
            await handleSmartSocketReading(
                idempotency_key,
                topic,
                msg,
                SensorLabels.BATHROOM_FAN_SOCKET,
                Devices.POWER_SOCKET_FAN,
                onMessage
            );
        } else if (device === Devices.TOILET_WINDOW_SENSOR) {
            const idempotency_key = crypto.createHash("sha256").update(topic + ":" + payload.last_seen).digest('hex');
            if (!idempotency_key) {
                console.error(`[mqtt] idempotency key not found, IGNORE the message, topic: ${topic}`);
                return;
            }
            await handleContactSensorReadingHandler(
                idempotency_key,
                topic,
                msg,
                SensorLabels.BATHROOM_WINDOW_CONTACT_SENSOR,
                Devices.TOILET_WINDOW_SENSOR,
                onMessage
            );
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
