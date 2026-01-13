import { pool } from '../../db/pool.ts';
import type { OutboxEvent } from '../types.ts';

type Json = | string | number | boolean | null | { [key: string]: Json } | Json[];

type OutboxEventInput = {
    event_type: string,
    payload: Json,
    idempotency_key: string,
}

export const insertOutboxEvent = async (event: OutboxEventInput): Promise<OutboxEvent | null> => {
    try {
        const q = `
        INSERT INTO outbox_events (event_type, payload, idempotency_key)
        VALUES ($1, $2, $3)
        ON CONFLICT(idempotency_key) DO NOTHING
        RETURNING *
        `
        const result = await pool.query<OutboxEvent>(q, [event.event_type, event.payload, event.idempotency_key]);
        return result.rows[0] ?? null;
    } catch (e) {
        console.error(`Failed to insert outbox event: ${e}`);
        throw e;
    }
}