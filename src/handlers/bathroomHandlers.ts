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
import type { BathroomReadingPayload } from "../domain/types";

export async function handleBathroomHumidiyReading(idempotency_key: string, topic, msg: string, onMessage: MqttMessageHandler) {
    try {
        const identifier = await getDeviceIdentifier("topic_name", Devices.TOILET_HUMID_TEMP_SENSOR);
        if (identifier === null) {
            console.error(`Device identifier not found, IGNORE the message, topic: ${topic}`);
            return;
        }
        const device_id = identifier.device_id;
        const payload = JSON.parse(msg) as BathroomReadingPayload;
        if (!payload.humidity || !payload.temperature) {
            console.log(`[mqtt] incomplete payload, skipping`);
            return;
        }
        const reading: HumidTempReading = {
            idempotency_key: idempotency_key,
            device_id: device_id,
            temperature: payload.temperature,
            humidity: payload.humidity,
            battery: payload.battery,
            linkquality: payload.linkquality ?? 0,
            received_at: payload.last_seen,
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
        await onMessage({ topic, payload: reading, raw: msg, receivedAt: new Date(payload.last_seen) });
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

