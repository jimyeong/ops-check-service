import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";
import type { PublishCommandOutput } from "@aws-sdk/client-sns";
import { awsConfig } from "../config";

const createSNSClient = (): SNSClient => {
    return new SNSClient(awsConfig)
}

const publishMessage = async (client: SNSClient, message: string): Promise<PublishCommandOutput> => {
    if (!process.env.SNS_TOPIC_ARN) {
        throw new Error("SNS_TOPIC_ARN is not set")
    }

    const command = new PublishCommand({
        TopicArn: process.env.SNS_TOPIC_ARN,
        Message: message,
        Subject: "Notification"
    })
    return client.send(command)
}

export { createSNSClient, publishMessage }