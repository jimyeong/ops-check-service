export const HIGH_HUMIDITY_THRESHOLD = 60;
export const MIN_RECENT_READINGS = 10;
export const RECENT_READINGS_INTERVAL = '1 hour'; // 1 minute
// export const RECENT_READINGS_INTERVAL = '1 minute'; // 1 minute
export const HIGH_RATIO_THRESHOLD = 0.9; // 90% of recent readings are above the threshold

export const SNS_SUBJECT = "Humidity Alert";
export const SNS_MESSAGE = `
Humidity has remained above 60% for the past 30 minutes.
This may increase the risk of mould.
Please consider ventilating the area or turning on a dehumidifier.
`





export const enum Devices {
    TOILET_HUMID_TEMP_SENSOR = `0x8c73dafffec86b53`,
    POWER_SOCKET_AIRFRYER = `0xa4c138096415ffff`,


}
export const enum AlertTypes {
    HUMIDITY_SENSOR_ALERT = `humidity_sensor_alert`,
    POWER_SOCKET_AIRFRYER_ALERT = `power_socket_airfryer_alert`,
}
export const enum RabbitMQTopic {
    TOILET_SENSOR_TOPIC = 'lidless.ravens.bathroom'
}

export const enum OutboxEventTypes {
    AMQP_PUBLISH = `amqp_publish`,
    SNS_PUBLISH = `sns_publish`,
}