import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  loadEnv,
  baseEnvSchema,
  ticketServiceEnvSchema,
  gatewayEnvSchema,
  notificationServiceEnvSchema,
  aiServiceEnvSchema,
} from '../src/env.js';

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

  describe('aiServiceEnvSchema', () => {
    it('applies defaults for ai-service env', () => {
      const result = aiServiceEnvSchema.safeParse({
        DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/supportpilot',
        REDIS_URL: 'redis://localhost:6379',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.PORT).toBe(4002);
        expect(result.data.LLM_PROVIDER).toBe('mock');
        expect(result.data.S3_BUCKET).toBe('supportpilot-files');
        expect(result.data.AWS_REGION).toBe('ap-south-1');
      }
    });

    it('accepts explicit configuration for gemini and openai', () => {
      const result = aiServiceEnvSchema.safeParse({
        DATABASE_URL: 'postgresql://localhost:5432/supportpilot',
        REDIS_URL: 'redis://localhost:6379',
        LLM_PROVIDER: 'gemini',
        GEMINI_API_KEY: 'test-gemini-key',
        S3_ENDPOINT: 'http://localhost:4566',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.LLM_PROVIDER).toBe('gemini');
        expect(result.data.GEMINI_API_KEY).toBe('test-gemini-key');
        expect(result.data.S3_ENDPOINT).toBe('http://localhost:4566');
      }
    });

    it('rejects invalid LLM_PROVIDER or missing DATABASE_URL', () => {
      expect(
        aiServiceEnvSchema.safeParse({
          DATABASE_URL: '',
          REDIS_URL: 'redis://localhost:6379',
        }).success,
      ).toBe(false);

      expect(
        aiServiceEnvSchema.safeParse({
          DATABASE_URL: 'postgresql://localhost:5432/supportpilot',
          REDIS_URL: 'redis://localhost:6379',
          LLM_PROVIDER: 'anthropic' as any,
        }).success,
      ).toBe(false);
    });
  });

  describe('production secret guard', () => {
    const valid32Secret1 = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4';
    const valid32Secret2 = 'f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3';
    const valid32Secret3 = '9876543210abcdef9876543210abcdef';
    const valid32Secret4 = 'abcdef1234567890abcdef1234567890';

    it('rejects short secrets (<32 chars) in production', () => {
      const result = gatewayEnvSchema.safeParse({
        NODE_ENV: 'production',
        PORT: 4000,
        REDIS_URL: 'redis://localhost:6379',
        JWT_ACCESS_SECRET: valid32Secret1,
        JWT_REFRESH_SECRET: valid32Secret2,
        SERVICE_TOKEN: 'short-secret-16c', // only 16 chars
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some((i) => i.message.includes('must be at least 32 characters')),
        ).toBe(true);
      }
    });

    it('rejects dev prefixes (test-, default-, dev-, cluster-secret-) in production', () => {
      const devTokens = [
        'test-abcdef0123456789abcdef01234567',
        'default-0123456789abcdef0123456789a',
        'dev-super-secure-token-length-32-chars',
        'cluster-secret-service-token-32-chars!',
      ];

      for (const token of devTokens) {
        const result = ticketServiceEnvSchema.safeParse({
          NODE_ENV: 'production',
          MONGODB_URI: 'mongodb://localhost:27017/supportpilot',
          REDIS_URL: 'redis://localhost:6379',
          JWT_ACCESS_SECRET: valid32Secret1,
          JWT_REFRESH_SECRET: valid32Secret2,
          SERVICE_TOKEN: token,
        });

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(
            result.error.issues.some((i) => i.message.includes('forbidden dev/test pattern')),
          ).toBe(true);
        }
      }
    });

    it('validates INTERNAL_SERVICE_TOKEN in production across schemas', () => {
      // Gateway with short INTERNAL_SERVICE_TOKEN
      const invalidGateway = gatewayEnvSchema.safeParse({
        NODE_ENV: 'production',
        PORT: 4000,
        REDIS_URL: 'redis://localhost:6379',
        JWT_ACCESS_SECRET: valid32Secret1,
        JWT_REFRESH_SECRET: valid32Secret2,
        SERVICE_TOKEN: valid32Secret3,
        INTERNAL_SERVICE_TOKEN: 'short-token-16c',
      });
      expect(invalidGateway.success).toBe(false);

      // Ticket service with valid vs invalid INTERNAL_SERVICE_TOKEN
      const invalidTicket = ticketServiceEnvSchema.safeParse({
        NODE_ENV: 'production',
        MONGODB_URI: 'mongodb://localhost:27017/supportpilot',
        REDIS_URL: 'redis://localhost:6379',
        JWT_ACCESS_SECRET: valid32Secret1,
        JWT_REFRESH_SECRET: valid32Secret2,
        SERVICE_TOKEN: valid32Secret3,
        INTERNAL_SERVICE_TOKEN: 'dev-token-that-is-longer-than-32-chars',
      });
      expect(invalidTicket.success).toBe(false);

      const validTicket = ticketServiceEnvSchema.safeParse({
        NODE_ENV: 'production',
        MONGODB_URI: 'mongodb://localhost:27017/supportpilot',
        REDIS_URL: 'redis://localhost:6379',
        JWT_ACCESS_SECRET: valid32Secret1,
        JWT_REFRESH_SECRET: valid32Secret2,
        SERVICE_TOKEN: valid32Secret3,
        INTERNAL_SERVICE_TOKEN: valid32Secret4,
      });
      expect(validTicket.success).toBe(true);
    });

    it('validates notificationServiceEnvSchema in production mode', () => {
      // Rejects short SERVICE_TOKEN in production
      const shortServiceToken = notificationServiceEnvSchema.safeParse({
        NODE_ENV: 'production',
        PORT: 4003,
        REDIS_URL: 'redis://localhost:6379',
        DATABASE_URL: 'postgresql://localhost:5432/supportpilot',
        SERVICE_TOKEN: 'service-tok-16ch',
      });
      expect(shortServiceToken.success).toBe(false);

      // Rejects dev- pattern in production
      const devPattern = notificationServiceEnvSchema.safeParse({
        NODE_ENV: 'production',
        PORT: 4003,
        REDIS_URL: 'redis://localhost:6379',
        DATABASE_URL: 'postgresql://localhost:5432/supportpilot',
        SERVICE_TOKEN: 'dev-abcdef0123456789abcdef01234567',
      });
      expect(devPattern.success).toBe(false);

      // Rejects invalid INTERNAL_SERVICE_TOKEN in production
      const invalidInternal = notificationServiceEnvSchema.safeParse({
        NODE_ENV: 'production',
        PORT: 4003,
        REDIS_URL: 'redis://localhost:6379',
        DATABASE_URL: 'postgresql://localhost:5432/supportpilot',
        SERVICE_TOKEN: valid32Secret1,
        INTERNAL_SERVICE_TOKEN: 'cluster-secret-short',
      });
      expect(invalidInternal.success).toBe(false);

      // Accepts valid production configuration
      const validProd = notificationServiceEnvSchema.safeParse({
        NODE_ENV: 'production',
        PORT: 4003,
        REDIS_URL: 'redis://localhost:6379',
        DATABASE_URL: 'postgresql://localhost:5432/supportpilot',
        SERVICE_TOKEN: valid32Secret1,
        INTERNAL_SERVICE_TOKEN: valid32Secret2,
      });
      expect(validProd.success).toBe(true);
    });

    it('accepts valid 32+ char production secrets without forbidden patterns', () => {
      const result = gatewayEnvSchema.safeParse({
        NODE_ENV: 'production',
        PORT: 4000,
        REDIS_URL: 'redis://localhost:6379',
        JWT_ACCESS_SECRET: valid32Secret1,
        JWT_REFRESH_SECRET: valid32Secret2,
        SERVICE_TOKEN: valid32Secret3,
      });

      expect(result.success).toBe(true);
    });

    it('allows dev/test secrets in development mode', () => {
      const result = notificationServiceEnvSchema.safeParse({
        NODE_ENV: 'development',
        PORT: 4003,
        REDIS_URL: 'redis://localhost:6379',
        DATABASE_URL: 'postgresql://localhost:5432/supportpilot',
        SERVICE_TOKEN: 'dev-token-16-chars',
      });

      expect(result.success).toBe(true);
    });
  });
});
