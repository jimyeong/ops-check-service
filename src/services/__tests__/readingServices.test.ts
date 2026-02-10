import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { PoolClient } from 'pg';
import { pool } from "../../core/db/pool";
import { handleReading } from "../readingServices";
import { HumidTempReading } from "../../core/db/types";
import { ingestReading } from "../ingestSensorReading";
import { transitionAlertStateAndEnqueue } from "../alertTransitionService";


describe.skip("readingServices", () => {
    let client: PoolClient;
    beforeEach(async () => {
        client = await pool.connect();
        await client.query("COMMIT")
        vi.clearAllMocks();
    })
    afterEach(async () => {
        await client.query("ROLLBACK")
        await client.release();
    })
    it("should ingest the reading and transition the alert state if the humidity is sustained high", async () => {
        const inHumiditySustainedHigh = vi.fn().mockResolvedValue(true);
        const mockReading: HumidTempReading = {
            device_id: BigInt(1),
            humidity: 60,
            receivedAt: new Date(),
            idempotency_key: Math.random().toString(36).substring(2, 15),
            temperature: 20,
            battery: 100,
            linkquality: "100",
            comfort_humidity_min: 40,
            comfort_humidity_max: 60,
            comfort_temperature_min: 18,
            comfort_temperature_max: 22,
            humidity_calibration: 0,
            temperature_calibration: 0,
            temperature_units: "celsius",
            update: {
                installed_version: 30,
                latest_version: 30,
                state: "idle",
            }
        }
        await handleReading(mockReading, BigInt(1), "test", {
            isHumiditySustainedHigh: inHumiditySustainedHigh,
            ingestReading: async () => { ingestReading(mockReading) },
            transitionAlertStateAndEnqueue: transitionAlertStateAndEnqueue,
        })
// check if the db has changed

        //device_alert_states
        const q = `
            SELECT * FROM device_alert_states WHERE device_id = $1
        `
        const result = await client.query(q, [BigInt(1)]);
        expect(result.rows[0].alert_state).toBe(true);


        const q2 = `
            SELECT * FROM outbox_events WHERE event_type = 'humidity_level_over_threshold'
        `
        const result2 = await client.query(q2, [BigInt(1)]);
        expect(result2.rows[0].event_type).toBe('humidity_level_over_threshold');
        expect(result2.rows[0].payload).toEqual({
            device_id: BigInt(1).toString(),
            alert_state: true,
        });
    })
})