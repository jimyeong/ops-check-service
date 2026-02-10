import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { PoolClient } from "pg";
import { pool } from "../../pool";
import { insertOutboxEvent } from "../outboxEventRepo";
import type { OutboxEventInput } from "../outboxEventRepo";

describe("outboxEventRepo", () => {
    let client: PoolClient;
    beforeEach(async () => {
        client = await pool.connect();
        await client.query("BEGIN");
    })
    afterEach(async () => {
        await client.query("ROLLBACK");
        client.release();
    })
    it("should insert an outbox event", async () => {
        // when the same idempotency key is used, it should insert once and ignore the others
        const event: OutboxEventInput = {
            event_type: "test",
            payload: { test: "test" },
            idempotency_key: "",
            attempts: 0,
        }
        const runTest = async (event: OutboxEventInput, idempotencyKey: string) => {
            const res = await insertOutboxEvent(client, {
                ...event,
                idempotency_key: idempotencyKey,
            })
            if (!res) return false;
            return true;
        }
        const result = await runTest(event, "abc123456789");
        expect(result).toBe(true);
        const result2 = await runTest(event, "abc123456789");
        expect(result2).toBe(false);
        const result3 = await runTest(event, "abc1234567890");
        expect(result3).toBe(true);
    })
})