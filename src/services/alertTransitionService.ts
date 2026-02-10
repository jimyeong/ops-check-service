import { getDeviceAlertState, updateDeviceAlertState } from "../core/db/repositories/deviceAlertStateRepo";
import { insertOutboxEvent } from "../core/db/repositories/outboxEventRepo";
import type { JsonObject } from "../types/json";
import { pool } from "../core/db/pool";


export async function transitionAlertStateAndEnqueue( device_id: bigint, alert_state: boolean, event_label, idempotency_key: string) {
    const client = await pool.connect();
    try {
        const payload = {
            device_id: device_id.toString(),
            alert_state: alert_state,
            alert_type: event_label,
        } as JsonObject;
        await client.query("BEGIN");
        await updateDeviceAlertState(client, device_id, alert_state, event_label);
        await insertOutboxEvent(client, {
            event_type: event_label,
            payload: payload,
            idempotency_key: idempotency_key,
            attempts: 0,
        });
        await client.query("COMMIT");
    } catch (e) {
        await client.query("ROLLBACK");
        throw e;
    } finally {
        client.release();
    }

}