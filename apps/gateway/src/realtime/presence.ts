import type { Redis } from 'ioredis';

export interface PresenceState {
  userId: string;
  tenantId: string;
  status: 'online' | 'offline';
  lastSeen: string;
}

export class PresenceService {
  private inMemoryPresence = new Map<string, number>(); // userId -> active socket count
  private inMemoryReadReceipts = new Map<string, number>(); // conversationId:userId -> upToSeq

  constructor(private redis?: Redis) {}

  async userConnected(tenantId: string, userId: string): Promise<boolean> {
    const presenceKey = `presence:tenant:${tenantId}`;
    const userSocketsKey = `presence:sockets:${userId}`;

    if (this.redis) {
      const activeSockets = await this.redis.incr(userSocketsKey);
      await this.redis.sadd(presenceKey, userId);
      return activeSockets === 1; // True if this is the first socket (transition to online)
    }

    const count = (this.inMemoryPresence.get(userId) || 0) + 1;
    this.inMemoryPresence.set(userId, count);
    return count === 1;
  }

  async userDisconnected(tenantId: string, userId: string): Promise<boolean> {
    const presenceKey = `presence:tenant:${tenantId}`;
    const userSocketsKey = `presence:sockets:${userId}`;

    if (this.redis) {
      const activeSockets = await this.redis.decr(userSocketsKey);
      if (activeSockets <= 0) {
        await this.redis.del(userSocketsKey);
        await this.redis.srem(presenceKey, userId);
        return true; // Transition to offline
      }
      return false;
    }

    const count = (this.inMemoryPresence.get(userId) || 1) - 1;
    if (count <= 0) {
      this.inMemoryPresence.delete(userId);
      return true;
    }
    this.inMemoryPresence.set(userId, count);
    return false;
  }

  async isUserOnline(tenantId: string, userId: string): Promise<boolean> {
    const presenceKey = `presence:tenant:${tenantId}`;
    if (this.redis) {
      const isMember = await this.redis.sismember(presenceKey, userId);
      return isMember === 1;
    }
    return (this.inMemoryPresence.get(userId) || 0) > 0;
  }

  async recordReadReceipt(conversationId: string, userId: string, upToSeq: number): Promise<void> {
    const readKey = `read:${conversationId}:${userId}`;
    if (this.redis) {
      await this.redis.set(readKey, String(upToSeq));
      return;
    }
    this.inMemoryReadReceipts.set(`${conversationId}:${userId}`, upToSeq);
  }

  async getLatestReadSeq(conversationId: string, userId: string): Promise<number> {
    const readKey = `read:${conversationId}:${userId}`;
    if (this.redis) {
      const val = await this.redis.get(readKey);
      return val ? parseInt(val, 10) : 0;
    }
    return this.inMemoryReadReceipts.get(`${conversationId}:${userId}`) || 0;
  }
}
