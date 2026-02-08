import type { JsonValue } from '../../../types/json';
import { pool } from '../../db/pool';
import type { OutboxEvent } from '../types';
import type { PoolClient } from 'pg';

export type OutboxEventInput = {
    event_type: string,
    payload: JsonValue,
    idempotency_key: string,
    attempts: number,
}

export const insertOutboxEvent = async (client: PoolClient, event: OutboxEventInput): Promise<OutboxEvent | null> => {
    try {
        const q = `
        INSERT INTO outbox_events (event_type, payload, idempotency_key, attempts)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT(idempotency_key) DO NOTHING
        RETURNING *
        `
        const result = await client.query<OutboxEvent>(q, [event.event_type, event.payload, event.idempotency_key, event.attempts]);
        return result.rows[0] ?? null;
    } catch (e) {
        console.error(`Failed to insert outbox event: ${e}`);
        throw e;
    }
}