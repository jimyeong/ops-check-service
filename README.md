# Ops Check Service

A backend service for ingesting, storing, and reasoning over environmental and operational signals, designed to run reliably in imperfect, real‑world conditions.

---

## Why this project exists

This project began from a personal and concrete problem.

I live in an old flat, and the bathroom has no proper ventilation. Moisture accumulates easily, and over time mould started to grow. One day, I discovered that my **cherished towels** — items I carefully look after — had been contaminated by mould.

In absolute terms, it was a small loss. But it revealed a larger truth:  
environmental problems are often invisible, slow, and silent. By the time damage becomes visible, it is already too late.

Instead of treating it as a one‑off inconvenience, I decided to approach it as an engineering problem:

- Continuously observe the environment (humidity, temperature, etc.)
- Store signals reliably over long periods
- Detect risky conditions early
- Trigger notifications before irreversible damage occurs

This service is the backend foundation for that idea.

---

## Core focus

This is not a hardware or UI project.  
The focus is on **backend system design under real operational constraints**:

- Unreliable networks (MQTT, QoS1, duplicate delivery)
- Long‑running processes
- Asynchronous ingestion and background workers
- Idempotency and exactly‑once semantics at the data layer
- Race‑condition‑free task claiming
- End‑to‑end consistency from ingestion to notification

---

## Architecture Overview

```
Sensor → MQTT (QoS1) → Ingestion API → PostgreSQL
                                   ↓
                           Polling Notification Worker
                                   ↓
                              Atomic Claim
                                   ↓
                                Delivery
```

---

## Tech Stack

- **Runtime:** Node.js
- **Language:** TypeScript
- **Framework:** Fastify
- **Database:** PostgreSQL
- **Messaging:** MQTT (QoS1)
- **Testing:** Vitest (Vite test runner), flow‑based E2E‑style suites
- **Deployment:** Home Mini Server
- **Style:** Long‑running, reliability‑oriented backend service

---

## Project Structure

```
src/
├─ app/
│  ├─ initApp.ts
│  └─ worker.ts
│
├─ core/
│  ├─ aws/
│  ├─ db/
│  │  ├─ repositories/
│  │  ├─ pool.ts
│  │  └─ types.ts
│
├─ db/
│  └─ schema.sql
│
├─ messaging/
│  └─ mqtt.client.ts
│
├─ routes/
│  └─ readings.routes.ts
│
├─ services/
│  └─ ingestSensorReading.ts
│
├─ types/
│  └─ json.ts
│
├─ utils/
│  └─ errors.ts
│
├─ bootstrap.ts
└─ server.ts
```

---

## MQTT Ingestion & Idempotency

MQTT is configured with **QoS 1 (at‑least‑once delivery)**.  
Duplicate messages are therefore expected and treated as normal behaviour.

To guarantee **exactly‑once persistence** at the database layer:

- Each incoming message is assigned a deterministic `idempotency_key`
- A unique constraint enforces logical uniqueness
- Inserts use `ON CONFLICT DO NOTHING`

This ensures:

- Network retries are harmless
- Broker redelivery does not create duplicates
- Historical data remains consistent and queryable

---

## Notification System

### Polling Worker

Notifications are produced by a background worker that periodically polls the database for conditions that require action (threshold breaches, stale readings, etc.).

### Atomic Claiming Model

Each notification record follows a strict lifecycle:

```
PENDING → CLAIMED → SENT / FAILED
```

Claiming is performed atomically inside a transaction:

- A worker selects rows in `PENDING`
- Transitions them to `CLAIMED`
- Only the worker that successfully updates the row owns it
- Other workers will skip already‑claimed rows

This guarantees:

- Exactly‑once delivery at the business level
- Safe parallel execution of multiple workers
- No duplicate notifications
- No lost or partially processed tasks, even on crashes or restarts

---

## End‑to‑End Flow Testing

Tests are written with **Vitest** and organised as full **business‑flow suites**, not isolated unit tests.

Each suite exercises the complete operational path:

```
Sensor Payload
 → MQTT Publish
 → Ingestion API
 → Database Persistence
 → Polling Worker
 → Atomic Claim
 → Notification Dispatch
```

The tests verify that:

- Duplicate MQTT messages do not create duplicate rows
- Polling selects only eligible `PENDING` records
- Claiming is atomic and exclusive
- Status transitions are linear and consistent
- Retries never violate exactly‑once semantics

These tests validate the system as a **long‑running operational service**, not just a collection of independent components.

---

## Deployment & Real‑World Validation Plan (Home Lab)

The next step for this project is to move beyond local development and validate the system in a real, continuously running environment.

Planned setup:

- Package the entire service using **Docker**
- Deploy it to a **home mini‑server** (always‑on)
- Connect it to real physical sensors (humidity, temperature, etc.)
- Run the system 24/7 to observe:
  - long‑term stability
  - message duplication under QoS1
  - worker recovery after restarts
  - notification correctness under real environmental changes

This stage is intended to verify that the architecture is not only logically correct, but also **operationally resilient** under real network noise, hardware imperfections, and time‑dependent behaviour.

---

## Docker (Mini PC)

### 1) Build and run

```
docker compose up --build
```

This brings up:
- `app` (Fastify + worker)
- `db` (PostgreSQL, initialized with `src/db/schema.sql`)

### 2) Configure environment

Update the `app` service in `docker-compose.yml` with real values:

- `SNS_TOPIC_ARN`
- `AWS_REGION`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `MQTT_URL` (your broker)

### 3) Notes

- The DB schema runs only on the **first** container startup.
- If you change the schema, remove the volume:  
  `docker volume rm ops-check-service_db_data`


---

## Philosophy

This project is built around one idea:

> Real systems fail quietly, slowly, and in messy ways.  
> Good backend design makes those failures observable, contained, and recoverable.

It started from a mould‑stained, cherished towel —  
and became a study of reliability, idempotency, and operational truth.

