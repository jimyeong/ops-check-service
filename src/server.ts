import { buildApp } from './app.ts';
import { startMqttSubscriber } from './messaging/mqtt.client.ts';

const PORT = Number(process.env.PORT ?? 3000);
const MQTT_URL = process.env.MQTT_URL ?? "mqtt://localhost:1883"

const MQTT_TOPICS = (process.env.MQTT_TOPICS ?? "zigbee2mqtt/#")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

async function main() {
    const app = buildApp();
    await app.listen({ port: PORT, host: "0.0.0.0" });
    console.log(`[http] listening on port ${PORT}`);

    const { stop } = startMqttSubscriber({
        url: MQTT_URL,
        topics: MQTT_TOPICS,
    }, async ({ topic, payload, raw, receivedAt }) => {
        console.log(`[mqtt] topic: ${topic}}`);
    });

    const shutdown = async ()=>{
        console.log(`[shutdown] stopping...`);
        await stop();
        await app.close();
        process.exit(0);
    }

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);

    console.log(`[startup] ready`);
};

main().catch(err=>{
    console.error(err);
    process.exit(1);
})