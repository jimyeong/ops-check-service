import type { HumidTempReading } from '../core/db/types';
import { getDeviceAlertState } from '../core/db/repositories/deviceAlertStateRepo';
import { AlertTypes, OutboxEventTypes } from '../constants';
import type { OutboxEventInput } from '../core/db/repositories/outboxEventRepo';

type ReadingServicesDeps = {
  isHumiditySustainedHigh: (device_id: bigint) => Promise<boolean>;
  ingestReading: (reading: HumidTempReading) => Promise<void>;
  enqueueOutboxService: (event: OutboxEventInput) => Promise<void>;
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
  const { isHumiditySustainedHigh, ingestReading, enqueueOutboxService, transitionAlertStateAndEnqueue } = deps;
  await ingestReading(reading);
  await enqueueOutboxService({
    event_type: OutboxEventTypes.AMQP_PUBLISH,
    payload: {
      device_id: reading.device_id.toString(),
      temperature: reading.temperature.toString(),
      humidity: reading.humidity.toString(),
      battery: reading.battery.toString(),
      linkquality: reading.linkquality.toString(),
      receivedAt: reading.receivedAt.toISOString(),
    },
    idempotency_key: idempotency_key,
    attempts: 0,
  });

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
    OutboxEventTypes.SNS_PUBLISH,
    idempotency_key
  );
}
