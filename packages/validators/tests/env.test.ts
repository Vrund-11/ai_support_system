import { describe, it, expect, vi, afterEach } from 'vitest';
import { loadEnv, baseEnvSchema, ticketServiceEnvSchema } from '../src/env.js';

describe('loadEnv', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parses valid base env', () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('PORT', '3000');
    vi.stubEnv('LOG_LEVEL', 'debug');

    const env = loadEnv(baseEnvSchema);
    expect(env.NODE_ENV).toBe('test');
    expect(env.PORT).toBe(3000);
    expect(env.LOG_LEVEL).toBe('debug');
  });

  it('applies defaults for missing optional fields', () => {
    // Clear env to test defaults
    vi.stubEnv('NODE_ENV', '');
    delete process.env['NODE_ENV'];

    const result = baseEnvSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.NODE_ENV).toBe('development');
      expect(result.data.PORT).toBe(4000);
      expect(result.data.LOG_LEVEL).toBe('info');
    }
  });

  it('exits on invalid env', () => {
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    const mockError = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Missing required fields for ticket-service
    vi.stubEnv('MONGODB_URI', '');
    delete process.env['MONGODB_URI'];
    vi.stubEnv('REDIS_URL', '');
    delete process.env['REDIS_URL'];
    vi.stubEnv('SERVICE_TOKEN', '');
    delete process.env['SERVICE_TOKEN'];

    expect(() => loadEnv(ticketServiceEnvSchema)).toThrow('process.exit called');
    expect(mockExit).toHaveBeenCalledWith(1);
    expect(mockError).toHaveBeenCalled();
  });

  it('coerces PORT string to number', () => {
    const result = baseEnvSchema.safeParse({ PORT: '8080' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.PORT).toBe(8080);
      expect(typeof result.data.PORT).toBe('number');
    }
  });
});
