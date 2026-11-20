import type { SlaJobPayload } from '../types.js';

export interface SlaTicketState {
  id: string;
  tenantId: string;
  status: string;
  firstRespondedAt?: string;
  resolvedAt?: string;
  slaBreached?: boolean;
}

export type TicketGetter = (ticketId: string, tenantId: string) => Promise<SlaTicketState | null>;

export interface SlaEventSink {
  onWarning: (event: {
    ticketId: string;
    tenantId: string;
    target: string;
    dueAt: string;
  }) => Promise<void>;
  onBreach: (event: {
    ticketId: string;
    tenantId: string;
    target: string;
    dueAt: string;
  }) => Promise<void>;
}

export interface SlaProcessingResult {
  action: 'SKIPPED' | 'WARNING_RAISED' | 'BREACH_RAISED';
  reason?: string;
  target?: string;
  stage?: string;
}

/**
 * Processes a delayed SLA job when triggered (AUTO-2, T-SLA-01).
 * Skips execution cleanly if the ticket is already resolved, closed, or responded.
 */
export async function processSlaTimerJob(
  payload: SlaJobPayload & { target?: 'FIRST_RESPONSE' | 'RESOLUTION' },
  ticketGetter: TicketGetter,
  eventSink: SlaEventSink,
): Promise<SlaProcessingResult> {
  const { ticketId, tenantId, stage, dueAt } = payload;
  const target =
    payload.target || (payload.policyId?.includes('first') ? 'FIRST_RESPONSE' : 'RESOLUTION');

  const ticket = await ticketGetter(ticketId, tenantId);

  // If ticket deleted or not found
  if (!ticket) {
    return {
      action: 'SKIPPED',
      reason: 'Ticket not found or deleted',
    };
  }

  // T-SLA-01: Skip if ticket already resolved or closed
  if (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED') {
    return {
      action: 'SKIPPED',
      reason: `Ticket is already ${ticket.status}`,
      target,
      stage,
    };
  }

  // T-SLA-01: Skip first response warning/breach if first response already provided
  if (
    target === 'FIRST_RESPONSE' &&
    (ticket.firstRespondedAt || ticket.status === 'PENDING_CUSTOMER')
  ) {
    return {
      action: 'SKIPPED',
      reason: 'First response already provided',
      target,
      stage,
    };
  }

  // Raise 75% warning event
  if (stage === '75_PERCENT') {
    await eventSink.onWarning({
      ticketId,
      tenantId,
      target,
      dueAt,
    });

    return {
      action: 'WARNING_RAISED',
      target,
      stage,
    };
  }

  // Raise 100% breach event
  if (stage === '100_PERCENT') {
    await eventSink.onBreach({
      ticketId,
      tenantId,
      target,
      dueAt,
    });

    return {
      action: 'BREACH_RAISED',
      target,
      stage,
    };
  }

  return {
    action: 'SKIPPED',
    reason: `Unknown SLA stage ${stage}`,
  };
}
