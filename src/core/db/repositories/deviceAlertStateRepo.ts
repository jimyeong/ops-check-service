
import { pool } from "../pool";
import type { PoolClient } from 'pg';
import type { DeviceAlertState } from "../types";

export async function getDeviceAlertState(device_id: bigint, alert_type: string): Promise<DeviceAlertState | null> {
    const q = `
    SELECT device_alert_state_id, device_id, alert_state, alert_type, last_triggered_at
    FROM device_alert_states
    WHERE device_id = $1
    AND alert_type = $2
    LIMIT 1
    `

    try {
        const result = await pool.query<DeviceAlertState>(q, [device_id, alert_type]);
        return result.rows[0] ?? null;
    } catch (e) {
        throw new Error(e.message);
    }
};
export async function updateDeviceAlertState(client: PoolClient, device_id: bigint, alert_state: boolean, alert_type: string): Promise<DeviceAlertState | null> {
    const q = `
        INSERT INTO device_alert_states (device_id, alert_state, alert_type, last_triggered_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (device_id, alert_type) DO UPDATE
        SET alert_state = EXCLUDED.alert_state,
            last_triggered_at = NOW()
        WHERE device_alert_states.alert_state IS DISTINCT FROM EXCLUDED.alert_state
        RETURNING *
    `;
    // intially alert_state == null, EXCLUDED.alert_state == true ---> (null != true) becomes NULL(falsy) => NO UPDATE!
    try {
        const result = await client.query<DeviceAlertState>(q, [device_id, alert_state, alert_type]);
        console.log("@@1", result.rows[0])
        return result.rows[0] ?? null;
    } catch (e) {
        throw e;
    }
}
