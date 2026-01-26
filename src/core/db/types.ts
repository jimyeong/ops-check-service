import type { JsonValue } from "../../types/json"

export type HumidTempReading = {
    idempotency_key: string,
    device_id: bigint,
    temperature: number,
    humidity: number,
    battery: number,
    linkquality: string,
    comfort_humidity_min: number,
    comfort_temperature_max: number,
    comfort_humidity_max: number,
    comfort_temperature_min: number,
    humidity_calibration: number,
    temperature_calibration: number,
    temperature_units: "celsius" | "fahrenheit",
    receivedAt: Date,
    update: UpdateNotification,
}
export type UpdateNotification = {
    installed_version: number,
    latest_version: number,
    state: "idle" | "updating" | "error",
}
export type Devices = {
    id: bigint,
    device: string,
    display_name: string,
    name: string,
}
export type DeviceIdentifier = {
    device_id: bigint,
    id_type: string,
    id_value: string,
    created_at: Date,
}
export type OutboxEvent = {
    id: string,
    event_type: string,
    payload: JsonValue,
    status: "pending" | "processed" | "failed",
    idempotency_key: string,
    processed_at: Date | null,
    attempts: number,
    created_at: Date,
    available_at: Date,
    locked_at: Date,
    last_error: string,
}
