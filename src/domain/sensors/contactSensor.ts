
export type ContactSensorReading = ContactSensorPayload & {
    idempotency_key: string,
    device_id: bigint,
    received_at: Date,
}

export type ContactSensorPayload = {
    battery: number,
    contact: boolean,
    linkquality: number,
    last_seen: string,
    tamper: boolean,
    voltage: number,
    label: string,
}