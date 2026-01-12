import { QueryResult } from 'pg';
import type { DeviceIdentifier } from '../types.ts';
import { pool } from '../pool.ts';
export const insertDeviceIdentifier = async ( device_id: bigint, id_type: string, id_value: string): Promise<boolean> => { 
    const result = await pool.query(`
        INSERT INTO device_identifiers(
            device_id,
            id_type,
            id_value
        )VALUES($1, $2, $3)
        ON CONFLICT(id_type, id_value) DO NOTHING
        UNIQUE(id_type, id_value)   
    `, [device_id, id_type, id_value]);
    const isDuplicated = result.rowCount===0;
    return isDuplicated; // true if duplicated
};
export const getDeviceIdentifier = async ( id_type: string, id_value: string): Promise<DeviceIdentifier | null> => { 
    const result = await pool.query<DeviceIdentifier>(`
        SELECT device_id, id_type, id_value, created_at FROM device_identifiers WHERE id_type = $1 AND id_value = $2
    `, [id_type, id_value]);
    return result?.rows[0] ?? null;
};
