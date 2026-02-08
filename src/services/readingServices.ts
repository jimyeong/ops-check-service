import type { HumidTempReading } from '../core/db/types';

type ReadingServicesDeps = {
    isHumiditySustainedHigh: (device_id: bigint) => Promise<boolean>;
    ingestReading: (reading: HumidTempReading) => Promise<void>;
    transitionAlertStateAndEnqueue: ( device_id: bigint, alert_state: boolean, event_label, idempotency_key: string) => Promise<void>;
}
export async function handleReading(reading: HumidTempReading, device_id: bigint, idempotency_key, deps: ReadingServicesDeps) {
    const { isHumiditySustainedHigh, ingestReading, transitionAlertStateAndEnqueue } = deps;
    await ingestReading(reading);
    if (reading.humidity && reading.humidity >= 60) {
        const isSustainedHigh = await isHumiditySustainedHigh(device_id);
        if (isSustainedHigh) {
            await transitionAlertStateAndEnqueue(device_id, true, "humidity_level_over_threshold", idempotency_key);
        }
    }
}

