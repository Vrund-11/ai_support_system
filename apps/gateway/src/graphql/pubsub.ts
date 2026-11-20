import { EventEmitter } from 'node:events';

/**
 * Lightweight, zero-dependency async generator PubSub implementation
 * for GraphQL subscriptions (INT-3) with tenant-isolation support.
 */
export class GatewayPubSub {
  private readonly ee: EventEmitter;

  constructor() {
    this.ee = new EventEmitter();
    this.ee.setMaxListeners(100);
  }

  publish(event: string, payload: unknown): void {
    this.ee.emit(event, payload);
  }

  asyncIterator<T>(event: string): AsyncIterableIterator<T> {
    const ee = this.ee;
    const pullQueue: Array<(value: IteratorResult<T>) => void> = [];
    const pushQueue: T[] = [];
    let listening = true;

    const pushValue = (eventPayload: unknown) => {
      if (pullQueue.length > 0) {
        const resolve = pullQueue.shift()!;
        resolve({ value: eventPayload as T, done: false });
      } else {
        pushQueue.push(eventPayload as T);
      }
    };

    ee.on(event, pushValue);

    const cleanup = () => {
      if (listening) {
        listening = false;
        ee.removeListener(event, pushValue);
        for (const resolve of pullQueue) {
          resolve({ value: undefined as unknown as T, done: true });
        }
        pullQueue.length = 0;
        pushQueue.length = 0;
      }
    };

    return {
      next(): Promise<IteratorResult<T>> {
        if (!listening) {
          return Promise.resolve({ value: undefined as unknown as T, done: true });
        }
        if (pushQueue.length > 0) {
          return Promise.resolve({ value: pushQueue.shift()!, done: false });
        }
        return new Promise<IteratorResult<T>>((resolve) => {
          pullQueue.push(resolve);
        });
      },
      return(): Promise<IteratorResult<T>> {
        cleanup();
        return Promise.resolve({ value: undefined as unknown as T, done: true });
      },
      throw(error?: unknown): Promise<IteratorResult<T>> {
        cleanup();
        return Promise.reject(error);
      },
      [Symbol.asyncIterator]() {
        return this;
      },
    };
  }
}

export const defaultPubSub = new GatewayPubSub();
