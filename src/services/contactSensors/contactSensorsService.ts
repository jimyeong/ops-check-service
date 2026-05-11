import type { ContactSensorPayload } from "../../domain/sensors/contactSensor";
import { insertContactSensorReading } from "../../core/db/repositories/contactSensors/contactSensorRepo";
import type { ContactSensorReading } from "../../domain/sensors/contactSensor";
import crypto from "crypto";

export async function contactSensorsService(idempotency_key: string, device_id: bigint, topic: string, payload: ContactSensorPayload, label: string) {
    try {
        const reading: ContactSensorReading = {
            idempotency_key: idempotency_key,
            device_id: device_id,
            battery: payload.battery,
            contact: payload.contact,
            linkquality: payload.linkquality,
            received_at: new Date(payload.last_seen),
            last_seen: payload.last_seen,
            tamper: payload.tamper,
            voltage: payload.voltage,
            label: label
        };
        await insertContactSensorReading(reading);
        return reading;
    } catch (e) {
        throw e;
    }
}