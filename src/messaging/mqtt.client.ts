import mqtt from 'mqtt';
import type { MqttClient, IClientOptions } from 'mqtt';
import type { ToiletHumidTempReading } from '../entities/ToiletHumidTempSensor.ts';

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
        console.log("@@what's options.topics", options);
        client.subscribe("zigbee2mqtt/toilet_humid_temp_sensor", { qos: 0 }, err => {
            if (err) {
                console.error(`Failed to subscribe to topics ${options.topics}: ${err}`);
                client.emit("error", err)
            }
        })
    })
    client.on("message", async (topic, message) => {
        
        const payload: ToiletHumidTempReading = JSON.parse(message.toString()) as ToiletHumidTempReading;
        const device = topic.replace("zigbee2mqtt/", "")
        if (device.startsWith("bridge/")) return ;
        if(typeof payload.temperature !== "number" || typeof payload.humidity !== "number") return ;
        const reading: ToiletHumidTempReading = {
            device,
            temperature: payload.temperature,
            humidity: payload.humidity,
            battery: payload.battery,
            linkquality: payload.linkquality,
            ts: payload.ts,
        }
        await onMessage({topic, payload: reading, raw: message.toString(), receivedAt: new Date()});
        console.log(`[mqtt] received reading: ${JSON.stringify(reading)}`);
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