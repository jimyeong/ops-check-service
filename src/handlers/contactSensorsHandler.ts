import type { MqttMessageHandler } from "../messaging/mqtt.client";
import { getDeviceIdentifier } from "../core/db/repositories/deviceIdentifiersRepo";
import { contactSensorsService } from "../services/contactSensors/contactSensorsService";
import type { ContactSensorPayload } from "../domain/sensors/contactSensor";

export async function handleContactSensorReadingHandler(
    idempotency_key: string,
    topic: string,
    msg: string,
    label: string,
    topic_name: string,
    onMessage: MqttMessageHandler
) {
    try {
        const identifier = await getDeviceIdentifier("topic_name", topic_name);
        if (identifier === null) {
            console.error(`Device identifier not found, IGNORE the message, topic: ${topic}`);
            return;
        }
        const device_id = identifier.device_id;
        const payload: ContactSensorPayload = JSON.parse(msg) as ContactSensorPayload;
        const reading = await contactSensorsService(idempotency_key, device_id, topic, payload, label);
        await onMessage({ topic, payload: reading, raw: msg, receivedAt: new Date(payload.last_seen) });
    } catch (e) {
        console.error(`[mqtt] failed to handle contact sensor reading: ${e}`);
    }
}