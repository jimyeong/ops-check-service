import { pool } from "../../pool";
import type { ContactSensorReading } from "../../../../domain/sensors/contactSensor";

export async function insertContactSensorReading(Reading: ContactSensorReading): Promise<boolean> {
    const q = `
        INSERT INTO contact_sensor_readings (
            idempotency_key,
            device_id,
            battery,
            contact,
            linkquality,
            received_at,
            tamper,
            voltage,
            label
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT(device_id, idempotency_key) DO NOTHING
    `;
    try {
        const result = await pool.query(q, [
            Reading.idempotency_key,
            Reading.device_id,
            Reading.battery,
            Reading.contact,
            Reading.linkquality,
            Reading.received_at,
            Reading.tamper,
            Reading.voltage,
            Reading.label
        ]);
        return true

    } catch (e) {
        console.error(`Failed to insert contact sensor reading: ${e}`);
        return false;
    }

}