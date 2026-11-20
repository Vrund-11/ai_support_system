import { describe, it, expect } from 'vitest';
import { createLogger } from '../src/logger.js';

describe('createLogger', () => {
  it('creates a logger with the given service name', () => {
    const logger = createLogger('test-service', 'silent');
    expect(logger).toBeDefined();
    // pino logger has standard methods
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.debug).toBe('function');
  });

  it('respects the level parameter', () => {
    const logger = createLogger('test-service', 'warn');
    expect(logger.level).toBe('warn');
  });
});
