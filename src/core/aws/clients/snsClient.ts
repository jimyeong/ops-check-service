import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";
import type { PublishCommandOutput } from "@aws-sdk/client-sns";
import { awsConfig } from "../config";
import { SNS_SUBJECT, SNS_MESSAGE } from '../../../constants/index';

const createSNSClient = (): SNSClient => {
    return new SNSClient(awsConfig)
}

const publishMessage = async (client: SNSClient, message: string, eventType: string): Promise<PublishCommandOutput> => {
    if (!process.env.SNS_TOPIC_ARN) {
        throw new Error("SNS_TOPIC_ARN is not set")
    }

    console.log("NOTIFICATIONS: Publishing message to SNS", message, eventType)
    const command = new PublishCommand({
        TopicArn: process.env.SNS_TOPIC_ARN,
        Message: SNS_MESSAGE,
        Subject: SNS_SUBJECT,
        MessageAttributes: {
            "event_type": {
                DataType: "String",
                StringValue: eventType
            }
        }
    })
    return client.send(command)
}

export { createSNSClient, publishMessage }