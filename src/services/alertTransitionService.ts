import { updateDeviceAlertState } from "../core/db/repositories/deviceAlertStateRepo";
import { insertOutboxEvent } from "../core/db/repositories/outboxEventRepo";
import type { JsonObject } from "../types/json";
import { pool } from "../core/db/pool";


export async function transitionAlertStateAndEnqueue(
    device_id: bigint,
    alert_state: boolean,
    event_label: string,
    idempotency_key: string
) {
    const client = await pool.connect();
    try {
        const payload = {
            device_id: device_id.toString(),
            alert_state,
            alert_type: event_label,
        } as JsonObject;
        await client.query("BEGIN");
        // IMPORTANT: `updateDeviceAlertState` should return a row ONLY when the alert_state actually changed.
        // If it returns `null/undefined`, that means "no state change" and we must NOT enqueue an outbox event.
        const res = await updateDeviceAlertState(client, device_id, alert_state, event_label);
        if (res && alert_state === true) {
            await insertOutboxEvent(client, {
                event_type: event_label,
                payload: payload,
                idempotency_key: idempotency_key,
                attempts: 0,
            });
        }
        await client.query("COMMIT");
    } catch (e) {
        await client.query("ROLLBACK");
        throw e;
    } finally {
        client.release();
    }

}