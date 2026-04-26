export type RabbitMQOptions = {
    url: string;
}
export const rabbitMQConfig: RabbitMQOptions = {
    url: process.env.CLOUDAMQP_URL as string,
}