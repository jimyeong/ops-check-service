import { pool } from '../core/db/pool';
import { ensureDeviceExists } from '../core/db/repositories/devicesRepo';
import { insertReading } from '../core/db/repositories/sensorReadingRepo';
import type { HumidTempReading } from '../core/db/types';
import { Devices } from '../constants/index';


const z2mMqttPayload = `
z2m: mqtt: MQTT publish: topic 'zigbee2mqtt/toilet_humid_temp_sensor', payload '{"battery":100,"comfort_humidity_max":60,"comfort_humidity_min":40,"comfort_temperature_max":27,"comfort_temperature_min":19,"humidity":47.7,"humidity_calibration":0,"linkquality":135,"temperature":22.7,"temperature_calibration":0,"temperature_units":"celsius","update":{"installed_version":8960,"latest_version":8960,"state":"idle"}}'
`
// DTO


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