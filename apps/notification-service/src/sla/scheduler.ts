import type { BusinessHours, SlaPolicy, TicketPriority } from '@supportpilot/shared-types';
import { calculateSlaMilestones } from '@supportpilot/shared-lib';
import type { QueueManager } from '../manager.js';
import type { SlaJobPayload } from '../types.js';

export interface ScheduleSlaTimersParams {
  ticketId: string;
  tenantId: string;
  priority: TicketPriority;
  slaConfig: Record<TicketPriority, SlaPolicy>;
  businessHours: BusinessHours[];
  createdAt?: Date;
}

export interface ScheduledSlaJobInfo {
  jobId: string;
  target: 'FIRST_RESPONSE' | 'RESOLUTION';
  stage: '75_PERCENT' | '100_PERCENT';
  dueAt: string;
  delayMs: number;
}

/**
 * Calculates business hours milestones and enqueues delayed BullMQ timer jobs (AUTO-1, AUTO-2).
 */
export async function scheduleSlaTimers(
  queueManager: QueueManager,
  params: ScheduleSlaTimersParams,
): Promise<ScheduledSlaJobInfo[]> {
  const { ticketId, tenantId, priority, slaConfig, businessHours } = params;
  const startTime = params.createdAt || new Date();
  const now = Date.now();

  const milestones = calculateSlaMilestones(startTime, priority, slaConfig, businessHours);
  const scheduled: ScheduledSlaJobInfo[] = [];

  // 1. First Response 75% warning
  const fr75Due = milestones.firstResponse.warning75At;
  const fr75Delay = Math.max(0, fr75Due.getTime() - now);
  const fr75JobId = `sla:${ticketId}:FIRST_RESPONSE:75`;
  await queueManager.enqueue<SlaJobPayload>(
    'sla',
    {
      ticketId,
      tenantId,
      policyId: `sla_${priority}`,
      stage: '75_PERCENT',
      dueAt: fr75Due.toISOString(),
      idempotencyKey: fr75JobId,
    },
    { delay: fr75Delay, jobId: fr75JobId },
  );
  scheduled.push({
    jobId: fr75JobId,
    target: 'FIRST_RESPONSE',
    stage: '75_PERCENT',
    dueAt: fr75Due.toISOString(),
    delayMs: fr75Delay,
  });

  // 2. First Response 100% breach
  const fr100Due = milestones.firstResponse.breach100At;
  const fr100Delay = Math.max(0, fr100Due.getTime() - now);
  const fr100JobId = `sla:${ticketId}:FIRST_RESPONSE:100`;
  await queueManager.enqueue<SlaJobPayload>(
    'sla',
    {
      ticketId,
      tenantId,
      policyId: `sla_${priority}`,
      stage: '100_PERCENT',
      dueAt: fr100Due.toISOString(),
      idempotencyKey: fr100JobId,
    },
    { delay: fr100Delay, jobId: fr100JobId },
  );
  scheduled.push({
    jobId: fr100JobId,
    target: 'FIRST_RESPONSE',
    stage: '100_PERCENT',
    dueAt: fr100Due.toISOString(),
    delayMs: fr100Delay,
  });

  // 3. Resolution 75% warning
  const res75Due = milestones.resolution.warning75At;
  const res75Delay = Math.max(0, res75Due.getTime() - now);
  const res75JobId = `sla:${ticketId}:RESOLUTION:75`;
  await queueManager.enqueue<SlaJobPayload>(
    'sla',
    {
      ticketId,
      tenantId,
      policyId: `sla_${priority}`,
      stage: '75_PERCENT',
      dueAt: res75Due.toISOString(),
      idempotencyKey: res75JobId,
    },
    { delay: res75Delay, jobId: res75JobId },
  );
  scheduled.push({
    jobId: res75JobId,
    target: 'RESOLUTION',
    stage: '75_PERCENT',
    dueAt: res75Due.toISOString(),
    delayMs: res75Delay,
  });

  // 4. Resolution 100% breach
  const res100Due = milestones.resolution.breach100At;
  const res100Delay = Math.max(0, res100Due.getTime() - now);
  const res100JobId = `sla:${ticketId}:RESOLUTION:100`;
  await queueManager.enqueue<SlaJobPayload>(
    'sla',
    {
      ticketId,
      tenantId,
      policyId: `sla_${priority}`,
      stage: '100_PERCENT',
      dueAt: res100Due.toISOString(),
      idempotencyKey: res100JobId,
    },
    { delay: res100Delay, jobId: res100JobId },
  );
  scheduled.push({
    jobId: res100JobId,
    target: 'RESOLUTION',
    stage: '100_PERCENT',
    dueAt: res100Due.toISOString(),
    delayMs: res100Delay,
  });

  return scheduled;
}
