import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from "vitest";
import { pool } from "../../../pool";
import { insertOutboxEvent } from "../../outboxEventRapo";
import * as snsClient from "../../../../aws/clients/snsClient";
import { startOutboxWorker } from "../../../../../app/worker";
import { PublishCommandOutput } from "@aws-sdk/client-sns";
import { sleep } from "../../../../../app/worker";
import { OutboxEvent } from "../../../types";




describe("outboxWorker e2e test", () => {
    let worker: ReturnType<typeof startOutboxWorker>
    beforeEach(() => {
        vi.clearAllMocks()
    })
    afterEach(() => {
        // clear db of outbox events
        worker.stop()
    })
    afterAll(() => {
        worker.stop()
    })
    it.skip("worker claims an outbox event and publishes it and marks it as done", async () => {
        // mock external dependencies
        const publishMessageSpy = vi.spyOn(snsClient, "publishMessage")
        worker = startOutboxWorker(pool) // worker starts here

        const client = await pool.connect()
        try {
            const event = {
                event_type: "test",
                payload: { test: "test" },
                idempotency_key: Math.random().toString(36).substring(2, 15),
                attempts: 0
            }
            await insertOutboxEvent(event)
            await sleep(3000)
            await expect.poll(() => publishMessageSpy.mock.calls.length).toBeGreaterThan(0)
        } finally {
            client.release()
            worker.stop()
        }
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
        await insertOutboxEvent(event)
        await expect.poll(() => publishMessageSpy.mock.calls.length).toBeGreaterThan(0)
        const q = `
            SELECT attempts FROM outbox_events WHERE idempotency_key = $1
        `
        await expect.poll(async () => {
            const res = await pool.query(q, [idempotencyKey]);
            return res.rows[0]?.attempts;
        }).toBe(1);

    })
})