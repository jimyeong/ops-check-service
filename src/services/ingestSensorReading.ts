import { pool } from '../core/db/pool.ts';
import { ensureDeviceExists } from '../core/db/repositories/devicesRepo.ts';
import { insertReading } from '../core/db/repositories/sensorReadingRepo.ts';


export async function ingestReading(reading){
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        await ensureDeviceExists(client, reading.device_id, reading.device_name);
        await client.query("COMMIT");
    }catch(e){
        await client.query("ROLLBACK");
        throw e;
    }finally{
        client.release();
    };
}