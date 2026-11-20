import { z } from 'zod';

/**
 * Base env vars shared by all Node services.
 * Each service extends this with its own schema.
 */
export const baseEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

/** Gateway-specific env */
export const gatewayEnvSchema = baseEnvSchema.extend({
  PORT: z.coerce.number().default(4000),
  REDIS_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  SERVICE_TOKEN: z.string().min(16),
  ALLOWED_ORIGINS: z.string().default('http://localhost:5173'),
});

/** Ticket-service env */
export const ticketServiceEnvSchema = baseEnvSchema.extend({
  PORT: z.coerce.number().default(4001),
  MONGODB_URI: z.string().min(1),
  REDIS_URL: z.string().url(),
  SERVICE_TOKEN: z.string().min(16),
});

/** AI-service env (Python uses Pydantic, but we define the shape here for reference) */
export const aiServiceEnvSchema = baseEnvSchema.extend({
  PORT: z.coerce.number().default(4002),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().url(),
  LLM_PROVIDER: z.enum(['mock', 'gemini', 'openai']).default('mock'),
  GEMINI_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  S3_ENDPOINT: z.string().optional(),
  S3_BUCKET: z.string().default('supportpilot-files'),
  AWS_REGION: z.string().default('ap-south-1'),
});

/** Notification-service env */
export const notificationServiceEnvSchema = baseEnvSchema.extend({
  PORT: z.coerce.number().default(4003),
  REDIS_URL: z.string().url(),
  DATABASE_URL: z.string().min(1),
  SERVICE_TOKEN: z.string().min(16),
});

export type BaseEnv = z.infer<typeof baseEnvSchema>;
export type GatewayEnv = z.infer<typeof gatewayEnvSchema>;
export type TicketServiceEnv = z.infer<typeof ticketServiceEnvSchema>;
export type AiServiceEnv = z.infer<typeof aiServiceEnvSchema>;
export type NotificationServiceEnv = z.infer<typeof notificationServiceEnvSchema>;

/**
 * Parse and validate env vars. Fails fast with clear errors if invalid.
 * Call at service startup before anything else.
 */
export function loadEnv<T extends z.ZodTypeAny>(schema: T): z.infer<T> {
  const result = schema.safeParse(process.env);
  if (!result.success) {
    const formatted = result.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    console.error(`❌ Invalid environment variables:\n${formatted}`);
    process.exit(1);
  }
  return result.data as z.infer<T>;
}
