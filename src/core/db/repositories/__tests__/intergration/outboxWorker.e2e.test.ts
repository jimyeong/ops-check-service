import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { pool } from "../../../pool";
import { insertOutboxEvent } from "../../outboxEventRapo";
import * as snsClient from "../../../../aws/clients/snsClient";
import { startOutboxWorker } from "../../../../../app/worker";
import { PublishCommandOutput } from "@aws-sdk/client-sns";
import { sleep } from "../../../../../app/worker";




describe.skip("outboxWorker e2e test", () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })
    afterEach(() => {
        // clear db of outbox events
    })
    it("worker claims an outbox event and publishes it and marks it as done", async () => {
        // mock external dependencies
        const publishMessageSpy = vi.spyOn(snsClient, "publishMessage")
        startOutboxWorker(pool) // worker starts here

        const client = await pool.connect()
        try {
            const event = {
                event_type: "test",
                payload: { test: "test" },
                idempotency_key: Math.random().toString(36).substring(2, 15),
                attempts: 0
            }
            await insertOutboxEvent(event)
            await sleep(3000) // give the worker some time to process the event
            expect(publishMessageSpy).toHaveBeenCalled()
            
        } finally {
            client.release()
        }
    })
})