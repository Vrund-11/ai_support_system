// Shared TypeScript types for SupportPilot

/** User roles across the platform */
export type Role = 'PLATFORM_ADMIN' | 'OWNER' | 'LEAD' | 'AGENT' | 'VIEWER';

/** Authenticated user attached to requests */
export interface AuthUser {
  sub: string;
  tenantId: string;
  role: Role;
  [key: string]: unknown;
}

/** Ticket statuses with allowed transitions */
export type TicketStatus = 'NEW' | 'OPEN' | 'PENDING_CUSTOMER' | 'ON_HOLD' | 'RESOLVED' | 'CLOSED';

/** Ticket priority levels */
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

/** Conversation states for live chat */
export type ConversationState = 'AI' | 'WAITING_AGENT' | 'WITH_AGENT' | 'CLOSED';

/** Message sender types */
export type SenderType = 'CUSTOMER' | 'AI' | 'AGENT' | 'SYSTEM';

/** Ticket activity timeline event types */
export type TicketEventType = 'STATUS' | 'PRIORITY' | 'ASSIGN' | 'NOTE' | 'MESSAGE' | 'SLA' | 'TAG';

/** Message or ticket attachment metadata */
export interface Attachment {
  key: string;
  name: string;
  size: number;
  mime: string;
}

/** RAG knowledge chunk citation */
export interface Citation {
  chunkId: string;
  docId: string;
  title: string;
}

/** Channel through which a ticket was created */
export type Channel = 'WIDGET' | 'DASHBOARD' | 'API' | 'EMAIL';

/** Tenant subscription plans */
export type TenantPlan = 'FREE' | 'PRO';

/** Tenant status */
export type TenantStatus = 'ACTIVE' | 'SUSPENDED';

/** User account status */
export type UserStatus = 'ACTIVE' | 'INVITED' | 'SUSPENDED';

/** SLA policy for a priority level (in minutes) */
export interface SlaPolicy {
  firstResponseMin: number;
  resolveMin: number;
}

/** Business hours per day */
export interface BusinessHours {
  day: number; // 0 = Sunday, 1 = Monday, etc.
  start: string; // HH:mm format, e.g. "09:00"
  end: string; // HH:mm format, e.g. "17:00"
}

/** Per-tenant configuration settings */
export interface TenantSettings {
  brand: {
    color: string;
    logoUrl?: string;
  };
  businessHours: BusinessHours[];
  timezone: string;
  sla: Record<TicketPriority, SlaPolicy>;
  aiEnabled: boolean;
  aiThreshold: number; // 0.0 to 1.0
}

/** Registered device push token */
export interface DeviceToken {
  token: string;
  platform: 'IOS' | 'ANDROID' | 'WEB';
  lastSeen: string;
}

/** User notification preferences */
export interface NotificationPrefs {
  email: boolean;
  push: boolean;
  inApp: boolean;
}

/** RFC 7807 problem details error shape */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  /** Additional fields */
  [key: string]: unknown;
}

/** Standard API response envelope */
export interface ApiResponse<T> {
  data: T;
  meta?: {
    cursor?: string;
    hasMore?: boolean;
    total?: number;
  };
}
