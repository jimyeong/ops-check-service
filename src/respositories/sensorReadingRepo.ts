import type { HumidTempReading } from '../entities/HumidTempSensor.ts';
import { pool } from '../db/pool.ts';

export async function insertReading(reading: HumidTempReading) {
    const q = `
    INSERT INTO humid_temp_readings (device, temperature, humidity, battery, linkquality)
    VALUES ($1, $2, $3, $4, $5)
    `
    console.log("reading", reading);
    const v = [
        reading.device,
        reading.temperature,
        reading.humidity,
        reading.battery,
        reading.linkquality,
    ]
    const res = await pool.query(q,v)

}
export async function getLatestReading(device: string) {
    const q = `
        SELECT device, temperature, humidity, battery, linkquality,
        FROM humid_temp_readings
        WHERE device = $1
        ORDER BY received_at DESC
        LIMIT 1
    `
    const res = await pool.query(q, [device]);
    return res.rows[0] ?? null;
}