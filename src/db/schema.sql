

CREATE TABLE humid_temp_readings (
  id BIGINT PRIMARY KEY,
  device_id BIGINT NOT NULL REFERENCES device(id),
  humidity DOUBLE PRECISION NOT NULL,
  temperature DOUBLE PRECISION,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  linkquality INT NOT NULL
  comfort_humidity_min DOUBLE PRECISION NOT NULL,
  comfort_temperature_max DOUBLE PRECISION NOT NULL,
  comfort_humidity_max DOUBLE PRECISION NOT NULL,
  comfort_temperature_min DOUBLE PRECISION NOT NULL,
  humidity_calibration DOUBLE PRECISION NOT NULL,
  temperature_calibration DOUBLE PRECISION NOT NULL,
  temperature_units TEXT NOT NULL,
  idempotency_key TEXT NOT NULL
)

CREATE TABLE inbox_messages(
    id UUID PRIMARY KEY,
    payload JSONB NOT NULL,
    received_at TIMESTAMPTZ NOT NULL
)
CREATE TABLE devices (
    id BIGINT PRIMARY KEY,
    device_type TEXT NOT NULL, -- ticket name
    display_name TEXT NOT NULL,
    name TEXT NOT NULL
)
CREATE TABLE IF NOT EXISTS device_identifiers (
  id BIGSERIAL PRIMARY KEY,
  device_id BIGINT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  id_type TEXT NOT NULL,
  id_value TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id_type, id_value)
);
CREATE TABLE IF NOT EXISTS alert_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id BIGINT NOT NULL,
    alert_type TEXT NOT NULL,
    window_minutes INT NOT NULL,
    threashold NUMERIC NOT NULL, 
    triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)

CREATE INDEX IF NOT EXISTS idx_device_identifiers_device_id
ON device_identifiers(device_id);
CREATE INDEX IF NOT EXISTS idx_readings_device_time
ON humid_temp_readings(device_id, received_at DESC)

-- just incase you lose your data
CREATE TABLE IF NOT EXISTS inbox_messages(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payload JSONB NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    message_key TEXT NOT NULL
)
CREATE INDEX IF NOT EXISTS idx_inbox_received_at
ON inbox_messages(received_at DESC);

CREATE TABLE IF NOT EXISTS alert_events(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id BIGINT NOT NULL,
    alert_type TEXT NOT NULL,
    window_minutes INT NOT NULL,
    threashold NUMERIC NOT NULL,
    triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
)


SELECT 1
FROM alert_events
WHERE device_id = $1
AND alert_type = 'HUMIDITY_HIGH_SUSTAINED'
AND triggered_at >= NOW() - INTERVAL '2 hours'
LIMIT 1