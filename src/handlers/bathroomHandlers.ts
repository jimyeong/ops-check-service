import type { HumidTempReading } from "../domain/types";
import { getDeviceIdentifier } from "../core/db/repositories/deviceIdentifiersRepo";
import { Devices } from "../constants";
import { handleReading } from "../services/readingServices";
import { isHumiditySustainedHigh } from "../core/db/repositories/sensorReadingRepo";
import { ingestReading } from "../services/ingestSensorReading";
import { enqueueOutboxService } from "../services/enqueueOutboxService";
import { transitionAlertStateAndEnqueue } from "../services/alertTransitionService";
import type { MqttMessageHandler } from "../messaging/mqtt.client";
import { saveInboxMessage } from "../core/db/repositories/inboxMessagesRepo";
import type { SmartSocketReading, SmartSocketReadingPayload } from "../domain/sensors/smartSocket";
import { SmartSocketReadingService } from "../services/smartSocketReadingServices";
export async function handleBathroomHumidiyReading(idempotency_key: string, topic, msg: string, onMessage: MqttMessageHandler) {
    try {
        const identifier = await getDeviceIdentifier("topic_name", Devices.TOILET_HUMID_TEMP_SENSOR);
        if (identifier === null) {
            console.error(`Device identifier not found, IGNORE the message, topci: ${topic}`);
            return;
        }
        const device_id = identifier.device_id;
        const payload: HumidTempReading = JSON.parse(msg) as HumidTempReading;
        const receivedAt = new Date();
        const reading: HumidTempReading = {
            idempotency_key: idempotency_key,
            device_id: device_id,
            temperature: payload.temperature,
            humidity: payload.humidity,
            battery: payload.battery,
            linkquality: payload.linkquality ?? 0,
            receivedAt: receivedAt,
            comfort_humidity_min: payload.comfort_humidity_min,
            comfort_temperature_max: payload.comfort_temperature_max,
            comfort_humidity_max: payload.comfort_humidity_max,
            comfort_temperature_min: payload.comfort_temperature_min,
            humidity_calibration: payload.humidity_calibration,
            temperature_calibration: payload.temperature_calibration,
            temperature_units: payload.temperature_units,
            update: payload.update,
        }
        await handleReading(reading, {
            isHumiditySustainedHigh,
            ingestReading,
            enqueueOutboxService,
            transitionAlertStateAndEnqueue,
        })
        await onMessage({ topic, payload: reading, raw: msg, receivedAt: receivedAt });
    } catch (e) {

        let jsonPayload: unknown;
        try { jsonPayload = JSON.parse(msg); } catch (e) {
            console.error(`[mqtt] failed to parse message: ${e}`);
            jsonPayload = { raw: msg };
        }
        try {
            const duplicated = await saveInboxMessage(jsonPayload, idempotency_key);
            if (duplicated) console.log("duplicated inbox message");
        } catch (e) {
            console.error(`[mqtt] failed to save inbox message: ${e}`);
        }
    }
}

export async function handleSmartSocketReading(
    idempotency_key: string,
    topic,
    msg: string,
    label: string,
    topic_name: string,
    onMessage: MqttMessageHandler
) {
    console.log("@@@@label: ", label);
    
    try {

        const identifier = await getDeviceIdentifier("topic_name", topic_name);
        if (identifier === null) {
            console.error(`Device identifier not found, IGNORE the message, topci: ${topic}`);
            return;
        }
        const device_id = identifier.device_id;
        const payload: SmartSocketReadingPayload = JSON.parse(msg) as SmartSocketReadingPayload;
        // console.log("@@payload: ", payload);
        // payload.last_seen = new Date().toISOString();

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
