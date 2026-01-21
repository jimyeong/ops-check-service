# ops-check-service

A backend service for ingesting, storing, and querying **environmental and operational data** from home and workplace control systems.

The service is built with **Node.js**, **TypeScript**, **Fastify**, and **PostgreSQL**, and consumes sensor data asynchronously via **MQTT**.  
The focus of the project is **backend system design, data modelling, and operational reliability**, rather than hardware control or UI development.

---

## Overview

Home and workplace control systems often rely on repeated manual checks or loosely structured sensor data
(for example temperature, humidity, or basic safety status).

This project models those signals as **structured, time-based records** so that:

- environmental data is captured consistently
- historical state can be queried reliably
- operational decisions are based on stored data rather than transient readings

The backend treats external systems (such as sensors) as **data producers**, and focuses on **validation, persistence, and querying** of operational data.

---

## Architecture Summary
```
SNZB-02D Sensor  
↓(Zigbee)  
Sonoff Zigbee 3.0 USB Dongle Plus (-P)  
↓(Zigbee2MQTT)  
MQTT Broker  
↓   
ops-check-service (Fastify)  
↓PostgreSQL   
```

- Zigbee devices are managed externally via Zigbee2MQTT
- This service **does not control devices**
- MQTT is treated as an **input channel**, similar to HTTP

---

## Tech Stack

- **Runtime:** Node.js
- **Language:** TypeScript
- **Web Framework:** Fastify
- **Database:** PostgreSQL
- **Database Driver:** pg
- **Messaging:** MQTT
- **Deployment:** Railway (managed platform)
- **Architecture Style:** serverless-style managed backend

---

## Project Structure
```
src/
├─ app.ts              # Fastify app setup
├─ server.ts           # Application entry point
│
├─ config/             # Environment configuration
│  └─ env.ts
│
├─ db/                 # PostgreSQL-specific concerns
│  ├─ pool.ts          # Connection pool
│  └─ migrations/      # SQL migrations
│
├─ entities/           # Core domain entities (not ORM models)
│  ├─ location.ts
│  └─ reading.ts
│
├─ repositories/       # Data access layer (SQL + mapping)
│  └─ readings.repo.ts
│
├─ services/           # Business logic and data composition
│  └─ readings.service.ts
│
├─ routes/             # HTTP API layer
│  └─ readings.routes.ts
│
├─ messaging/          # Asynchronous input adapters
│  └─ mqtt.client.ts
│
└─ utils/
```

---

## Domain Model

### Location
Represents a controlled environment, such as:
- a home
- an office
- a specific room or workspace

### Reading
Represents an immutable, time-stamped observation, for example:
- temperature
- humidity
- battery level
- sensor-reported status

Each reading:
- is associated with a location
- originates from an external system
- is stored as historical data

---

## MQTT Integration

Sensor data is ingested asynchronously via **MQTT**.

The backend:
- subscribes to configured MQTT topics
- validates incoming messages
- maps payloads into domain entities
- persists them to PostgreSQL

MQTT is treated purely as a **transport mechanism**.  
All business logic and data ownership remain within the backend service.

### Reliability and Idempotency (QoS1 Handling)

The MQTT subscription is configured with **QoS 1 (at-least-once delivery)**.  
This guarantees that each message is delivered at least once, but it may be delivered **more than once** in the case of network retries or broker reconnection.

To prevent duplicated sensor readings from being stored, the backend implements **idempotent persistence** at the database layer:

- For each incoming MQTT message, a deterministic `idempotency_key` is generated from the message content (e.g. hash of `topic + payload`).
- Each reading is stored with `(device_id, idempotency_key)`.
- A database-level unique constraint enforces that the same logical message can be persisted only once.

```sql
UNIQUE (device_id, idempotency_key)
```

Insert operations use:

```sql
ON CONFLICT (device_id, idempotency_key) DO NOTHING
```

This design ensures:

- **At-least-once delivery** from MQTT (QoS1)
- **Exactly-once persistence** in PostgreSQL
- Safe handling of broker retries, client reconnects, and message redelivery without creating duplicate historical records

The result is a robust ingestion pipeline where transport-level duplication is absorbed by deterministic, idempotent storage semantics.

### Example MQTT payload

```json
{
  "temperature": 22.4,
  "humidity": 48,
  "battery": 92,
  "timestamp": "2026-01-05T10:15:00Z"
}
