// Shared TypeScript types for SupportPilot
// Add types as features are built

/** User roles across the platform */
export type Role = 'PLATFORM_ADMIN' | 'OWNER' | 'LEAD' | 'AGENT' | 'VIEWER';

/** Ticket statuses with allowed transitions */
export type TicketStatus = 'NEW' | 'OPEN' | 'PENDING_CUSTOMER' | 'ON_HOLD' | 'RESOLVED' | 'CLOSED';

/** Ticket priority levels */
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

/** Conversation states for live chat */
export type ConversationState = 'AI' | 'WAITING_AGENT' | 'WITH_AGENT' | 'CLOSED';

/** Message sender types */
export type SenderType = 'CUSTOMER' | 'AI' | 'AGENT' | 'SYSTEM';

/** Channel through which a ticket was created */
export type Channel = 'WIDGET' | 'DASHBOARD' | 'API' | 'EMAIL';

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
