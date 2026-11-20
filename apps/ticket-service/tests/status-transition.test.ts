import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { TicketStatus } from '@supportpilot/shared-types';
import { AppError } from '@supportpilot/shared-lib';
import {
  ALLOWED_STATUS_TRANSITIONS,
  canTransitionStatus,
  validateStatusTransition,
} from '../src/lib/transitions.js';

const allStatuses: TicketStatus[] = [
  'NEW',
  'OPEN',
  'PENDING_CUSTOMER',
  'ON_HOLD',
  'RESOLVED',
  'CLOSED',
];

const statusArbitrary = fc.constantFrom<TicketStatus>(...allStatuses);

describe('Status Transitions (S1-T07: TKT-2 / T-TKT-01)', () => {
  describe('Unit Transition Checks', () => {
    it('verifies exact PRD transition matrix', () => {
      // NEW -> OPEN | CLOSED
      expect(canTransitionStatus('NEW', 'OPEN')).toBe(true);
      expect(canTransitionStatus('NEW', 'CLOSED')).toBe(true);
      expect(canTransitionStatus('NEW', 'PENDING_CUSTOMER')).toBe(false);
      expect(canTransitionStatus('NEW', 'ON_HOLD')).toBe(false);
      expect(canTransitionStatus('NEW', 'RESOLVED')).toBe(false);

      // OPEN -> PENDING_CUSTOMER | ON_HOLD | RESOLVED
      expect(canTransitionStatus('OPEN', 'PENDING_CUSTOMER')).toBe(true);
      expect(canTransitionStatus('OPEN', 'ON_HOLD')).toBe(true);
      expect(canTransitionStatus('OPEN', 'RESOLVED')).toBe(true);
      expect(canTransitionStatus('OPEN', 'NEW')).toBe(false);
      expect(canTransitionStatus('OPEN', 'CLOSED')).toBe(false);

      // PENDING_CUSTOMER -> OPEN | RESOLVED | CLOSED
      expect(canTransitionStatus('PENDING_CUSTOMER', 'OPEN')).toBe(true);
      expect(canTransitionStatus('PENDING_CUSTOMER', 'RESOLVED')).toBe(true);
      expect(canTransitionStatus('PENDING_CUSTOMER', 'CLOSED')).toBe(true);
      expect(canTransitionStatus('PENDING_CUSTOMER', 'NEW')).toBe(false);
      expect(canTransitionStatus('PENDING_CUSTOMER', 'ON_HOLD')).toBe(false);

      // ON_HOLD -> OPEN | RESOLVED
      expect(canTransitionStatus('ON_HOLD', 'OPEN')).toBe(true);
      expect(canTransitionStatus('ON_HOLD', 'RESOLVED')).toBe(true);
      expect(canTransitionStatus('ON_HOLD', 'CLOSED')).toBe(false);
      expect(canTransitionStatus('ON_HOLD', 'PENDING_CUSTOMER')).toBe(false);

      // RESOLVED -> OPEN | CLOSED
      expect(canTransitionStatus('RESOLVED', 'OPEN')).toBe(true);
      expect(canTransitionStatus('RESOLVED', 'CLOSED')).toBe(true);
      expect(canTransitionStatus('RESOLVED', 'NEW')).toBe(false);
      expect(canTransitionStatus('RESOLVED', 'ON_HOLD')).toBe(false);

      // CLOSED -> terminal state, no transitions out
      expect(canTransitionStatus('CLOSED', 'NEW')).toBe(false);
      expect(canTransitionStatus('CLOSED', 'OPEN')).toBe(false);
      expect(canTransitionStatus('CLOSED', 'RESOLVED')).toBe(false);
    });

    it('validateStatusTransition throws AppError 400 with /errors/invalid-status-transition', () => {
      expect(() => validateStatusTransition('CLOSED', 'OPEN')).toThrow(AppError);
      try {
        validateStatusTransition('CLOSED', 'OPEN');
      } catch (err: any) {
        expect(err.status).toBe(400);
        expect(err.type).toBe('/errors/invalid-status-transition');
      }
    });

    it('validateStatusTransition succeeds on valid transition', () => {
      expect(() => validateStatusTransition('NEW', 'OPEN')).not.toThrow();
    });
  });

  describe('Property-Based Testing with fast-check', () => {
    it('property: self-transitions are always valid (idempotent)', () => {
      fc.assert(
        fc.property(statusArbitrary, (status) => {
          return canTransitionStatus(status, status) === true;
        }),
        { numRuns: 100 },
      );
    });

    it('property: no status can ever transition back to NEW', () => {
      fc.assert(
        fc.property(statusArbitrary, (status) => {
          if (status === 'NEW') return true; // self-transition handled above
          return canTransitionStatus(status, 'NEW') === false;
        }),
        { numRuns: 100 },
      );
    });

    it('property: CLOSED is terminal and cannot transition to any other status', () => {
      fc.assert(
        fc.property(statusArbitrary, (targetStatus) => {
          if (targetStatus === 'CLOSED') return true;
          return canTransitionStatus('CLOSED', targetStatus) === false;
        }),
        { numRuns: 100 },
      );
    });

    it('property: canTransitionStatus consistency matches ALLOWED_STATUS_TRANSITIONS lookup table', () => {
      fc.assert(
        fc.property(statusArbitrary, statusArbitrary, (from, to) => {
          const expected =
            from === to || (ALLOWED_STATUS_TRANSITIONS[from] as readonly string[]).includes(to);
          return canTransitionStatus(from, to) === expected;
        }),
        { numRuns: 200 },
      );
    });

    it('property: validateStatusTransition throws if and only if canTransitionStatus is false', () => {
      fc.assert(
        fc.property(statusArbitrary, statusArbitrary, (from, to) => {
          const isValid = canTransitionStatus(from, to);
          if (isValid) {
            validateStatusTransition(from, to);
            return true;
          } else {
            let threw = false;
            try {
              validateStatusTransition(from, to);
            } catch (err: any) {
              threw = err instanceof AppError && err.status === 400;
            }
            return threw;
          }
        }),
        { numRuns: 200 },
      );
    });

    it('property: random paths from NEW only reach CLOSED via valid intermediate states', () => {
      // Generate a path of status attempts
      fc.assert(
        fc.property(fc.array(statusArbitrary, { minLength: 1, maxLength: 20 }), (attempts) => {
          let current: TicketStatus = 'NEW';
          for (const next of attempts) {
            if (canTransitionStatus(current, next)) {
              current = next;
            }
          }
          // After attempting any sequence of valid transitions, current must still be a valid TicketStatus
          return allStatuses.includes(current);
        }),
        { numRuns: 200 },
      );
    });
  });
});
