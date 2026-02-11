# Ops Check Service

A reliability-focused backend service for ingesting, storing, and reasoning over environmental signals — designed to run correctly under noisy sensors, unreliable networks, and long-running operational conditions.

> **Status:** In active development. Core ingestion, alerting, and notification pipelines are implemented and tested.

---

## Origin Story

This project started from a very small but very real problem.

I live in an old flat with poor bathroom ventilation. Moisture accumulated slowly and invisibly, and over time mould began to grow — eventually damaging towels I had carefully maintained.

The loss itself was minor, but the lesson was not: **environmental problems are slow, silent, and invisible. By the time damage is obvious, it is already too late.**

Instead of treating it as a one-off inconvenience, I chose to approach it as a backend systems problem:

- Continuously observe environmental signals (humidity, temperature)
- Store data reliably over long periods
- Detect *sustained* risky conditions, not transient spikes
- Trigger notifications only when action is genuinely required
- Remain correct under duplicate messages, retries, and restarts

## What This Project Is (and Is Not)

**Not** a hardware project, a UI dashboard, or a demo-only toy.

**It is** a backend system built as a study of idempotency, state transitions, and exactly-once semantics — exercised through a real-world environmental monitoring use case.

## Core Design Goals

| Goal | Approach |
|---|---|
| Survive unreliable delivery | MQTT QoS 1 + deterministic idempotency keys + `ON CONFLICT DO NOTHING` |
| No duplicate notifications | Explicit alert state machine with transition-only triggers |
| Safe concurrency | Atomic claim model with SQL-level locking |
| Debuggable months later | All state persisted and queryable — no in-memory assumptions |

## Architecture

```
Zigbee Sensor
     ↓
MQTT Broker (QoS 1, at-least-once)
     ↓
Ingestion Service ── deterministic idempotency_key
     ↓
PostgreSQL (unique constraint → exactly-once write)
     ↓
Alert State Machine (atomic transition)
     ↓
Outbox Table
     ↓
Polling Worker (SELECT ... FOR UPDATE)
     ↓
AWS SNS Notification
```

## Key Design Decisions

### Sustained Condition Detection

A naive "humidity > 60%" rule would spam notifications under noisy sensor data. This system takes a different approach:

1. When a reading arrives at or above threshold, query the last **1 hour** of readings for that device
2. Calculate the ratio of readings exceeding the threshold
3. Only trigger if **≥ 90%** of readings are above threshold

This filters out spikes, short-lived fluctuations, and sensor noise.

### State-Based Alerting

Each device maintains a persisted alert state. Notifications fire **only on state transitions**:

| Previous | Current | Action |
|---|---|---|
| `false` | `true` | Sustained risk detected → enqueue notification |
| `true` | `true` | Risk continues → no action |
| `true` | `false` | Recovered → re-arm for future incidents |

This guarantees no alert spam and a fully auditable alert history.

### Polling Worker over Event Callbacks

The notification worker uses **polling**, not in-process event callbacks. This is deliberate:

- Survives process restarts without losing pending work
- Avoids hidden in-memory state
- Works naturally with SQL-based locking (`SELECT ... FOR UPDATE`)

Each notification follows a strict lifecycle:

```
PENDING → CLAIMED → SENT / FAILED
```

Claiming is transactional — only the worker that successfully updates the row owns it. This makes parallel workers safe by default.

### Idempotent Ingestion

MQTT QoS 1 guarantees at-least-once delivery, meaning **duplicates are expected**. The system handles this at the data layer:

- Each reading gets a deterministic `idempotency_key`
- PostgreSQL enforces uniqueness via constraint
- Inserts use `ON CONFLICT DO NOTHING`

Broker redelivery and network retries are harmless by design.

## Testing Approach

Tests are **flow-based**, not isolated unit tests. Each test exercises the full operational path:

```
Sensor Payload → Ingestion → DB Persistence → Alert Transition → Outbox Event → Polling Worker → Atomic Claim → Notification Dispatch
```

Key assertions:
- Duplicate MQTT messages do not create duplicate rows
- Alert state transitions occur exactly once
- Outbox events are claimed atomically
- Retries never violate exactly-once semantics

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js + TypeScript |
| Web Framework | Fastify |
| Database | PostgreSQL |
| Messaging | MQTT (QoS 1) |
| Notifications | AWS SNS |
| Testing | Vitest |
| Deployment | Docker Compose |

## Project Structure

```
src/
├─ app/
│  ├─ initApp.ts              # Application bootstrap & lifecycle
│  └─ worker.ts               # Background polling worker
├─ constants/
│  └─ index.ts                # Domain constants (device IDs, alert types)
├─ core/
│  ├─ aws/                    # AWS clients (SNS)
│  └─ db/
│     ├─ repositories/        # Persistence layer (SQL behind repos)
│     ├─ pool.ts              # PostgreSQL connection pool
│     └─ types.ts             # DB-level types
├─ db/
│  └─ schema.sql              # Database schema & constraints
├─ messaging/
│  └─ mqtt.client.ts          # MQTT subscription & ingestion
├─ routes/
│  └─ readings.routes.ts      # HTTP ingestion endpoints
├─ services/
│  ├─ ingestSensorReading.ts  # Ingestion orchestration
│  ├─ alertTransitionService.ts # State transitions + outbox
│  └─ readingsService.ts      # Domain-level reading logic
├─ types/
│  └─ json.ts                 # External payload types
├─ utils/
│  └─ errors.ts               # Error helpers
├─ bootstrap.ts               # Startup wiring
└─ server.ts                  # HTTP server entry point
```

## Getting Started

```bash
docker compose up --build
```

This brings up Mosquitto (MQTT broker), Zigbee2MQTT, PostgreSQL, and the Ops Check Service (API + worker).

Configure via `.env.production`:

```
MQTT_URL=
DB_HOST=
DB_PORT=
DB_NAME=
DB_USER=
DB_PASSWORD=
SNS_TOPIC_ARN=
AWS_REGION=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
```

## Roadmap

- [ ] Historical dashboard — time-series visualization of readings and alert events
- [ ] Multi-device support — generalize alert rules beyond a single sensor
- [ ] Configurable thresholds — per-device threshold and window settings via API
- [ ] Dead sensor detection — alert when a device stops reporting
- [ ] Grafana integration — export metrics for long-term operational visibility
- [ ] Load testing — validate behaviour under sustained high-throughput ingestion

---

*This project is built around a single belief: real systems fail quietly, slowly, and messily. Good backend design makes those failures observable, contained, and recoverable.*
