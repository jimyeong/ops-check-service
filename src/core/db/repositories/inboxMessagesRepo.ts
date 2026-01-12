import type { PoolClient } from 'pg';
import { pool } from '../pool.ts';

export const saveInboxMessage = async (payload: unknown, message_key: string): Promise<boolean> => {
    const q = `
        INSERT INTO inbox_messages (payload, received_at, message_key)
        VALUES ($1, $2, $3)
        ON CONFLICT(message_key) DO NOTHING
    `
    const result = await pool.query(q, [payload, new Date(), message_key]);
    return result.rowCount === 0; // true if duplicated

}
