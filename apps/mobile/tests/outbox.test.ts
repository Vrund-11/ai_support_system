import { describe, it, expect, beforeEach } from 'vitest';
import { offlineOutbox, type OutboxItem } from '../src/lib/outbox.js';
import { secureStorage } from '../src/lib/storage.js';

describe('Mobile Offline Outbox (MOB-6)', () => {
  beforeEach(async () => {
    await secureStorage.clear();
    await offlineOutbox.clear();
  });

  it('enqueues messages when offline and persists in secure storage', async () => {
    const item = await offlineOutbox.enqueue({
      clientId: 'client_msg_001',
      ticketId: 'tkt_123',
      text: 'Offline agent reply',
      isInternal: false,
    });

    expect(item.clientId).toBe('client_msg_001');
    expect(item.retries).toBe(0);

    const queue = await offlineOutbox.load();
    expect(queue).toHaveLength(1);
    expect(queue[0]!.text).toBe('Offline agent reply');
  });

  it('flushes pending messages when online and removes sent items', async () => {
    await offlineOutbox.enqueue({
      clientId: 'msg_1',
      ticketId: 'tkt_1',
      text: 'First message',
      isInternal: false,
    });
    await offlineOutbox.enqueue({
      clientId: 'msg_2',
      ticketId: 'tkt_1',
      text: 'Second message',
      isInternal: true,
    });

    const mockSend = async (item: OutboxItem) => {
      return item.clientId === 'msg_1'; // msg_1 succeeds, msg_2 fails
    };

    const result = await offlineOutbox.flush(mockSend);

    expect(result.sent).toBe(1);
    expect(result.failed).toBe(1);

    const remaining = await offlineOutbox.load();
    expect(remaining).toHaveLength(1);
    expect(remaining[0]!.clientId).toBe('msg_2');
    expect(remaining[0]!.retries).toBe(1);
  });

  it('deduplicates messages with matching clientId on repeated enqueue', async () => {
    const first = await offlineOutbox.enqueue({
      clientId: 'dup_client_1',
      ticketId: 'tkt_dup',
      text: 'Original message',
      isInternal: false,
    });

    const second = await offlineOutbox.enqueue({
      clientId: 'dup_client_1',
      ticketId: 'tkt_dup',
      text: 'Repeated enqueue attempt',
      isInternal: false,
    });

    expect(second.clientId).toBe(first.clientId);
    const queue = await offlineOutbox.load();
    expect(queue).toHaveLength(1);
    expect(queue[0]!.text).toBe('Original message');
  });

  it('preserves strict FIFO ordering during flush delivery', async () => {
    await offlineOutbox.enqueue({
      clientId: 'fifo_1',
      ticketId: 'tkt_fifo',
      text: 'First',
      isInternal: false,
    });
    await offlineOutbox.enqueue({
      clientId: 'fifo_2',
      ticketId: 'tkt_fifo',
      text: 'Second',
      isInternal: false,
    });
    await offlineOutbox.enqueue({
      clientId: 'fifo_3',
      ticketId: 'tkt_fifo',
      text: 'Third',
      isInternal: false,
    });

    const executionOrder: string[] = [];
    const mockSend = async (item: OutboxItem) => {
      executionOrder.push(item.clientId);
      return true;
    };

    const result = await offlineOutbox.flush(mockSend);
    expect(result.sent).toBe(3);
    expect(executionOrder).toEqual(['fifo_1', 'fifo_2', 'fifo_3']);
  });
});
