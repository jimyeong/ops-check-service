import "./bootstrap.ts";
import { startMqttSubscriber } from './messaging/mqtt.client.ts';
import type { HumidTempReading } from './entities/HumidTempSensor.ts';
import { pool } from './db/pool.ts';
import { buildApp } from './app.ts';
import { insertReading } from './respositories/sensorReadingRepo.ts';


const PORT = Number(process.env.PORT ?? 3000);
const MQTT_URL = process.env.MQTT_URL ?? "mqtt://localhost:1883"
const MQTT_TOPICS = (process.env.MQTT_TOPICS ?? "zigbee2mqtt/#")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
// const MQTT_TOPICS = ["zigbee2mqtt/toilet_humid_temp_sensor"];
const initDB = async () => {
    try{
        await pool.query("SELECT 1");
        console.log(`[db] connected`);
    }catch(e){
        console.error(`[db] error: ${e}`);
        console.error(`[db] error: ${e.message}`);
        process.exit(1);
    }
}

async function main() {
    const app = buildApp();
    await app.listen({ port: PORT, host: "0.0.0.0" });
    console.log(`[http] listening on port ${PORT}`);
    await initDB()
    const { stop } = startMqttSubscriber({
        url: MQTT_URL,
        topics: MQTT_TOPICS,
    }, async ({ topic, payload, raw, receivedAt }) => {
        console.log(`[mqtt] topic: ${topic}`);
        console.log(`[mqtt] payload: ${JSON.stringify(payload)}`);
        console.log(`[mqtt] raw: ${raw}`);
        console.log(`[mqtt] receivedAt: ${receivedAt}`);
        const reading = payload as unknown as HumidTempReading;
        try{
            await insertReading(reading);
        }catch(e){
            console.error(`[mqtt] failed to insert reading: ${e}`);
        }
        console.log(`[mqtt] inserted reading: ${JSON.stringify(reading)}`);
    });

    const shutdown = async () => {
        console.log(`[shutdown] stopping...`);
        await stop();
        await app.close();
        process.exit(0);
    }

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);

    console.log(`[startup] ready`);
};

main().catch(err => {
    console.error(err);
    process.exit(1);
})