import { DeviceAlertState } from "../types";
import { pool } from "../pool";
import type { PoolClient } from 'pg';

export async function getDeviceAlertState(device_id: bigint): Promise<DeviceAlertState | null> {
    const q = `
    SELECT device_alert_state_id, device_id, alert_state, alert_type, last_triggered_at
    FROM device_alert_states
    WHERE device_id = $1
    LIMIT 1
    `
    try {
        const result = await pool.query<DeviceAlertState>(q, [device_id]);
        return result.rows[0] ?? null;
    } catch (e) {
        throw e;
    }
};
export async function updateDeviceAlertState(client: PoolClient,device_id: bigint, alert_state: boolean): Promise<DeviceAlertState | null> {
    const q = `
        UPDATE device_alert_states 
        SET alert_state = $1, last_triggered_at = NOW()
        WHERE device_id = $2
        RETURNING *
    `;
    try {
        const result = await client.query<DeviceAlertState>(q, [alert_state, device_id]);
        return result.rows[0] ?? null;
    } catch (e) {
        throw e;
    }
}
