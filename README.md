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

### Example MQTT payload

```json
{
  "temperature": 22.4,
  "humidity": 48,
  "battery": 92,
  "timestamp": "2026-01-05T10:15:00Z"
}