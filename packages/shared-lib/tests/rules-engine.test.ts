import { describe, it, expect } from 'vitest';
import type { RuleDto, TicketDto, MessageDto } from '@supportpilot/shared-types';
import {
  evaluateCondition,
  matchesRule,
  applyRuleAction,
  executeRules,
} from '../src/rules/engine.js';

describe('Automation Rules Engine (AUTO-3)', () => {
  const baseTicket: TicketDto = {
    id: 'tkt_rule_001',
    tenantId: 'tenant_acme',
    number: 1042,
    subject: 'Urgent: Payment failed on invoice',
    description: 'We tried renewing the annual subscription but credit card failed.',
    status: 'NEW',
    priority: 'MEDIUM',
    customerId: 'cust_999',
    tags: ['billing', 'subscription'],
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it('evaluates status, priority, and tag conditions accurately', () => {
    // Status EQUALS
    expect(
      evaluateCondition(
        { field: 'status', operator: 'EQUALS', value: 'NEW' },
        { ticket: baseTicket },
      ),
    ).toBe(true);

    expect(
      evaluateCondition(
        { field: 'status', operator: 'EQUALS', value: 'CLOSED' },
        { ticket: baseTicket },
      ),
    ).toBe(false);

    // Priority IN
    expect(
      evaluateCondition(
        { field: 'priority', operator: 'IN', value: ['MEDIUM', 'HIGH'] },
        { ticket: baseTicket },
      ),
    ).toBe(true);

    // Tag CONTAINS
    expect(
      evaluateCondition(
        { field: 'tag', operator: 'CONTAINS', value: 'billing' },
        { ticket: baseTicket },
      ),
    ).toBe(true);

    expect(
      evaluateCondition(
        { field: 'tag', operator: 'CONTAINS', value: 'security' },
        { ticket: baseTicket },
      ),
    ).toBe(false);
  });

  it('evaluates keyword condition across subject, description, and message text', () => {
    const message: MessageDto = {
      id: 'msg_01',
      tenantId: 'tenant_acme',
      seq: 1,
      senderType: 'CUSTOMER',
      body: 'Can someone please help me unlock my account immediately?',
      isInternal: false,
      createdAt: new Date().toISOString(),
    };

    // Keyword in subject
    expect(
      evaluateCondition(
        { field: 'keyword', operator: 'CONTAINS', value: 'Payment' },
        { ticket: baseTicket },
      ),
    ).toBe(true);

    // Keyword in description
    expect(
      evaluateCondition(
        { field: 'keyword', operator: 'CONTAINS', value: 'credit card' },
        { ticket: baseTicket },
      ),
    ).toBe(true);

    // Keyword in incoming message
    expect(
      evaluateCondition(
        { field: 'keyword', operator: 'CONTAINS', value: 'unlock' },
        { ticket: baseTicket, message },
      ),
    ).toBe(true);

    // Missing keyword
    expect(
      evaluateCondition(
        { field: 'keyword', operator: 'CONTAINS', value: 'cryptocurrency' },
        { ticket: baseTicket, message },
      ),
    ).toBe(false);
  });

  it('evaluates rule condition logic with AND and OR operators', () => {
    const andRule: RuleDto = {
      id: 'rule_1',
      tenantId: 'tenant_acme',
      name: 'High priority billing rule',
      event: 'TICKET_CREATED',
      conditionLogic: 'AND',
      conditions: [
        { field: 'tag', operator: 'CONTAINS', value: 'billing' },
        { field: 'keyword', operator: 'CONTAINS', value: 'failed' },
      ],
      actions: [{ type: 'SET_PRIORITY', target: 'HIGH' }],
      enabled: true,
      order: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    expect(matchesRule(andRule, { ticket: baseTicket })).toBe(true);

    const failingAndRule: RuleDto = {
      ...andRule,
      conditions: [
        { field: 'tag', operator: 'CONTAINS', value: 'billing' },
        { field: 'tag', operator: 'CONTAINS', value: 'hardware' }, // Not present
      ],
    };
    expect(matchesRule(failingAndRule, { ticket: baseTicket })).toBe(false);

    const passingOrRule: RuleDto = {
      ...andRule,
      conditionLogic: 'OR',
      conditions: [
        { field: 'tag', operator: 'CONTAINS', value: 'hardware' },
        { field: 'tag', operator: 'CONTAINS', value: 'billing' },
      ],
    };
    expect(matchesRule(passingOrRule, { ticket: baseTicket })).toBe(true);
  });

  it('applies action modifications: ASSIGN, ADD_TAG, REMOVE_TAG, SET_PRIORITY, ESCALATE, NOTIFY', () => {
    const dummyRule: RuleDto = {
      id: 'rule_dummy',
      tenantId: 'tenant_acme',
      name: 'Dummy',
      event: 'TICKET_CREATED',
      conditions: [],
      conditionLogic: 'AND',
      actions: [],
      enabled: true,
      order: 1,
      createdAt: '',
      updatedAt: '',
    };

    // ASSIGN
    const assignRes = applyRuleAction(
      { type: 'ASSIGN', target: 'agent_bob' },
      baseTicket,
      dummyRule,
    );
    expect(assignRes.patch.assigneeId).toBe('agent_bob');

    // ADD_TAG
    const addTagRes = applyRuleAction({ type: 'ADD_TAG', target: 'vip' }, baseTicket, dummyRule);
    expect(addTagRes.patch.tags).toContain('vip');

    // REMOVE_TAG
    const removeTagRes = applyRuleAction(
      { type: 'REMOVE_TAG', target: 'billing' },
      baseTicket,
      dummyRule,
    );
    expect(removeTagRes.patch.tags).not.toContain('billing');

    // SET_PRIORITY
    const priorityRes = applyRuleAction(
      { type: 'SET_PRIORITY', target: 'URGENT' },
      baseTicket,
      dummyRule,
    );
    expect(priorityRes.patch.priority).toBe('URGENT');

    // ESCALATE
    const escalateRes = applyRuleAction(
      { type: 'ESCALATE', target: 'Legal risk detected' },
      baseTicket,
      dummyRule,
    );
    expect(escalateRes.patch.priority).toBe('HIGH');
    expect(escalateRes.patch.tags).toContain('escalated');
    expect(escalateRes.sideEffect?.type).toBe('ESCALATE');

    // NOTIFY
    const notifyRes = applyRuleAction(
      { type: 'NOTIFY', target: 'lead_channel' },
      baseTicket,
      dummyRule,
    );
    expect(notifyRes.sideEffect?.type).toBe('NOTIFY');
    expect(notifyRes.sideEffect?.target).toBe('lead_channel');
  });

  it('executes multiple ordered rules sequentially and enforces tenant isolation', () => {
    const rule1: RuleDto = {
      id: 'rule_01',
      tenantId: 'tenant_acme',
      name: 'VIP Auto-assign',
      event: 'TICKET_CREATED',
      order: 1,
      enabled: true,
      conditionLogic: 'AND',
      conditions: [{ field: 'keyword', operator: 'CONTAINS', value: 'Payment' }],
      actions: [
        { type: 'ASSIGN', target: 'agent_alice' },
        { type: 'ADD_TAG', target: 'auto_assigned' },
      ],
      createdAt: '',
      updatedAt: '',
    };

    const rule2: RuleDto = {
      id: 'rule_02',
      tenantId: 'tenant_acme',
      name: 'Billing escalation',
      event: 'TICKET_CREATED',
      order: 2,
      enabled: true,
      conditionLogic: 'AND',
      conditions: [{ field: 'tag', operator: 'CONTAINS', value: 'auto_assigned' }], // Matches mutation from rule 1
      actions: [
        { type: 'SET_PRIORITY', target: 'HIGH' },
        { type: 'NOTIFY', target: 'manager@acme.com' },
      ],
      createdAt: '',
      updatedAt: '',
    };

    // Disabled rule -> should be skipped
    const ruleDisabled: RuleDto = {
      ...rule1,
      id: 'rule_disabled',
      enabled: false,
      actions: [{ type: 'SET_STATUS', target: 'CLOSED' }],
    };

    // Cross-tenant rule (tenant_other) -> should never execute
    const ruleCrossTenant: RuleDto = {
      ...rule1,
      id: 'rule_other_tenant',
      tenantId: 'tenant_other',
      actions: [{ type: 'ASSIGN', target: 'agent_intruder' }],
    };

    const result = executeRules([ruleCrossTenant, ruleDisabled, rule2, rule1], {
      ticket: baseTicket,
    });

    expect(result.appliedRuleIds).toEqual(['rule_01', 'rule_02']);
    expect(result.updatedTicket.assigneeId).toBe('agent_alice');
    expect(result.updatedTicket.tags).toContain('auto_assigned');
    expect(result.updatedTicket.priority).toBe('HIGH');
    expect(result.sideEffects.length).toBe(1);
    expect(result.sideEffects[0].type).toBe('NOTIFY');
    expect(result.sideEffects[0].target).toBe('manager@acme.com');

    // Cross-tenant rule was not applied
    expect(result.updatedTicket.assigneeId).not.toBe('agent_intruder');
  });
});
