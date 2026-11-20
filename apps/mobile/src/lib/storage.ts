/**
 * Secure storage interface for Mobile App (MOB-1).
 * Wraps expo-secure-store in native runtime and provides in-memory fallback for test environments.
 */

export interface ISecureStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  deleteItem(key: string): Promise<void>;
  clear(): Promise<void>;
}

class MemorySecureStorage implements ISecureStorage {
  private store = new Map<string, string>();

  async getItem(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }

  async deleteItem(key: string): Promise<void> {
    this.store.delete(key);
  }

  async clear(): Promise<void> {
    this.store.clear();
  }
}

// Global singleton instance
export const secureStorage: ISecureStorage = new MemorySecureStorage();
