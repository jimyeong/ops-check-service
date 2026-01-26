-- Required for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  user_id BIGSERIAL PRIMARY KEY,
  email TEXT UNIQUE,
  phone_number TEXT UNIQUE NOT NULL,
  oauth_provider TEXT NOT NULL,
  oauth_id TEXT,
  UNIQUE (oauth_provider, oauth_id)
);

CREATE TABLE IF NOT EXISTS subscriptions (
  subscription_id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  notification_channel TEXT NOT NULL
    CHECK (notification_channel IN ('sms', 'email')),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, event, notification_channel)
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_event_channel_enabled
  ON subscriptions (event, notification_channel, enabled);

CREATE TABLE IF NOT EXISTS devices (
  id BIGINT PRIMARY KEY,
  device_type TEXT NOT NULL, -- device type / tag name
  display_name TEXT NOT NULL,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS humid_temp_readings (
  id BIGINT PRIMARY KEY,
  device_id BIGINT NOT NULL REFERENCES devices(id),
  humidity DOUBLE PRECISION NOT NULL,
  temperature DOUBLE PRECISION,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  linkquality INT NOT NULL,
  comfort_humidity_min DOUBLE PRECISION NOT NULL,
  comfort_temperature_max DOUBLE PRECISION NOT NULL,
  comfort_humidity_max DOUBLE PRECISION NOT NULL,
  comfort_temperature_min DOUBLE PRECISION NOT NULL,
  humidity_calibration DOUBLE PRECISION NOT NULL,
  temperature_calibration DOUBLE PRECISION NOT NULL,
  temperature_units TEXT NOT NULL,
  idempotency_key TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_readings_device_time
  ON humid_temp_readings(device_id, received_at DESC);

CREATE TABLE IF NOT EXISTS device_identifiers (
  id BIGSERIAL PRIMARY KEY,
  device_id BIGINT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  id_type TEXT NOT NULL,
  id_value TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id_type, id_value)
);

CREATE INDEX IF NOT EXISTS idx_device_identifiers_device_id
  ON device_identifiers(device_id);

CREATE TABLE IF NOT EXISTS alert_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id BIGINT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL,
  window_minutes INT NOT NULL,
  threshold NUMERIC NOT NULL,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- just in case you lose your data
CREATE TABLE IF NOT EXISTS inbox_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payload JSONB NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  message_key TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_inbox_received_at
  ON inbox_messages(received_at DESC);

CREATE TABLE IF NOT EXISTS outbox_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL, -- topic
  payload JSONB NOT NULL,
  attempts INT NOT NULL,
  processed_at TIMESTAMPTZ,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'pending',
  locked_at TIMESTAMPTZ,
  last_error TEXT,
  CONSTRAINT outbox_status_check
    CHECK (status IN ('pending', 'processing', 'done', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_outbox_pending
  ON outbox_events(status, created_at);