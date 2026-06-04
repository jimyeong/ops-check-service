import type { MqttMessageHandler } from "../messaging/mqtt.client";
import { getDeviceIdentifier } from "../core/db/repositories/deviceIdentifiersRepo";
import { contactSensorsService } from "../services/contactSensors/contactSensorsService";
import type { ContactSensorPayload } from "../domain/sensors/contactSensor";
import type { MqttClient } from "mqtt";
import { Devices, EventTypes, PublishTopics, Topics } from "../constants";

export async function handleContactSensorReadingHandler(
    idempotency_key: string,
    topic: string,
    msg: string,
    label: string,
    topic_name: string,
    onMessage: MqttMessageHandler,
    publisher: MqttClient
) {
    try {
        const identifier = await getDeviceIdentifier("topic_name", topic_name);
        if (identifier === null) {
            console.error(`Device identifier not found, IGNORE the message, topic: ${label}`);
            return;
        }
        const device_id = identifier.device_id;
        const payload: ContactSensorPayload = JSON.parse(msg) as ContactSensorPayload;
        const reading = await contactSensorsService(idempotency_key, device_id, topic, payload, label);
        await onMessage({ topic, payload: reading, raw: msg, receivedAt: new Date(payload.last_seen) });
        try {
            const topic = `${Topics.ZIGBEE2MQTT}${Devices.POWER_SOCKET_FAN}/set`
            const payload = determineFanSocketState(reading.contact)
            publishMessage(publisher, topic, payload)
        } catch (e) {
            console.error(`[mqtt] failed to publish message to topic: ${topic}`);
        }
    } catch (e) {
        console.error(`[mqtt] failed to handle contact sensor reading: ${e}`);
    }
}

export const determineFanSocketState = (isContacted: boolean): { state: "ON" | "OFF" } => {
    return {
        state: isContacted ? "OFF" : "ON"
    };
}
export const publishMessage = (publisher: MqttClient, topic: string, payload: any) => {
    publisher.publish(topic, JSON.stringify(payload), { qos: 1 }, err => {
        if (err) {
            console.log(`[mqtt] failed to publish message to topic: ${topic}`);
        } else {
            console.log(`[mqtt] published message to topic: ${topic}`);
        }
    })
}