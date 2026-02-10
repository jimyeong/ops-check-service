import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { PoolClient } from 'pg';
import { pool } from "../../core/db/pool";
import { handleReading } from "../readingServices";
import { HumidTempReading } from "../../core/db/types";
import { ingestReading } from "../ingestSensorReading";
import { transitionAlertStateAndEnqueue } from "../alertTransitionService";
import * as deviceAlertStateRepo from "../../core/db/repositories/deviceAlertStateRepo";
import * as outboxEventRepo from "../../core/db/repositories/outboxEventRepo";

vi.spyOn(pool, "connect").mockResolvedValue({
    query: vi.fn(),
    release: vi.fn(),
} as any);

describe("transitionAlertStateAndEnqueue", () => {
    let client: PoolClient;
    beforeEach(async ()=>{
        vi.clearAllMocks();
        client = await pool.connect();
    })
    afterEach(()=> {
        vi.clearAllMocks();
        client.release();
    })
    
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
    it("success path", async () => {
        vi.spyOn(deviceAlertStateRepo, "updateDeviceAlertState").mockResolvedValue({} as any);
        vi.spyOn(outboxEventRepo, "insertOutboxEvent").mockResolvedValue({} as any);
        await transitionAlertStateAndEnqueue(BigInt(1), true, "humidity_level_over_threshold", "test");
        expect(deviceAlertStateRepo.updateDeviceAlertState).toHaveBeenCalled();
        expect(outboxEventRepo.insertOutboxEvent).toHaveBeenCalled();
        expect(client.query).toHaveBeenCalledWith("BEGIN");
        expect(client.query).toHaveBeenCalledWith("COMMIT");
    })
    it("failed on the updating device alert state", async () => {
        vi.spyOn(deviceAlertStateRepo, "updateDeviceAlertState").mockRejectedValue(new Error("fail"));
        vi.spyOn(outboxEventRepo, "insertOutboxEvent").mockResolvedValue({} as any);
        // await expect(transitionAlertStateAndEnqueue(BigInt(1), true, "humidity_level_over_threshold", "test")).rejects.toThrow("fail");
        await expect(transitionAlertStateAndEnqueue(BigInt(1), true, "humidity_level_over_threshold", "test")).rejects.toThrow("fail");
        expect(deviceAlertStateRepo.updateDeviceAlertState).toHaveBeenCalled();
        expect(outboxEventRepo.insertOutboxEvent).not.toHaveBeenCalled();
        expect(client.query).toHaveBeenCalledWith("ROLLBACK");
        expect(client.query).not.toHaveBeenCalledWith("COMMIT");
    })
    it("failed on the ingesting reading", async () => {
        vi.spyOn(deviceAlertStateRepo, "updateDeviceAlertState").mockResolvedValue({} as any);
        vi.spyOn(outboxEventRepo, "insertOutboxEvent").mockRejectedValue(new Error("fail"))
        await expect(transitionAlertStateAndEnqueue(BigInt(1), true, "humidity_level_over_threshold", "test")).rejects.toThrow("fail");
        expect(deviceAlertStateRepo.updateDeviceAlertState).toHaveBeenCalled();
        expect(outboxEventRepo.insertOutboxEvent).toHaveBeenCalled();
        expect(outboxEventRepo.insertOutboxEvent).rejects.toThrow("fail");
        expect(client.query).toHaveBeenCalledWith("ROLLBACK");
        expect(client.query).not.toHaveBeenCalledWith("COMMIT");
    })
})