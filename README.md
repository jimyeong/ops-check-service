# Ops Check Service

A reliability-focused backend service for ingesting, storing, and reasoning over environmental signals — designed to run correctly under noisy sensors, unreliable networks, and long-running operational conditions.

---

## Why this project exists

This project started from a very small but very real problem.

I live in an old flat with poor bathroom ventilation. Moisture accumulates slowly and invisibly, and over time mould began to grow. One day, I found that towels I carefully maintain had been damaged by mould.

The loss itself was minor, but the lesson was not:

> Environmental problems are slow, silent, and invisible — by the time damage is obvious, it is already too late.

Instead of treating it as a one-off inconvenience, I chose to approach it as a backend systems problem:

- Continuously observe environmental signals (humidity, temperature)
- Store data reliably over long periods
- Detect *sustained* risky conditions, not transient spikes
- Trigger notifications only when action is genuinely required
- Remain correct under duplicate messages, retries, and restarts

This repository is the backend foundation for that idea.

---

## What this project is (and is not)

**This is not:**
- A hardware project
- A UI-heavy dashboard
- A demo-only toy system

**This is:**
- A backend system focused on **reliability, correctness, and operational realism**
- A study of idempotency, state transitions, and exactly-once behaviour
- A long-running service designed to tolerate noise, duplication, and failure

---

## Core design goals

- Survive unreliable networks (MQTT QoS1, duplicate delivery)
- Prevent duplicate writes and duplicate notifications
- Make alerting state explicit and queryable
- Avoid race conditions under concurrent workers
- Ensure end-to-end consistency from ingestion → persistence → notification
- Remain debuggable months later using stored state, not memory

---

## Architecture overview

Zigbee Sensor
↓
MQTT (QoS 1, at-least-once)
↓
MQTT Client / Ingestion Logic
↓
PostgreSQL (Idempotent Writes)
↓
Alert State Transition (Atomic)
↓
Outbox Events
↓
Polling Worker
↓
Notification Delivery


---

## Alert logic: sustained conditions & state transitions

Zigbee sensors emit messages **whenever a value changes**. During unstable conditions, this can result in bursts of events.

A naive rule like *“humidity > 60%”* would spam notifications.

This system intentionally avoids that.

### Sustained condition detection

When a reading arrives:

- If `humidity >= 60`, the service queries **the last 1 hour of readings** for that device
- It calculates the ratio of readings above the threshold
- Only if **≥ 90%** of those readings exceed 60% is the condition considered *sustained*

This filters out noise, spikes, and short-lived fluctuations.

### State-based alerting

Each device has a persisted alert state in the database.

- `false → true`  
  → sustained risk detected  
  → **enqueue notification**
- `true → true`  
  → risk continues  
  → **no notification**
- `true → false`  
  → environment recovered  
  → alert re-armed for future incidents

Notifications are triggered **only on state transitions**, not on raw sensor events.

This guarantees:
- No alert spam
- Deterministic behaviour
- Fully auditable alert history

---

## MQTT ingestion & idempotency

MQTT is configured with **QoS 1 (at-least-once delivery)**.

Duplicate messages are expected and treated as normal.

To guarantee exactly-once persistence at the data layer:

- Each incoming reading is assigned a deterministic `idempotency_key`
- The database enforces uniqueness with a constraint
- Inserts use `ON CONFLICT DO NOTHING`

Result:
- Broker redelivery is harmless
- Network retries never corrupt history
- Stored data remains consistent and queryable

---

## Notification system

### Polling worker (intentional design)

Notifications are produced by a background **polling worker**, not event callbacks.

This is deliberate.

Polling:
- Survives restarts
- Is easy to reason about
- Avoids hidden in-memory state
- Works naturally with SQL locking

### Atomic claiming model

Each notification follows a strict lifecycle:

PENDING → CLAIMED → SENT / FAILED


Claiming happens inside a single transaction:

- Select eligible `PENDING` rows
- Transition them to `CLAIMED`
- Only the worker that successfully updates the row owns it

This guarantees:
- Exactly-once delivery at the business level
- Safe parallel workers
- No duplicate notifications
- No lost tasks on crashes or restarts

---

## End-to-end testing philosophy

Tests are written with **Vitest**, but they are **flow-based**, not isolated unit tests.

Each test exercises the full operational path:


Sensor Payload
→ Ingestion
→ Database Persistence
→ Alert State Transition
→ Outbox Event
→ Polling Worker
→ Atomic Claim
→ Notification Dispatch


The tests verify:
- Duplicate MQTT messages do not create duplicate rows
- Alert state transitions occur only once
- Outbox events are claimed atomically
- Retries never violate exactly-once semantics

This validates the system as a **long-running operational service**, not just a collection of functions.

---

## Project structure

src/  
├─ app/  
│ ├─ initApp.ts # App bootstrap  
│ └─ worker.ts # Polling worker entry  
│  
├─ core/  
│ ├─ aws/ # SNS integration  
│ ├─ db/  
│ │ ├─ repositories/ # DB access layer  
│ │ ├─ pool.ts  
│ │ └─ types.ts  
│
├─ db/  
│ └─ schema.sql # Database schema  
│  
├─ messaging/  
│ └─ mqtt.client.ts # MQTT ingestion  
│  
├─ routes/  
│ └─ readings.routes.ts  
│
├─ services/  
│ └─ ingestSensorReading.ts  
│  
├─ utils/  
│ └─ errors.ts  
│  
├─ bootstrap.ts  
└─ server.ts  
  


---

## Tech stack

- Runtime: Node.js
- Language: TypeScript
- Web framework: Fastify
- Database: PostgreSQL
- Messaging: MQTT (QoS 1)
- Notifications: AWS SNS
- Testing: Vitest (flow-based E2E style)
- Deployment: Docker + home mini-server

---

## Deployment (home lab)

The system is designed to run continuously on a small always-on server.

### Docker

docker compose up --build


Brings up:
- Mosquitto (MQTT broker)
- Zigbee2MQTT
- PostgreSQL
- Ops Check Service (API + worker)

### Environment configuration

Set values via `.env.production`:

- `MQTT_URL`
- `DB_*`
- `SNS_TOPIC_ARN`
- `AWS_REGION`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

---

## Philosophy

This project is built around a single belief:

> Real systems fail quietly, slowly, and messily.  
> Good backend design makes those failures observable, contained, and recoverable.

It started with a mould-stained towel —  
and became a study of idempotency, state, and operational truth.

