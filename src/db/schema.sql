CREATE TABLE device (
    id BIGINT PRIMARY KEY,
    name TEXT NOT NULL
)
CREATE TABLE humid_temp_readings (
  id BIGINT PRIMARY KEY,
  device_id BIGINT NOT NULL REFERENCES device(id),
  humidity DOUBLE PRECISION NOT NULL,
  temperature DOUBLE PRECISION,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  linkquality INT NOT NULL,
);

CREATE TABLE inbox_messages(
    id UUID PRIMARY KEY,
    payload JSONB NOT NULL,
    received_at TIMESTAMP NOT NULL
)

CREATE TABLE IF NOT EXISTS alert_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id BIGINT NOT NULL,
    alert_type TEXT NOT NULL,
    window_minutes INT NOT NULL,
    threashold NUMERIC NOT NULL, 
    triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)

SELECT 1
FROM alert_events
WHERE device_id = $1
AND alert_type = 'HUMIDITY_HIGH_SUSTAINED'
AND triggered_at >= NOW() - interval '2 hours'
LIMIT 1