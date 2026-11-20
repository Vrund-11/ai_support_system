import type {
  RuleDto,
  RuleCondition,
  RuleAction,
  TicketDto,
  MessageDto,
  TicketStatus,
  TicketPriority,
} from '@supportpilot/shared-types';

export interface RuleEvaluationContext {
  ticket: TicketDto;
  message?: MessageDto;
}

export interface RuleSideEffect {
  ruleId: string;
  ruleName: string;
  type: 'NOTIFY' | 'ESCALATE';
  target?: string;
  params?: Record<string, unknown>;
}

export interface RulesExecutionResult {
  updatedTicket: TicketDto;
  appliedRuleIds: string[];
  appliedRuleNames: string[];
  sideEffects: RuleSideEffect[];
  changes: Partial<TicketDto>;
}

/**
 * Evaluates whether a single condition holds true for the ticket/message context.
 */
export function evaluateCondition(
  condition: RuleCondition,
  context: RuleEvaluationContext,
): boolean {
  const { ticket, message } = context;
  const { field, operator, value } = condition;

  let actualValue: string | string[] | undefined;

  switch (field) {
    case 'status':
      actualValue = ticket.status;
      break;
    case 'priority':
      actualValue = ticket.priority;
      break;
    case 'tag':
      actualValue = ticket.tags;
      break;
    case 'keyword': {
      // Searches subject, description, and message text
      const corpus = `${ticket.subject} ${ticket.description} ${message?.body || ''}`.toLowerCase();
      const targetStr = Array.isArray(value) ? value.join(' ') : String(value);
      return corpus.includes(targetStr.toLowerCase());
    }
    case 'channel':
      actualValue = message?.senderType || 'WEB';
      break;
    default:
      return false;
  }

  // Handle Tag / Array containment
  if (Array.isArray(actualValue)) {
    const targetVal = String(value).toLowerCase();
    const tagMatches = actualValue.some((t) => t.toLowerCase() === targetVal);

    if (operator === 'CONTAINS' || operator === 'EQUALS' || operator === 'IN') {
      return tagMatches;
    }
    if (operator === 'NOT_EQUALS') {
      return !tagMatches;
    }
    return false;
  }

  // Handle Scalar string values
  const actualStr = String(actualValue || '').toLowerCase();
  const targetStr = String(value || '').toLowerCase();

  switch (operator) {
    case 'EQUALS':
      return actualStr === targetStr;
    case 'NOT_EQUALS':
      return actualStr !== targetStr;
    case 'CONTAINS':
      return actualStr.includes(targetStr);
    case 'IN': {
      const allowed = Array.isArray(value)
        ? value.map((v) => String(v).toLowerCase())
        : [targetStr];
      return allowed.includes(actualStr);
    }
    case 'MATCHES_REGEX': {
      try {
        const regex = new RegExp(String(value), 'i');
        return regex.test(actualStr);
      } catch {
        return false;
      }
    }
    default:
      return false;
  }
}

/**
 * Evaluates whether all/any conditions of a rule match the context.
 */
export function matchesRule(rule: RuleDto, context: RuleEvaluationContext): boolean {
  if (!rule.enabled) return false;
  if (!rule.conditions || rule.conditions.length === 0) return true;

  if (rule.conditionLogic === 'OR') {
    return rule.conditions.some((cond) => evaluateCondition(cond, context));
  }

  // Default: AND logic
  return rule.conditions.every((cond) => evaluateCondition(cond, context));
}

/**
 * Applies actions from a matched rule to ticket state and produces side effects.
 */
export function applyRuleAction(
  action: RuleAction,
  ticket: TicketDto,
  rule: RuleDto,
): { patch: Partial<TicketDto>; sideEffect?: RuleSideEffect } {
  const patch: Partial<TicketDto> = {};
  let sideEffect: RuleSideEffect | undefined;

  switch (action.type) {
    case 'ASSIGN':
      if (action.target) {
        patch.assigneeId = action.target;
      }
      break;
    case 'ADD_TAG':
      if (action.target && !(ticket.tags || []).includes(action.target)) {
        patch.tags = [...(ticket.tags || []), action.target];
      }
      break;
    case 'REMOVE_TAG':
      if (action.target && (ticket.tags || []).includes(action.target)) {
        patch.tags = (ticket.tags || []).filter((t) => t !== action.target);
      }
      break;
    case 'SET_PRIORITY':
      if (action.target) {
        patch.priority = action.target as TicketPriority;
      }
      break;
    case 'SET_STATUS':
      if (action.target) {
        patch.status = action.target as TicketStatus;
      }
      break;
    case 'NOTIFY':
      sideEffect = {
        ruleId: rule.id || String((rule as unknown as Record<string, unknown>)['_id'] || ''),
        ruleName: rule.name,
        type: 'NOTIFY',
        target: action.target,
        params: action.params,
      };
      break;
    case 'ESCALATE':
      patch.priority = 'HIGH';
      if (!(ticket.tags || []).includes('escalated')) {
        patch.tags = [...(patch.tags || ticket.tags || []), 'escalated'];
      }
      sideEffect = {
        ruleId: rule.id || String((rule as unknown as Record<string, unknown>)['_id'] || ''),
        ruleName: rule.name,
        type: 'ESCALATE',
        target: action.target,
        params: action.params,
      };
      break;
  }

  return { patch, sideEffect };
}

/**
 * Executes an ordered sequence of tenant rules against a ticket context (AUTO-3).
 * Enforces strict tenant isolation: rules must match context ticket.tenantId.
 */
export function executeRules(
  rules: RuleDto[],
  context: RuleEvaluationContext,
): RulesExecutionResult {
  const { ticket } = context;
  const applicableRules = rules
    .filter((r) => String(r.tenantId) === String(ticket.tenantId) && r.enabled)
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  let currentTicket: TicketDto = { ...ticket, tags: [...(ticket.tags || [])] };
  const accumulatedChanges: Partial<TicketDto> = {};
  const appliedRuleIds: string[] = [];
  const appliedRuleNames: string[] = [];
  const sideEffects: RuleSideEffect[] = [];

  for (const rule of applicableRules) {
    const evalContext: RuleEvaluationContext = {
      ticket: currentTicket,
      message: context.message,
    };

    if (matchesRule(rule, evalContext)) {
      appliedRuleIds.push(
        rule.id || String((rule as unknown as Record<string, unknown>)['_id'] || ''),
      );
      appliedRuleNames.push(rule.name);

      for (const action of rule.actions) {
        const { patch, sideEffect } = applyRuleAction(action, currentTicket, rule);

        if (sideEffect) {
          sideEffects.push(sideEffect);
        }

        if (Object.keys(patch).length > 0) {
          Object.assign(accumulatedChanges, patch);
          currentTicket = {
            ...currentTicket,
            ...patch,
            tags: patch.tags ? [...patch.tags] : currentTicket.tags,
          };
        }
      }
    }
  }

  return {
    updatedTicket: currentTicket,
    appliedRuleIds,
    appliedRuleNames,
    sideEffects,
    changes: accumulatedChanges,
  };
}
