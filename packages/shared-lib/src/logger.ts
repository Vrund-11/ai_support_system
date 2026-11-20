import pino from 'pino';

/**
 * Create a structured JSON logger.
 * Every log line includes requestId and tenantId when available.
 */
export function createLogger(serviceName: string, level?: string) {
  return pino({
    name: serviceName,
    level: level ?? process.env['LOG_LEVEL'] ?? 'info',
    // JSON by default; pretty-print in dev if pino-pretty is installed
    transport:
      process.env['NODE_ENV'] === 'development'
        ? { target: 'pino/file', options: { destination: 1 } }
        : undefined,
    formatters: {
      level(label) {
        return { level: label };
      },
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    // Redact sensitive fields
    redact: {
      paths: ['req.headers.authorization', 'req.headers.cookie', 'password', 'passwordHash'],
      censor: '[REDACTED]',
    },
  });
}

export type Logger = pino.Logger;
