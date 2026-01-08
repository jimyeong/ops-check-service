export async function insertReading(client, reading) {
    await client.query(`
         INSERT INTO humid_temp_readings (device_id, temperature, humidity, battery, linkquality)
            VALUES ($1, $2, $3, $4, $5)
    `, [reading.device_id, reading.temperature, reading.humidity, reading.battery, reading.linkquality]);
}