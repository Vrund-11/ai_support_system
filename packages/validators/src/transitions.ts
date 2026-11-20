import type { z } from 'zod';
import type { ticketStatusSchema } from './ticket.js';

export type TicketStatusType = z.infer<typeof ticketStatusSchema>;

/**
 * State machine for ticket status transitions (TKT-2).
 * NEW -> OPEN | CLOSED
 * OPEN -> PENDING_CUSTOMER | ON_HOLD | RESOLVED
 * PENDING_CUSTOMER -> OPEN | RESOLVED | CLOSED
 * ON_HOLD -> OPEN | RESOLVED
 * RESOLVED -> OPEN | CLOSED
 * CLOSED -> (none)
 */
export const ALLOWED_STATUS_TRANSITIONS: Record<TicketStatusType, readonly TicketStatusType[]> = {
  NEW: ['OPEN', 'CLOSED'],
  OPEN: ['PENDING_CUSTOMER', 'ON_HOLD', 'RESOLVED'],
  PENDING_CUSTOMER: ['OPEN', 'RESOLVED', 'CLOSED'],
  ON_HOLD: ['OPEN', 'RESOLVED'],
  RESOLVED: ['OPEN', 'CLOSED'],
  CLOSED: [],
} as const;

/** Check if transitioning from one status to another is valid */
export function canTransitionStatus(from: TicketStatusType, to: TicketStatusType): boolean {
  if (from === to) return true; // idempotent self-transition
  return ALLOWED_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}
