import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { publishToSQS, getSQSClient, setSQSClient } from '../src/sqs.js';

describe('@supportpilot/queue sqs publisher', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    setSQSClient(null);
  });

  afterEach(() => {
    process.env = originalEnv;
    setSQSClient(null);
    vi.restoreAllMocks();
  });

  it('publishes a serialized object to SQS and returns the MessageId', async () => {
    const mockSend = vi.fn().mockResolvedValue({ MessageId: 'msg-12345' });
    const mockClient = {
      send: mockSend,
    } as unknown as SQSClient;

    const payload = {
      deliveryId: 'del-001',
      tenantId: 'tenant-abc',
      url: 'https://example.com/webhook',
      event: 'ticket.created',
      payload: { id: 't-1' },
      attempt: 1,
    };

    const result = await publishToSQS(
      'https://sqs.us-east-1.amazonaws.com/123/queue',
      payload,
      mockClient,
    );

    expect(result).toBe('msg-12345');
    expect(mockSend).toHaveBeenCalledTimes(1);
    const sentCommand = mockSend.mock.calls[0][0];
    expect(sentCommand).toBeInstanceOf(SendMessageCommand);
    expect(sentCommand.input).toEqual({
      QueueUrl: 'https://sqs.us-east-1.amazonaws.com/123/queue',
      MessageBody: JSON.stringify(payload),
    });
  });

  it('publishes a raw string message directly without double-encoding', async () => {
    const mockSend = vi.fn().mockResolvedValue({ MessageId: 'msg-str-001' });
    const mockClient = {
      send: mockSend,
    } as unknown as SQSClient;

    const rawString = '{"raw":"json"}';
    const result = await publishToSQS('https://sqs.example.com/queue', rawString, mockClient);

    expect(result).toBe('msg-str-001');
    const sentCommand = mockSend.mock.calls[0][0];
    expect(sentCommand.input.MessageBody).toBe(rawString);
  });

  it('throws an error if queueUrl is missing or invalid', async () => {
    await expect(publishToSQS('', { data: 1 })).rejects.toThrow(
      'queueUrl must be a non-empty string',
    );
    // @ts-expect-error test invalid type
    await expect(publishToSQS(null, { data: 1 })).rejects.toThrow(
      'queueUrl must be a non-empty string',
    );
  });

  it('throws an error if message is null or undefined', async () => {
    await expect(publishToSQS('https://sqs.example.com/queue', null)).rejects.toThrow(
      'message cannot be null or undefined',
    );
    await expect(publishToSQS('https://sqs.example.com/queue', undefined)).rejects.toThrow(
      'message cannot be null or undefined',
    );
  });

  it('throws an error if SQS response does not include a MessageId', async () => {
    const mockClient = {
      send: vi.fn().mockResolvedValue({}),
    } as unknown as SQSClient;

    await expect(
      publishToSQS('https://sqs.example.com/queue', { test: true }, mockClient),
    ).rejects.toThrow('SQS response did not contain a MessageId');
  });

  it('propagates client send errors properly', async () => {
    const mockClient = {
      send: vi.fn().mockRejectedValue(new Error('AWS SQS service unavailable')),
    } as unknown as SQSClient;

    await expect(
      publishToSQS('https://sqs.example.com/queue', { test: true }, mockClient),
    ).rejects.toThrow('AWS SQS service unavailable');
  });

  it('initializes SQSClient singleton with SQS_ENDPOINT override and fallback credentials', async () => {
    process.env['SQS_ENDPOINT'] = 'http://localhost:4566';
    process.env['AWS_REGION'] = 'us-west-2';

    const client = getSQSClient();
    expect(client).toBeDefined();

    // Singleton check
    const secondCall = getSQSClient();
    expect(secondCall).toBe(client);
  });
});
