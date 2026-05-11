import { pool } from '../../pool';
import type { SmartSocketReading } from '../../../../domain/sensors/smartSocket';

export const insertSmartSocketReading = async (reading: SmartSocketReading): Promise<boolean> => {
    const q = `
        INSERT INTO smart_socket_readings (
            device_id, current, energy, energy_month, energy_today, energy_yesterday, 
            linkquality, outlet_control_protect, enable_max_voltage, 
            enable_min_current, enable_min_power, enable_min_voltage, max_current, 
            max_power, max_voltage, min_current, min_power, min_voltage, power, 
            power_on_behavior, voltage, received_at, idempotency_key, label
        )
        VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 
            $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24
        )
        ON CONFLICT(device_id, idempotency_key) DO NOTHING
    `;

    try {
        await pool.query(q, [
            reading.device_id,
            reading.current,
            reading.energy,
            reading.energy_month,
            reading.energy_today,
            reading.energy_yesterday,
            reading.linkquality,
            reading.outlet_control_protect,
            reading.enable_max_voltage,
            reading.enable_min_current,
            reading.enable_min_power,
            reading.enable_min_voltage,
            reading.max_current,
            reading.max_power,
            reading.max_voltage,
            reading.min_current,
            reading.min_power,
            reading.min_voltage,
            reading.power,
            reading.power_on_behavior,
            reading.voltage,
            reading.received_at,
            reading.idempotency_key,
            reading.label

        ]);
        return true;
    } catch (e) {
        console.error(`Failed to insert smart socket reading: ${e}`);
        return false;
    }

}