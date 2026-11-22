import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';

let sqsClientInstance: SQSClient | null = null;

/**
 * Returns a singleton instance of SQSClient configured for either
 * LocalStack/ElasticMQ (via SQS_ENDPOINT override) or AWS.
 */
export function getSQSClient(): SQSClient {
  if (sqsClientInstance) {
    return sqsClientInstance;
  }

  const endpoint = process.env['SQS_ENDPOINT'];
  const region = process.env['AWS_REGION'] ?? 'us-east-1';

  sqsClientInstance = new SQSClient({
    region,
    ...(endpoint ? { endpoint } : {}),
    credentials: {
      accessKeyId: process.env['AWS_ACCESS_KEY_ID'] ?? 'test',
      secretAccessKey: process.env['AWS_SECRET_ACCESS_KEY'] ?? 'test',
    },
  });

  return sqsClientInstance;
}

/**
 * Overrides or resets the SQSClient singleton instance (primarily for tests).
 */
export function setSQSClient(client: SQSClient | null): void {
  sqsClientInstance = client;
}

/**
 * Publishes a message to the specified SQS queue.
 *
 * @param queueUrl - The destination SQS queue URL
 * @param message - The payload object or raw string to publish
 * @param client - Optional SQSClient instance (defaults to singleton getSQSClient())
 * @returns The SQS MessageId assigned to the queued message
 */
export async function publishToSQS(
  queueUrl: string,
  message: unknown,
  client?: SQSClient,
): Promise<string> {
  if (!queueUrl || typeof queueUrl !== 'string') {
    throw new Error('publishToSQS: queueUrl must be a non-empty string');
  }

  if (message === undefined || message === null) {
    throw new Error('publishToSQS: message cannot be null or undefined');
  }

  const messageBody = typeof message === 'string' ? message : JSON.stringify(message);
  const sqs = client ?? getSQSClient();

  const command = new SendMessageCommand({
    QueueUrl: queueUrl,
    MessageBody: messageBody,
  });

  const response = await sqs.send(command);

  if (!response.MessageId) {
    throw new Error('publishToSQS: SQS response did not contain a MessageId');
  }

  return response.MessageId;
}
