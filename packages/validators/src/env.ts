import { z } from 'zod';

try {
  // Native Node 20+ .env file loader
  if (typeof process.loadEnvFile === 'function') {
    try {
      process.loadEnvFile();
    } catch {}
    try {
      process.loadEnvFile('../../.env');
    } catch {}
    try {
      process.loadEnvFile('../.env');
    } catch {}
  }
} catch {
  // Ignore if .env doesn't exist
}

/**
 * Base env vars shared by all Node services.
 * Each service extends this with its own schema.
 */
export const baseEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

const FORBIDDEN_SECRET_SUBSTRINGS = ['test-', 'default-', 'dev-', 'cluster-secret-'];

function validateProductionSecret(
  val: string | undefined,
  field: string,
  ctx: z.RefinementCtx,
): void {
  if (!val || val.length < 32) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `${field} must be at least 32 characters in production`,
      path: [field],
    });
    return;
  }
  const lower = val.toLowerCase();
  if (FORBIDDEN_SECRET_SUBSTRINGS.some((sub) => lower.includes(sub))) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `${field} contains forbidden dev/test pattern in production (forbidden prefixes: test-, default-, dev-, cluster-secret-)`,
      path: [field],
    });
  }
}

/** Gateway-specific env */
export const gatewayEnvSchema = baseEnvSchema
  .extend({
    PORT: z.preprocess((val) => process.env.GATEWAY_PORT || val, z.coerce.number()).default(4000),
    REDIS_URL: z.string().url(),
    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32),
    SERVICE_TOKEN: z.string().min(16),
    INTERNAL_SERVICE_TOKEN: z.string().optional(),
    TICKET_SERVICE_URL: z.string().url().default('http://localhost:4001'),
    AI_SERVICE_URL: z.string().url().default('http://localhost:4002'),
    ALLOWED_ORIGINS: z.string().default('http://localhost:5173'),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === 'production') {
      validateProductionSecret(data.JWT_ACCESS_SECRET, 'JWT_ACCESS_SECRET', ctx);
      validateProductionSecret(data.JWT_REFRESH_SECRET, 'JWT_REFRESH_SECRET', ctx);
      validateProductionSecret(data.SERVICE_TOKEN, 'SERVICE_TOKEN', ctx);
      if (data.INTERNAL_SERVICE_TOKEN) {
        validateProductionSecret(data.INTERNAL_SERVICE_TOKEN, 'INTERNAL_SERVICE_TOKEN', ctx);
      }
    }
  });

/** Ticket-service env */
export const ticketServiceEnvSchema = baseEnvSchema
  .extend({
    PORT: z
      .preprocess((val) => process.env.TICKET_SERVICE_PORT || val, z.coerce.number())
      .default(4001),
    MONGODB_URI: z.string().min(1),
    REDIS_URL: z.string().url(),
    SERVICE_TOKEN: z.string().min(16),
    INTERNAL_SERVICE_TOKEN: z.string().optional(),
    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32),
    JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
    JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
    S3_ENDPOINT: z.string().optional(),
    S3_BUCKET: z.string().default('supportpilot-files'),
    S3_REGION: z.string().default('ap-south-1'),
    S3_FORCE_PATH_STYLE: z
      .preprocess((val) => val === 'true' || val === true, z.boolean())
      .default(true),
    AWS_ACCESS_KEY_ID: z.string().default('test'),
    AWS_SECRET_ACCESS_KEY: z.string().default('test'),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === 'production') {
      validateProductionSecret(data.JWT_ACCESS_SECRET, 'JWT_ACCESS_SECRET', ctx);
      validateProductionSecret(data.JWT_REFRESH_SECRET, 'JWT_REFRESH_SECRET', ctx);
      validateProductionSecret(data.SERVICE_TOKEN, 'SERVICE_TOKEN', ctx);
      if (data.INTERNAL_SERVICE_TOKEN) {
        validateProductionSecret(data.INTERNAL_SERVICE_TOKEN, 'INTERNAL_SERVICE_TOKEN', ctx);
      }
    }
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
export const notificationServiceEnvSchema = baseEnvSchema
  .extend({
    PORT: z.coerce.number().default(4003),
    REDIS_URL: z.string().url(),
    DATABASE_URL: z.string().min(1),
    SERVICE_TOKEN: z.string().min(16),
    INTERNAL_SERVICE_TOKEN: z.string().optional(),
    WEBHOOK_TRANSPORT: z.enum(['http', 'sqs']).default('http'),
    SQS_WEBHOOK_QUEUE_URL: z.string().optional(),
    SQS_ENDPOINT: z.string().optional(),
    AWS_REGION: z.string().default('us-east-1'),
    WEBHOOK_SIGNING_SECRET: z.string().default('whsec_default_signing_key_32_chars!'),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === 'production') {
      validateProductionSecret(data.SERVICE_TOKEN, 'SERVICE_TOKEN', ctx);
      if (data.INTERNAL_SERVICE_TOKEN) {
        validateProductionSecret(data.INTERNAL_SERVICE_TOKEN, 'INTERNAL_SERVICE_TOKEN', ctx);
      }
    }
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
