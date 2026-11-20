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

export { registerTenantSchema, loginSchema, refreshSchema, logoutSchema } from './auth.js';
export type { RegisterTenantInput, LoginInput, RefreshInput, LogoutInput } from './auth.js';

export {
  ticketStatusSchema,
  ticketPrioritySchema,
  createTicketSchema,
  updateTicketSchema,
  ticketFilterSchema,
} from './ticket.js';
export type { CreateTicketInput, UpdateTicketInput, TicketFilterInput } from './ticket.js';

export {
  ALLOWED_STATUS_TRANSITIONS,
  canTransitionStatus,
  type TicketStatusType,
} from './transitions.js';
