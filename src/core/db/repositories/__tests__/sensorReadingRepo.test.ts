import { pool } from "../../pool.ts";
import { ensureDeviceExists } from "../devicesRepo.ts";
import { insertReading } from "../sensorReadingRepo.ts";
import { describe, it, expect } from "vitest";

describe("sensorReadingRepo insertReading (idempotency)", () => {
  it("should insert once and ignore duplicates for same (device_id, idempotency_key)", async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // 준비: 테스트용 device 만들기
      const deviceId = BigInt(Date.now()); // 충분히 유니크
      await ensureDeviceExists(
        client,
        deviceId,
        "SENSOR",
        "Test Humid Sensor",
        "test_humid_sensor"
      );

      // 같은 메시지(=같은 idempotency_key) 2번
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
        idempotency_key: "topic:payload-hash-123", // 테스트용 고정 키
      };

      const r1 = await insertReading(client, baseReading as any);
      expect(r1).not.toBeNull();

      const r2 = await insertReading(client, baseReading as any);
      expect(r2).toBeNull(); // 중복이면 DO NOTHING -> RETURNING 없음 -> null

      // 실제로 1개만 있는지 DB 확인
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
      // 테스트 데이터는 롤백해서 DB 더럽히지 않음
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