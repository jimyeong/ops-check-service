import { pool } from "../core/db/pool";
import type { SmartSocketReading } from "../domain/sensors/smartSocket";
import { insertSmartSocketReading } from "../core/db/repositories/smartSocket/smartSocketReading";

export async function SmartSocketReadingService(reading: SmartSocketReading) {
    try {
        // await client.query("BEGIN");
        await insertSmartSocketReading(reading);
        // await client.query("COMMIT");
    } catch (e) {
        // await client.query("ROLLBACK");
        throw e;
    }
}