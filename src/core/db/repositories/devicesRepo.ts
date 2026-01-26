import type { Devices } from '../types';
import type { QueryResult, PoolClient } from 'pg'; 
import { pool } from '../pool';
export async function ensureDeviceExists(client: PoolClient, device_id: bigint, device_type: string, display_name: string, name: string) {
    await client.query(`
        INSERT INTO devices (id, device_type, display_name, name)
        VALUES($1, $2, $3, $4)
        ON CONFLICT(id) DO NOTHING`, [device_id, device_type, display_name, name]);
}

export const getDevice = async ( topic_name: string): Promise<Devices | null> => {
    const q = `
        SELECT id, device_type, display_name, name
        FROM devices
        WHERE name = $1
        LIMIT 1
    `
    let result: QueryResult<Devices> | null = null;
    try{
        result = await pool.query(q, [topic_name]);
    }catch(e){
        console.error(`Failed to get device id: ${e}`);
        throw e;
    }
    
    return result?.rows[0] ?? null;
}