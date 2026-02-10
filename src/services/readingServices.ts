import type { HumidTempReading } from '../core/db/types';
import { getDeviceAlertState } from '../core/db/repositories/deviceAlertStateRepo';
import { AlertTypes } from '../constants';
type ReadingServicesDeps = {
  isHumiditySustainedHigh: (device_id: bigint) => Promise<boolean>;
  ingestReading: (reading: HumidTempReading) => Promise<void>;
  transitionAlertStateAndEnqueue: (
    device_id: bigint,
    alert_state: boolean,
    event_label: string,
    idempotency_key: string
  ) => Promise<void>;
};
export async function handleReading(
  reading: HumidTempReading,
  device_id: bigint,
  idempotency_key: string,
  deps: ReadingServicesDeps
) {
  const { isHumiditySustainedHigh, ingestReading, transitionAlertStateAndEnqueue } = deps;
  await ingestReading(reading);

  if (reading.humidity == null) return;

  if (reading.humidity >= 60) {
    const isSustainedHigh = await isHumiditySustainedHigh(device_id);
    if (!isSustainedHigh) return;

    await transitionAlertStateAndEnqueue(
      device_id,
      true,
      AlertTypes.HUMIDITY_SENSOR_ALERT,
      idempotency_key
    );
    return;
  }

  const alertState = await getDeviceAlertState(device_id, AlertTypes.HUMIDITY_SENSOR_ALERT);
  if (alertState?.alert_state !== true) return;

  await transitionAlertStateAndEnqueue(
    device_id,
    false,
    AlertTypes.HUMIDITY_SENSOR_ALERT,
    idempotency_key
  );
}
