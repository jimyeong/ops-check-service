import type { HumidTempReading } from '../types';
import type { PoolClient, QueryResult } from 'pg';
import { pool } from '../pool';
import { RECENT_READINGS_INTERVAL, MIN_RECENT_READINGS, HIGH_HUMIDITY_THRESHOLD, HIGH_RATIO_THRESHOLD } from '../../../constants/index';

export async function insertReading(client: PoolClient, reading: HumidTempReading): Promise<HumidTempReading | null> {
    let result: QueryResult<HumidTempReading> | null = null;
    try {
        if (!reading.idempotency_key) {
            throw new Error("idempotency_key is required");
        }
        result = await client.query<HumidTempReading>(`
        INSERT INTO humid_temp_readings (
           device_id,
           temperature,
           humidity, 
           battery,
           linkquality,
           comfort_humidity_min,
           comfort_temperature_max,
           comfort_humidity_max,
           comfort_temperature_min,
           humidity_calibration,
           temperature_calibration,
           temperature_units,
           received_at,
           idempotency_key
        )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
           ON CONFLICT(device_id, idempotency_key) DO NOTHING
           RETURNING *
   `, [
            reading.device_id,
            reading.temperature ?? null,
            reading.humidity ?? null,
            reading.battery ?? null,
            reading.linkquality ?? null,
            reading.comfort_humidity_min ?? null,
            reading.comfort_temperature_max ?? null,
            reading.comfort_humidity_max ?? null,
            reading.comfort_temperature_min ?? null,
            reading.humidity_calibration ?? null,
            reading.temperature_calibration ?? null,
            reading.temperature_units ?? null,
            reading.receivedAt ?? new Date(),
            reading.idempotency_key,
        ]);
    } catch (e) {
        console.error(`Failed to insert reading: ${e}`);
        throw e;
    }
    return result.rows[0] ?? null;
}
export async function isHumiditySustainedHigh(device_id: bigint) {
    const client = await pool.connect();
    const q = `
                    WITH recent_readings AS (
        SELECT humidity
        FROM humid_temp_readings
        WHERE device_id = $1
            AND received_at >= now() - INTERVAL '${RECENT_READINGS_INTERVAL}'
        )
        SELECT
        CASE
            WHEN COUNT(*) < ${MIN_RECENT_READINGS} THEN false
            ELSE (COUNT(*) FILTER (WHERE humidity >= ${HIGH_HUMIDITY_THRESHOLD})::float / COUNT(*)) >= ${HIGH_RATIO_THRESHOLD}
        END AS is_sustained_high
        FROM recent_readings;
    `
    try {
        const result = await client.query<{ is_sustained_high: boolean }>(q, [device_id]);
        console.log("@@2", result.rows[0])
        return result.rows[0].is_sustained_high;
    } catch (e) {
        console.error(`Failed to check if humidity is sustained high: ${e}`);
        throw e;
    } finally {
        client.release();
    }
}