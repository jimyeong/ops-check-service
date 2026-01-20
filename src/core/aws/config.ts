const awsConfig = {
    region: process.env.AWS_REGION ?? "",
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
    },
    endpoint: process.env.AWS_SNS_ENDPOINT,
}
export { awsConfig }
