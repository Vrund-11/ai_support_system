import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createLogger } from '@supportpilot/shared-lib';
import type { BusinessHours, SlaPolicy } from '@supportpilot/shared-types';
import { QueueManager } from '../src/manager.js';
import { MemoryIdempotencyStore } from '../src/idempotency.js';
import { scheduleSlaTimers } from '../src/sla/scheduler.js';
import { processSlaTimerJob, type SlaTicketState } from '../src/sla/processor.js';

describe('SLA Automation & Delayed Job Processing (AUTO-1, AUTO-2, T-SLA-01)', () => {
  let queueManager: QueueManager;
  const logger = createLogger('sla-test', 'silent');

  const standardBusinessHours: BusinessHours[] = [
    { day: 1, start: '09:00', end: '17:00' },
    { day: 2, start: '09:00', end: '17:00' },
    { day: 3, start: '09:00', end: '17:00' },
    { day: 4, start: '09:00', end: '17:00' },
    { day: 5, start: '09:00', end: '17:00' },
  ];

  const slaConfig: Record<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT', SlaPolicy> = {
    LOW: { firstResponseMin: 480, resolveMin: 1440 },
    MEDIUM: { firstResponseMin: 240, resolveMin: 720 },
    HIGH: { firstResponseMin: 60, resolveMin: 240 },
    URGENT: { firstResponseMin: 15, resolveMin: 60 },
  };

  beforeEach(() => {
    queueManager = new QueueManager({
      idempotencyStore: new MemoryIdempotencyStore(),
      logger,
      inMemory: true,
    });
  });

  afterEach(async () => {
    await queueManager.close();
  });

  it('schedules 4 delayed timer jobs (75% and 100% for FR and Resolution) on ticket creation', async () => {
    const scheduled = await scheduleSlaTimers(queueManager, {
      ticketId: 'tkt_sla_101',
      tenantId: 'tenant_corp',
      priority: 'HIGH',
      slaConfig,
      businessHours: standardBusinessHours,
      createdAt: new Date('2026-11-23T10:00:00Z'),
    });

    expect(scheduled.length).toBe(4);

    const fr75 = scheduled.find((s) => s.target === 'FIRST_RESPONSE' && s.stage === '75_PERCENT');
    const fr100 = scheduled.find((s) => s.target === 'FIRST_RESPONSE' && s.stage === '100_PERCENT');
    const res75 = scheduled.find((s) => s.target === 'RESOLUTION' && s.stage === '75_PERCENT');
    const res100 = scheduled.find((s) => s.target === 'RESOLUTION' && s.stage === '100_PERCENT');

    expect(fr75).toBeDefined();
    expect(fr100).toBeDefined();
    expect(res75).toBeDefined();
    expect(res100).toBeDefined();

    // Verify queue metrics reflect 4 delayed/waiting jobs in 'sla' queue
    const metrics = await queueManager.getMetrics();
    const slaMetric = metrics.find((m) => m.queue === 'sla');
    expect((slaMetric?.waiting || 0) + (slaMetric?.delayed || 0)).toBe(4);
  });

  it('triggers 75% warning when timer job fires on an unresolved ticket', async () => {
    let warningRaised = false;

    const mockTicket: SlaTicketState = {
      id: 'tkt_warn_1',
      tenantId: 'tenant_corp',
      status: 'OPEN',
    };

    const result = await processSlaTimerJob(
      {
        ticketId: 'tkt_warn_1',
        tenantId: 'tenant_corp',
        stage: '75_PERCENT',
        target: 'RESOLUTION',
        policyId: 'sla_HIGH',
        dueAt: new Date().toISOString(),
      },
      async () => mockTicket,
      {
        onWarning: async (evt) => {
          expect(evt.ticketId).toBe('tkt_warn_1');
          expect(evt.target).toBe('RESOLUTION');
          warningRaised = true;
        },
        onBreach: async () => {},
      },
    );

    expect(result.action).toBe('WARNING_RAISED');
    expect(warningRaised).toBe(true);
  });

  it('triggers 100% breach event when timer job fires on an unresolved ticket', async () => {
    let breachRaised = false;

    const mockTicket: SlaTicketState = {
      id: 'tkt_breach_1',
      tenantId: 'tenant_corp',
      status: 'OPEN',
    };

    const result = await processSlaTimerJob(
      {
        ticketId: 'tkt_breach_1',
        tenantId: 'tenant_corp',
        stage: '100_PERCENT',
        target: 'RESOLUTION',
        policyId: 'sla_HIGH',
        dueAt: new Date().toISOString(),
      },
      async () => mockTicket,
      {
        onWarning: async () => {},
        onBreach: async (evt) => {
          expect(evt.ticketId).toBe('tkt_breach_1');
          expect(evt.target).toBe('RESOLUTION');
          breachRaised = true;
        },
      },
    );

    expect(result.action).toBe('BREACH_RAISED');
    expect(breachRaised).toBe(true);
  });

  it('T-SLA-01: skips SLA warning and breach when ticket is already RESOLVED or CLOSED', async () => {
    let eventTriggered = false;

    const resolvedTicket: SlaTicketState = {
      id: 'tkt_resolved_1',
      tenantId: 'tenant_corp',
      status: 'RESOLVED',
      resolvedAt: new Date().toISOString(),
    };

    const result = await processSlaTimerJob(
      {
        ticketId: 'tkt_resolved_1',
        tenantId: 'tenant_corp',
        stage: '100_PERCENT',
        target: 'RESOLUTION',
        policyId: 'sla_HIGH',
        dueAt: new Date().toISOString(),
      },
      async () => resolvedTicket,
      {
        onWarning: async () => {
          eventTriggered = true;
        },
        onBreach: async () => {
          eventTriggered = true;
        },
      },
    );

    expect(result.action).toBe('SKIPPED');
    expect(result.reason).toContain('already RESOLVED');
    expect(eventTriggered).toBe(false);
  });

  it('T-SLA-01: skips FIRST_RESPONSE timer when first response has already been provided', async () => {
    let eventTriggered = false;

    const respondedTicket: SlaTicketState = {
      id: 'tkt_responded_1',
      tenantId: 'tenant_corp',
      status: 'OPEN',
      firstRespondedAt: new Date().toISOString(),
    };

    const result = await processSlaTimerJob(
      {
        ticketId: 'tkt_responded_1',
        tenantId: 'tenant_corp',
        stage: '75_PERCENT',
        target: 'FIRST_RESPONSE',
        policyId: 'sla_HIGH',
        dueAt: new Date().toISOString(),
      },
      async () => respondedTicket,
      {
        onWarning: async () => {
          eventTriggered = true;
        },
        onBreach: async () => {
          eventTriggered = true;
        },
      },
    );

    expect(result.action).toBe('SKIPPED');
    expect(result.reason).toContain('First response already provided');
    expect(eventTriggered).toBe(false);
  });
});
