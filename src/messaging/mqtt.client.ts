import mqtt from 'mqtt';
import type { MqttClient, IClientOptions } from 'mqtt';

export type MqttSubscriberOptions = {
    url: string;
    topics: string[]
    cleintId?: string;
    username?: string
    password?: string
}

export type MqttMessageHandler = (args: {
    topic: string;
    payload: unknown;
    raw: string
    receivedAt: Date;
}) => Promise<void> | void;

export function startMqttSubscriber(options: MqttSubscriberOptions, onMessage: MqttMessageHandler): { client: MqttClient; stop: () => Promise<void> } {
    const client = mqtt.connect(options.url, {
        clientId: options.cleintId ?? `ops-check-service-${Math.random().toString(16).slice(2)}`,
        username: options.username,
        password: options.password,
        reconnectPeriod: 2000,
    } as IClientOptions);
    client.on('connect', () => {
        client.subscribe(options.topics, { qos: 0 }, err => {
            if (err) {
                console.error(`Failed to subscribe to topics ${options.topics}: ${err}`);
                client.emit("error", err)
            }
        })
    })
    client.on("message", async (topic, buf) => {
        const raw = buf.toString("utf-8");
        let payload: unknown = raw;

        try {
            payload = JSON.parse(raw);
        }catch(err){}

        await onMessage({
            topic,
            payload,
            raw,
            receivedAt: new Date(),
        })
    });
    client.on("error", (err)=>{
        console.error(`MQTT error: `, err);
    });

    async function stop(){
        return new Promise<void>((resolve)=>{
            client.end(true, {}, ()=>resolve())
        })
    }
    return { client, stop };
}