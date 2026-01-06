 type HumidTempReading = {
    device: string,
    temperature: number,
    humidity: number,
    battery: number,
    linkquality: string,
    receivedAt: Date,
}

export type { HumidTempReading }