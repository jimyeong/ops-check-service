import type { MqttMessageHandler } from "../messaging/mqtt.client";
import { getDeviceIdentifier } from "../core/db/repositories/deviceIdentifiersRepo";
import type { SmartSocketReadingPayload } from "../domain/sensors/smartSocket";
import type { SmartSocketReading } from "../domain/sensors/smartSocket";
import { SmartSocketReadingService } from "../services/smartSocketReadingServices";

export async function handleSmartSocketReading(
    idempotency_key: string,
    topic,
    msg: string,
    label: string,
    topic_name: string,
    onMessage: MqttMessageHandler
) {
    console.log("[socketSensorsHandler] label: ", label);
    
    try {

        const identifier = await getDeviceIdentifier("topic_name", topic_name);
        if (identifier === null) {
            console.error(`Device identifier not found, IGNORE the message, topci: ${topic}`);
            return;
        }
        const device_id = identifier.device_id;
        const payload: SmartSocketReadingPayload = JSON.parse(msg) as SmartSocketReadingPayload;

        const reading: SmartSocketReading = {
            idempotency_key: idempotency_key,
            device_id: device_id,
            current: payload.current,
            energy: payload.energy,
            energy_month: payload.energy_month,
            energy_today: payload.energy_today,
            energy_yesterday: payload.energy_yesterday,
            linkquality: payload.linkquality,
            outlet_control_protect: payload.outlet_control_protect,
            enable_max_voltage: payload.overload_protection.enable_max_voltage,
            enable_min_current: payload.overload_protection.enable_min_current,
            enable_min_power: payload.overload_protection.enable_min_power,
            enable_min_voltage: payload.overload_protection.enable_min_voltage,
            max_current: payload.overload_protection.max_current,
            max_power: payload.overload_protection.max_power,
            max_voltage: payload.overload_protection.max_voltage,
            min_current: payload.overload_protection.min_current,
            min_power: payload.overload_protection.min_power,
            min_voltage: payload.overload_protection.min_voltage,
            power: payload.power,
            power_on_behavior: payload.power_on_behavior,
            voltage: payload.voltage,
            received_at: payload.last_seen,
            label: label,

        }
        await SmartSocketReadingService(reading);
        await onMessage({ topic, payload: reading, raw: msg, receivedAt: new Date(payload.last_seen) });
    } catch (e) {
        console.error(`[mqtt] failed to handle power socket dehumidifier reading: ${e}`);
    }
}