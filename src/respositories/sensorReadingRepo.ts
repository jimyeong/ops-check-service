import type { HumidTempReading } from '../entities/HumidTempSensor.ts';
import { pool } from '../db/pool.ts';

export async function insertReading(reading: HumidTempReading) {
    const q = `
    INSERT INTO sensor_readings (device, temperature, humidity, battery, linkquality, ts)
    VALUES ($1, $2, $3, $4, $5, $6)
    `
    const v = [
        reading.device,
        reading.temperature,
        reading.humidity,
        reading.battery,
        reading.linkquality,
        reading.ts,
    ]
    const res = await pool.query(q,v)

}
export async function getLatestReading(device: string) {
    const q = `
        SELECT device, ts, temperature, humidity, battery, linkquality,
        FROM sensor_readings
        WHERE device = $1
        ORDER BY ts DESC
        LIMIT 1
    `
    const res = await pool.query(q, [device]);
    return res.rows[0] ?? null;
}