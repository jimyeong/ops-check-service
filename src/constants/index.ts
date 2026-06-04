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


export const enum SensorLabels {
    BATHROOM_WINDOW_CONTACT_SENSOR = "bathroom/window-contact-sensor",
    BATHROOM_FAN_SOCKET = "bathroom/fan-socket",
    UNIVERSAL_DEHUMIDIFIER_SOCKET = "universal/dehumidifier-socket",
    BATHROOM_BATHTUB_SHELF_HUMID_TEMP_SENSOR = "bathroom/bathtub_shelf_humid_temp_sensor",
    BATHROOM_NEAR_WINDOW_HUMID_TEMP_SENSOR = "bathroom/near_window_humid_temp_sensor",
}


export const enum Devices {
    TOILET_HUMID_TEMP_SENSOR = `0x8c73dafffec86b53`,
    TOILET_HUMID_TEMP_NEAR_WINDOW_SENSOR = '0xa4c13809b2b9ffff',
    POWER_SOCKET_DEHUMIDIFIER = `0xa4c138096415ffff`,
    POWER_SOCKET_FAN = `0xa4c1380b8a7cffff`,
    TOILET_WINDOW_SENSOR = `0x983268fffe652a62`
}

export const enum AlertTypes {
    HUMIDITY_SENSOR_ALERT = `humidity_sensor_alert`,
    POWER_SOCKET_DEHUMIDIFIER_ALERT = `power_socket_airfryer_alert`,

}
export const enum RabbitMQTopic {
    TOILET_SENSOR_TOPIC = 'lidless.ravens.bathroom'
}

export const enum OutboxEventTypes {
    AMQP_PUBLISH = `amqp_publish`,
    SNS_PUBLISH = `sns_publish`,
}
export const enum EventTypes {
    FAN_ON = `fan/on`,
    FAN_OFF = `fan/off`,
    AMQP_PUBLISH = `amqp_publish`,
    SNS_PUBLISH = `sns_publish`,
}
export const enum Topics {
    ZIGBEE2MQTT = `zigbee2mqtt/`,
    OPSCHECK = `opscheck/`,
}
export const enum PublishTopics {
    FAN_ON = `opscheck/events/fan/on`,
    FAN_OFF = `opscheck/events/fan/off`,
}
