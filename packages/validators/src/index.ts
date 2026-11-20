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

export {
  registerTenantSchema,
  loginSchema,
  refreshSchema,
  logoutSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  resendVerificationSchema,
} from './auth.js';
export type {
  RegisterTenantInput,
  LoginInput,
  RefreshInput,
  LogoutInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  VerifyEmailInput,
  ResendVerificationInput,
} from './auth.js';

export {
  ticketStatusSchema,
  ticketPrioritySchema,
  createTicketSchema,
  updateTicketSchema,
  ticketFilterSchema,
  bulkTicketActionSchema,
} from './ticket.js';
export type {
  CreateTicketInput,
  UpdateTicketInput,
  TicketFilterInput,
  BulkTicketActionInput,
} from './ticket.js';

export {
  createCustomerSchema,
  customerFilterSchema,
  type CreateCustomerInput,
  type CustomerFilterInput,
} from './customer.js';

export {
  inviteTeamMemberSchema,
  updateNotificationPrefsSchema,
  type InviteTeamMemberInput,
  type UpdateNotificationPrefsInput,
} from './team.js';

export {
  ALLOWED_STATUS_TRANSITIONS,
  canTransitionStatus,
  type TicketStatusType,
} from './transitions.js';

export { attachmentSchema, createMessageSchema } from './message.js';
export type { CreateMessageInput } from './message.js';

export {
  presignUploadSchema,
  verifyUploadSchema,
  registerKbDocumentSchema,
  type PresignUploadInput,
  type VerifyUploadInput,
  type RegisterKbDocumentInput,
} from './upload.js';
