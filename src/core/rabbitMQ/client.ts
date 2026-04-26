
import amqp from "amqplib";
import { rabbitMQConfig } from "./config";
import type { RabbitMQOptions } from "./config";
import type { FastifyInstance } from "fastify";

export type RabbitMQClientType = {
    
    connection: amqp.Connection,
    channel: amqp.Channel
}

export async function rabbitMQInit() {
    try {
        const connection = await amqp.connect(rabbitMQConfig.url, {
            clientProperties: {
                connection_name: "ops-check-service",
            },
            heartbeat: 60,
            timeout: 10000
        })
        const channel = await connection.createChannel()
        console.log(" [v] Connection established with custom config");
        return { connection, channel }
    } catch (error) {
        console.error(" [x] Error connecting to RabbitMQ", error)
        throw error
    }
}