type HumidTempReading = {
    device_id: bigint,
    temperature: number,
    humidity: number,
    battery: number,
    linkquality: string,
    receivedAt: Date,
}
type Device = {
    id: bigint,
    device: Text
}

export type { HumidTempReading }