import { describe, it, expect } from 'vitest';
import {
  ALLOWED_STATUS_TRANSITIONS,
  canTransitionStatus,
  type TicketStatusType,
} from '../src/transitions.js';

describe('ticket transitions', () => {
  describe('ALLOWED_STATUS_TRANSITIONS mapping', () => {
    it('defines expected transitions for each state', () => {
      expect(ALLOWED_STATUS_TRANSITIONS.NEW).toEqual(['OPEN', 'CLOSED']);
      expect(ALLOWED_STATUS_TRANSITIONS.OPEN).toEqual(['PENDING_CUSTOMER', 'ON_HOLD', 'RESOLVED']);
      expect(ALLOWED_STATUS_TRANSITIONS.PENDING_CUSTOMER).toEqual(['OPEN', 'RESOLVED', 'CLOSED']);
      expect(ALLOWED_STATUS_TRANSITIONS.ON_HOLD).toEqual(['OPEN', 'RESOLVED']);
      expect(ALLOWED_STATUS_TRANSITIONS.RESOLVED).toEqual(['OPEN', 'CLOSED']);
      expect(ALLOWED_STATUS_TRANSITIONS.CLOSED).toEqual([]);
    });
  });

  describe('canTransitionStatus', () => {
    it('allows idempotent self-transitions for all states', () => {
      const allStatuses: TicketStatusType[] = [
        'NEW',
        'OPEN',
        'PENDING_CUSTOMER',
        'ON_HOLD',
        'RESOLVED',
        'CLOSED',
      ];

      for (const status of allStatuses) {
        expect(canTransitionStatus(status, status)).toBe(true);
      }
    });

    it('allows valid state machine forward transitions', () => {
      expect(canTransitionStatus('NEW', 'OPEN')).toBe(true);
      expect(canTransitionStatus('NEW', 'CLOSED')).toBe(true);

      expect(canTransitionStatus('OPEN', 'PENDING_CUSTOMER')).toBe(true);
      expect(canTransitionStatus('OPEN', 'ON_HOLD')).toBe(true);
      expect(canTransitionStatus('OPEN', 'RESOLVED')).toBe(true);

      expect(canTransitionStatus('PENDING_CUSTOMER', 'OPEN')).toBe(true);
      expect(canTransitionStatus('PENDING_CUSTOMER', 'RESOLVED')).toBe(true);
      expect(canTransitionStatus('PENDING_CUSTOMER', 'CLOSED')).toBe(true);

      expect(canTransitionStatus('ON_HOLD', 'OPEN')).toBe(true);
      expect(canTransitionStatus('ON_HOLD', 'RESOLVED')).toBe(true);

      expect(canTransitionStatus('RESOLVED', 'OPEN')).toBe(true);
      expect(canTransitionStatus('RESOLVED', 'CLOSED')).toBe(true);
    });

    it('disallows invalid state transitions', () => {
      expect(canTransitionStatus('CLOSED', 'OPEN')).toBe(false);
      expect(canTransitionStatus('CLOSED', 'NEW')).toBe(false);
      expect(canTransitionStatus('CLOSED', 'RESOLVED')).toBe(false);

      expect(canTransitionStatus('NEW', 'RESOLVED')).toBe(false);
      expect(canTransitionStatus('NEW', 'ON_HOLD')).toBe(false);

      expect(canTransitionStatus('OPEN', 'CLOSED')).toBe(false);
      expect(canTransitionStatus('OPEN', 'NEW')).toBe(false);

      expect(canTransitionStatus('ON_HOLD', 'CLOSED')).toBe(false);
      expect(canTransitionStatus('ON_HOLD', 'NEW')).toBe(false);
    });

    it('returns false for unknown statuses safely', () => {
      expect(canTransitionStatus('UNKNOWN' as any, 'OPEN')).toBe(false);
      expect(canTransitionStatus('OPEN', 'UNKNOWN' as any)).toBe(false);
    });
  });
});
