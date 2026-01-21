import { Pool, PoolClient } from "pg";
import { OutboxEvent } from "../core/db/types";
import { JsonValue } from "../types/json";
import { getErrorMessage } from "../utils/errors";
import * as snsClient from "../core/aws/clients/snsClient";
export function startOutboxWorker(pool: Pool) {
    const BATCH_SIZE = 50;
    const SLEEP_MS = 500;
    const loop = async () => {
        while (true) {
            const client = await pool.connect();
            try {
                const events = await claimBatch(client, BATCH_SIZE);
                if (events.length === 0) {
                    await sleep(SLEEP_MS)
                    continue;
                }

                for (const event of events) {
                    try {

                        console.log("PUBLISHING MESSAGE", event)
                        await publish(event.event_type, event.payload as JsonValue)
                        console.log("PUBLISHING MESSAGE", event)
                        await markDone(client, event.id);
                    } catch (e) {
                        const msg = getErrorMessage(e)
                        await markRetry(client, event.id, event.attempts, msg);
                    }
                }
            } catch (e) {
                console.log("4@@@", e)
                const msg = getErrorMessage(e)
                console.log(msg)
            } finally {
                client.release()
            }
        }
    }
    loop().catch(e => {
        console.error("Outbox worker crashhed", e);
        process.exit(1);
    })


}

async function claimBatch(client: PoolClient, limit: number): Promise<OutboxEvent[]> {
    const q = `
        WITH picked AS (
        SELECT id
        FROM outbox_events
        WHERE status = 'pending'
            AND available_at <= now()
        ORDER BY created_at
        FOR UPDATE SKIP LOCKED
        LIMIT $1
        )
        UPDATE outbox_events e
        SET status = 'processing', locked_at = now()
        FROM picked
        WHERE e.id = picked.id
        RETURNING e.id, e.event_type, e.payload, e.attempts;
    `
    const { rows } = await client.query(q, [limit])
    return rows
}

async function markDone(client: PoolClient, id: string) {
    // const q = `
    //     DELETE FROM outbox_events
    //     WHERE id=$1
    // `
    const q = `
        UPDATE outbox_events
        SET status = 'done', processed_at = now()
        WHERE id = $1
    `
    client.query(q, [id])
}

async function markRetry(client: PoolClient, id: string, attempts: number, lastError: string) {
    const q = `
        UPDATE outbox_events
        SET status = 'pending'
            attempts = $2,
            available_at = now() + ($3 || ' second')::interval,
            last_error = $4
        WHERE id = $1
    `
    const nextAttempts = attempts + 1
    const delaySeconds = Math.min(60, 2 ** Math.min(nextAttempts, 6)) // backoff capped
    try {
        await client.query(q, [id, nextAttempts, delaySeconds, lastError]);
    } catch (e) {
        console.log("error marking retry", e)
        throw e
    }
}

async function publish(topic: string, payload: JsonValue) {
    const client = snsClient.createSNSClient()
    const message = JSON.stringify(payload)
    try {
        const result = await snsClient.publishMessage(client, message)
    } catch (e) {
        console.log("error publishing", e)
        throw e
    }
}

export function sleep(ms: number): Promise<void> {
    return new Promise((resolve, reject) => setTimeout(resolve, ms))
}