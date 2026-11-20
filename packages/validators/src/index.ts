export {
  baseEnvSchema,
  gatewayEnvSchema,
  ticketServiceEnvSchema,
  aiServiceEnvSchema,
  notificationServiceEnvSchema,
  loadEnv,
} from './env.js';

export type {
  BaseEnv,
  GatewayEnv,
  TicketServiceEnv,
  AiServiceEnv,
  NotificationServiceEnv,
} from './env.js';

export { registerTenantSchema } from './auth.js';
export type { RegisterTenantInput } from './auth.js';
