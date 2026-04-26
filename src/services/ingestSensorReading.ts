import { pool } from '../core/db/pool';
import { ensureDeviceExists } from '../core/db/repositories/devicesRepo';
import { insertReading } from '../core/db/repositories/sensorReadingRepo';
import type { HumidTempReading } from '../core/db/types';
import { Devices } from '../constants/index';


export async function ingestReading(reading: HumidTempReading) {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        await ensureDeviceExists(client, reading.device_id, Devices.TOILET_HUMID_TEMP_SENSOR, "Toilet Humid Temp Sensor", "toilet_humid_temp_sensor");
        await insertReading(client, reading);
        await client.query("COMMIT");
    } catch (e) {
        await client.query("ROLLBACK");
        throw e;
    } finally {
        client.release();
    };
}