import { AppError } from '@supportpilot/shared-lib';
import type { TicketStatus } from '@supportpilot/shared-types';
import { ALLOWED_STATUS_TRANSITIONS, canTransitionStatus } from '@supportpilot/validators';

export { ALLOWED_STATUS_TRANSITIONS, canTransitionStatus };

/** Validate transition between statuses, throwing 400 AppError if disallowed */
export function validateStatusTransition(from: TicketStatus, to: TicketStatus): void {
  if (!canTransitionStatus(from, to)) {
    throw new AppError(
      400,
      `Invalid ticket status transition: cannot transition from ${from} to ${to}`,
      '/errors/invalid-status-transition',
    );
  }
}
