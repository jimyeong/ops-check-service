import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from "vitest";
import { pool } from "../../../pool";
import { insertOutboxEvent } from "../../outboxEventRepo";
import * as snsClient from "../../../../aws/clients/snsClient";
import { startOutboxWorker } from "../../../../../app/worker";
import { PublishCommandOutput } from "@aws-sdk/client-sns";
import { sleep } from "../../../../../app/worker";
import { OutboxEvent } from "../../../types";
import type { PoolClient } from 'pg';



describe.skip("outboxWorker e2e test", () => {
    let worker: ReturnType<typeof startOutboxWorker>
    let client: PoolClient
    beforeEach(async () => {
        vi.clearAllMocks()
        client = await pool.connect()
    })
    afterEach(async () => {
        // clear db of outbox events
        worker?.stop()
        await pool.query("DELETE FROM outbox_events");
        client.release()
    })
    afterAll(async () => {
        worker?.stop()
        await pool.end();
    })
    it("worker claims an outbox event and publishes it and marks it as done", async () => {
        // mock external dependencies
        const publishMessageSpy = vi.spyOn(snsClient, "publishMessage")
        worker = startOutboxWorker(pool) // worker starts here
        const idempotencyKey = Math.random().toString(36).substring(2, 15);
        const event = {
            event_type: "test",
            payload: { test: "test" },
            idempotency_key: idempotencyKey,
            attempts: 0
        }
        await insertOutboxEvent(client, event)
        await sleep(3000)
        await expect.poll(() => publishMessageSpy.mock.calls.length).toBeGreaterThan(0)
        const q = `
            SELECT status, attempts
            FROM outbox_events
            WHERE idempotency_key = $1
        `
        // check the status and attempts are correct
        await expect.poll(async () => {
            const res = await pool.query(q, [idempotencyKey]);
            return res.rows[0]
        }).toMatchObject({
            status: "done",
            attempts: 0,
        })


        // check the processed_at field is set
        await expect.poll(async () => {
            const q = `
                SELECT processed_at
                FROM outbox_events
                WHERE idempotency_key=$1
            `
            const res = await pool.query(q, [idempotencyKey]);
            return res.rows[0]?.processed_at ?? null;
        }).not.toBeNull()

    })
    it("When publishing fails, the event is retried", async () => {
        // mock external dependencies
        const publishMessageSpy = vi.spyOn(snsClient, "publishMessage").mockImplementation(() => {
            throw new Error("test error")
        })

        worker = startOutboxWorker(pool) // worker starts here
        const idempotencyKey = Math.random().toString(36).substring(2, 15);
        const event = {
            event_type: "test",
            payload: { test: "test" },
            idempotency_key: idempotencyKey,
            attempts: 0
        }
        await insertOutboxEvent(client, event)
        // check the pulish function is called
        await expect.poll(() => publishMessageSpy.mock.calls.length).toBeGreaterThan(0)
        const q = `
            SELECT attempts FROM outbox_events WHERE idempotency_key = $1
        `
        // check the attempts are incremented after the publish fails
        await expect.poll(async () => {
            const res = await pool.query(q, [idempotencyKey]);
            return res.rows[0]?.attempts;
        }).toBe(1);

    })
})