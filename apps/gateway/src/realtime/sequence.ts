import type { Redis } from 'ioredis';

export interface StoredMessage {
  id: string;
  conversationId: string;
  tenantId: string;
  seq: number;
  clientId?: string;
  senderType: string;
  senderId?: string;
  body: string;
  createdAt: string;
  [key: string]: unknown;
}

export class SequenceService {
  private inMemorySeqs = new Map<string, number>();
  private inMemoryMessages = new Map<string, StoredMessage[]>();
  private processedClientIds = new Map<string, number>(); // conversationId:clientId -> seq

  constructor(private redis?: Redis) {}

  async getNextSeq(conversationId: string): Promise<number> {
    if (this.redis) {
      return this.redis.incr(`seq:${conversationId}`);
    }
    const current = (this.inMemorySeqs.get(conversationId) || 0) + 1;
    this.inMemorySeqs.set(conversationId, current);
    return current;
  }

  async getCurrentSeq(conversationId: string): Promise<number> {
    if (this.redis) {
      const val = await this.redis.get(`seq:${conversationId}`);
      return val ? parseInt(val, 10) : 0;
    }
    return this.inMemorySeqs.get(conversationId) || 0;
  }

  async isDuplicateClientMessage(
    conversationId: string,
    clientId?: string,
  ): Promise<number | null> {
    if (!clientId) return null;
    const dedupeKey = `dedupe:${conversationId}:${clientId}`;

    if (this.redis) {
      const existingSeq = await this.redis.get(dedupeKey);
      if (existingSeq) {
        return parseInt(existingSeq, 10);
      }
      return null;
    }

    const seq = this.processedClientIds.get(`${conversationId}:${clientId}`);
    return seq !== undefined ? seq : null;
  }

  async markClientMessageProcessed(
    conversationId: string,
    clientId: string,
    seq: number,
  ): Promise<void> {
    const dedupeKey = `dedupe:${conversationId}:${clientId}`;
    if (this.redis) {
      // Keep dedupe key for 24 hours
      await this.redis.set(dedupeKey, String(seq), 'EX', 86400);
      return;
    }
    this.processedClientIds.set(`${conversationId}:${clientId}`, seq);
  }

  async saveMessage(conversationId: string, message: StoredMessage): Promise<void> {
    const zsetKey = `conv:${conversationId}:msgs`;
    const serialized = JSON.stringify(message);

    if (this.redis) {
      await this.redis.zadd(zsetKey, message.seq, serialized);
      // Retain messages in Redis cache for 7 days
      await this.redis.expire(zsetKey, 7 * 86400);
      return;
    }

    const list = this.inMemoryMessages.get(conversationId) || [];
    list.push(message);
    list.sort((a, b) => a.seq - b.seq);
    this.inMemoryMessages.set(conversationId, list);
  }

  async getMessagesSince(conversationId: string, lastSeq: number): Promise<StoredMessage[]> {
    const zsetKey = `conv:${conversationId}:msgs`;

    if (this.redis) {
      // zrangebyscore with (lastSeq +inf to strictly get messages after lastSeq
      const rawMessages = await this.redis.zrangebyscore(zsetKey, `(${lastSeq}`, '+inf');
      return rawMessages.map((raw) => JSON.parse(raw) as StoredMessage);
    }

    const list = this.inMemoryMessages.get(conversationId) || [];
    return list.filter((m) => m.seq > lastSeq);
  }
}
