import type { OutboxEventInput } from "../core/db/repositories/outboxEventRepo";
import { insertOutboxEvent } from "../core/db/repositories/outboxEventRepo";
import { pool } from "../core/db/pool";

export async function enqueueOutboxService(event: OutboxEventInput) {
    const client = await pool.connect();
    try {
        await insertOutboxEvent(client, event);
        
    } catch (e) {
        // add logger
        console.error(`[enqueueOutboxService] failed to enqueue outbox event: ${e}`);
        throw e;
    } finally {
        client.release();
    }
}