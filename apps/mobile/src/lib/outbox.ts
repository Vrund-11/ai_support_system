import { secureStorage } from './storage.js';

export interface OutboxItem {
  clientId: string;
  ticketId: string;
  text: string;
  isInternal: boolean;
  createdAt: number;
  retries: number;
}

export class OfflineOutbox {
  private queueKey = 'supportpilot_offline_outbox';
  private inMemoryQueue: OutboxItem[] = [];

  async load(): Promise<OutboxItem[]> {
    const raw = await secureStorage.getItem(this.queueKey);
    if (raw) {
      try {
        this.inMemoryQueue = JSON.parse(raw);
      } catch {
        this.inMemoryQueue = [];
      }
    }
    return [...this.inMemoryQueue];
  }

  async enqueue(item: Omit<OutboxItem, 'createdAt' | 'retries'>): Promise<OutboxItem> {
    await this.load();
    const existing = this.inMemoryQueue.find((i) => i.clientId === item.clientId);
    if (existing) {
      return existing;
    }
    const newItem: OutboxItem = {
      ...item,
      createdAt: Date.now(),
      retries: 0,
    };
    this.inMemoryQueue.push(newItem);
    await this.persist();
    return newItem;
  }

  async remove(clientId: string): Promise<void> {
    await this.load();
    this.inMemoryQueue = this.inMemoryQueue.filter((item) => item.clientId !== clientId);
    await this.persist();
  }

  async clear(): Promise<void> {
    this.inMemoryQueue = [];
    await secureStorage.deleteItem(this.queueKey);
  }

  getQueue(): OutboxItem[] {
    return [...this.inMemoryQueue];
  }

  private async persist(): Promise<void> {
    await secureStorage.setItem(this.queueKey, JSON.stringify(this.inMemoryQueue));
  }

  /**
   * Flush pending outbox messages against API client (MOB-6).
   * Removes successfully delivered messages and tracks retry counts on network failure.
   */
  async flush(
    sendFn: (item: OutboxItem) => Promise<boolean>,
  ): Promise<{ sent: number; failed: number }> {
    await this.load();
    let sent = 0;
    let failed = 0;

    const remaining: OutboxItem[] = [];

    for (const item of this.inMemoryQueue) {
      try {
        const success = await sendFn(item);
        if (success) {
          sent++;
        } else {
          item.retries += 1;
          remaining.push(item);
          failed++;
        }
      } catch {
        item.retries += 1;
        remaining.push(item);
        failed++;
      }
    }

    this.inMemoryQueue = remaining;
    await this.persist();
    return { sent, failed };
  }
}

export const offlineOutbox = new OfflineOutbox();
