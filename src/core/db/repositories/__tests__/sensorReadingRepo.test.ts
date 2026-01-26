import { pool } from "../../pool";
import { ensureDeviceExists } from "../devicesRepo";
import { insertReading } from "../sensorReadingRepo";
import { describe, it, expect } from "vitest";

describe.skip("sensorReadingRepo insertReading (idempotency)", () => {
  it("should insert once and ignore duplicates for same (device_id, idempotency_key)", async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // create a device
      const deviceId = BigInt(Date.now()); // enough unique
      await ensureDeviceExists(
        client,
        deviceId,
        "SENSOR",
        "Test Humid Sensor",
        "test_humid_sensor"
      );

      // same message (same idempotency_key) twice
      const baseReading = {
        device_id: deviceId,
        temperature: 22.7,
        humidity: 47.7,
        battery: 100,
        linkquality: 135,
        comfort_humidity_min: 40,
        comfort_temperature_max: 27,
        comfort_humidity_max: 60,
        comfort_temperature_min: 19,
        humidity_calibration: 0,
        temperature_calibration: 0,
        temperature_units: "celsius",
        receivedAt: new Date(),
        idempotency_key: "topic:payload-hash-123", // fixed key for testing
      };

      const r1 = await insertReading(client, baseReading as any);
      expect(r1).not.toBeNull();

      const r2 = await insertReading(client, baseReading as any);
      expect(r2).toBeNull(); // if duplicated, DO NOTHING -> RETURNING is empty -> null

      // check if there is only one record in the database
      const count = await client.query<{ c: string }>(
        `
        SELECT COUNT(*)::text AS c
        FROM humid_temp_readings
        WHERE device_id = $1 AND idempotency_key = $2
        `,
        [deviceId, baseReading.idempotency_key]
      );

      expect(count.rows[0].c).toBe("1");
    } finally {
      // rollback the test data to avoid polluting the database
      await client.query("ROLLBACK");
      client.release();
    }
  });

  it("should insert twice if idempotency_key differs", async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const deviceId = BigInt(Date.now() + 1);
      await ensureDeviceExists(
        client,
        deviceId,
        "SENSOR",
        "Test Humid Sensor 2",
        "test_humid_sensor_2"
      );

      const r1 = await insertReading(client, {
        device_id: deviceId,
        temperature: 20,
        humidity: 50,
        receivedAt: new Date(),
        idempotency_key: "k1",
      } as any);

      const r2 = await insertReading(client, {
        device_id: deviceId,
        temperature: 20,
        humidity: 50,
        receivedAt: new Date(),
        idempotency_key: "k2",
      } as any);

      expect(r1).not.toBeNull();
      expect(r2).not.toBeNull();

      const count = await client.query<{ c: string }>(
        `
        SELECT COUNT(*)::text AS c
        FROM humid_temp_readings
        WHERE device_id = $1
        `,
        [deviceId]
      );

      expect(count.rows[0].c).toBe("2");
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  });

  it("should throw if idempotency_key is missing", async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const deviceId = BigInt(Date.now() + 2);
      await ensureDeviceExists(
        client,
        deviceId,
        "SENSOR",
        "Test Humid Sensor 3",
        "test_humid_sensor_3"
      );

      await expect(
        insertReading(client, {
          device_id: deviceId,
          temperature: 20,
          humidity: 50,
          receivedAt: new Date(),
          // idempotency_key intentionally missing
        } as any)
      ).rejects.toThrow("idempotency_key is required");
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  });
});