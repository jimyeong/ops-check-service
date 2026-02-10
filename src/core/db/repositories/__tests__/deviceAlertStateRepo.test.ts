import { describe, beforeEach, afterEach, it, expect } from "vitest"
import { pool } from "../../pool"
import type { PoolClient } from "pg";
import { updateDeviceAlertState } from "../deviceAlertStateRepo";

describe("deviceAlertStateRepo", () => {
    let client: PoolClient;
    beforeEach(async () => {
        client = await pool.connect();
        await client.query("BEGIN");
    })
    afterEach(async () => {
        await client.query("ROLLBACK");
        client.release();
    })
    it("should upsert a device alert state", async () => {
        const device_id = BigInt(1);
        const alert_state = true;
        const alert_type = "humidity_sensor";
        const result = await updateDeviceAlertState(client, device_id, alert_state, alert_type)
        if (!result) throw new Error("Failed to update device alert state");
        console.log(result)
        expect(BigInt(result.device_id)).toBe(device_id)
        expect(result.alert_state).toBe(alert_state)
        expect(result.alert_type).toBe(alert_type)
        expect(result.last_triggered_at).toBeInstanceOf(Date)
    })
})
