import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { BusinessHours, SlaPolicy } from '@supportpilot/shared-types';
import {
  calculateBusinessTimeDeadline,
  calculateSlaMilestones,
  isWithinBusinessHours,
  fastForwardToBusinessStart,
} from '../src/sla/calculator.js';

describe('SLA Business Hours & Property-Based Calculator (AUTO-1)', () => {
  const standardBusinessHours: BusinessHours[] = [
    { day: 1, start: '09:00', end: '17:00' }, // Mon
    { day: 2, start: '09:00', end: '17:00' }, // Tue
    { day: 3, start: '09:00', end: '17:00' }, // Wed
    { day: 4, start: '09:00', end: '17:00' }, // Thu
    { day: 5, start: '09:00', end: '17:00' }, // Fri
  ];

  it('correctly detects if a timestamp falls within business hours', () => {
    // Mon 10:30 UTC -> inside
    const monMorning = new Date('2026-11-23T10:30:00Z');
    expect(isWithinBusinessHours(monMorning, standardBusinessHours)).toBe(true);

    // Mon 18:30 UTC -> after hours
    const monEvening = new Date('2026-11-23T18:30:00Z');
    expect(isWithinBusinessHours(monEvening, standardBusinessHours)).toBe(false);

    // Sat 12:00 UTC -> weekend
    const saturday = new Date('2026-11-28T12:00:00Z');
    expect(isWithinBusinessHours(saturday, standardBusinessHours)).toBe(false);
  });

  it('fast-forwards weekend or evening timestamps to the start of the next business window', () => {
    // Friday 19:00 UTC -> Monday 09:00 UTC
    const friNight = new Date('2026-11-27T19:00:00Z');
    const forwarded = fastForwardToBusinessStart(friNight, standardBusinessHours);

    expect(forwarded.getUTCDay()).toBe(1); // Monday
    expect(forwarded.getUTCHours()).toBe(9);
    expect(forwarded.getUTCMinutes()).toBe(0);
  });

  it('calculates deadline crossing overnight and weekend boundaries correctly', () => {
    // Friday 15:00 UTC (2 business hours remaining today).
    // Request 5 business hours (300 mins) -> 2h on Friday + 3h on Monday = Monday 12:00 UTC
    const fri3pm = new Date('2026-11-27T15:00:00Z');
    const deadline = calculateBusinessTimeDeadline(fri3pm, 300, standardBusinessHours);

    expect(deadline.getUTCDay()).toBe(1); // Monday
    expect(deadline.getUTCHours()).toBe(12);
    expect(deadline.getUTCMinutes()).toBe(0);
  });

  // ── Property-Based Testing with fast-check ──

  it('Property: deadline is always >= startTime for any non-negative target minutes', () => {
    fc.assert(
      fc.property(
        fc.date({
          min: new Date('2026-01-01T00:00:00Z'),
          max: new Date('2027-01-01T00:00:00Z'),
          noInvalidDate: true,
        }),
        fc.integer({ min: 0, max: 20000 }),
        (startDate, targetMinutes) => {
          const deadline = calculateBusinessTimeDeadline(
            startDate,
            targetMinutes,
            standardBusinessHours,
          );
          expect(deadline.getTime()).toBeGreaterThanOrEqual(startDate.getTime());
        },
      ),
      { numRuns: 100 },
    );
  });

  it('Property: monotonicity — larger target minutes never result in an earlier deadline', () => {
    fc.assert(
      fc.property(
        fc.date({
          min: new Date('2026-01-01T00:00:00Z'),
          max: new Date('2027-01-01T00:00:00Z'),
          noInvalidDate: true,
        }),
        fc.integer({ min: 1, max: 5000 }),
        fc.integer({ min: 1, max: 5000 }),
        (startDate, m1, m2) => {
          const minM = Math.min(m1, m2);
          const maxM = Math.max(m1, m2);

          const d1 = calculateBusinessTimeDeadline(startDate, minM, standardBusinessHours);
          const d2 = calculateBusinessTimeDeadline(startDate, maxM, standardBusinessHours);

          expect(d2.getTime()).toBeGreaterThanOrEqual(d1.getTime());
        },
      ),
      { numRuns: 100 },
    );
  });

  it('Property: 75% warning time is always <= 100% breach time', () => {
    const defaultSlaPolicy: Record<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT', SlaPolicy> = {
      LOW: { firstResponseMin: 480, resolveMin: 1440 },
      MEDIUM: { firstResponseMin: 240, resolveMin: 720 },
      HIGH: { firstResponseMin: 60, resolveMin: 240 },
      URGENT: { firstResponseMin: 15, resolveMin: 60 },
    };

    fc.assert(
      fc.property(
        fc.date({
          min: new Date('2026-01-01T00:00:00Z'),
          max: new Date('2027-01-01T00:00:00Z'),
          noInvalidDate: true,
        }),
        fc.constantFrom<'LOW', 'MEDIUM', 'HIGH', 'URGENT'>('LOW', 'MEDIUM', 'HIGH', 'URGENT'),
        (startDate, priority) => {
          const milestones = calculateSlaMilestones(
            startDate,
            priority,
            defaultSlaPolicy,
            standardBusinessHours,
          );

          // First response: 75% <= 100%
          expect(milestones.firstResponse.warning75At.getTime()).toBeLessThanOrEqual(
            milestones.firstResponse.breach100At.getTime(),
          );

          // Resolution: 75% <= 100%
          expect(milestones.resolution.warning75At.getTime()).toBeLessThanOrEqual(
            milestones.resolution.breach100At.getTime(),
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it('Property: determinism — running calculation twice with identical parameters returns identical timestamp', () => {
    fc.assert(
      fc.property(
        fc.date({
          min: new Date('2026-01-01T00:00:00Z'),
          max: new Date('2027-01-01T00:00:00Z'),
          noInvalidDate: true,
        }),
        fc.integer({ min: 0, max: 10000 }),
        (startDate, minutes) => {
          const run1 = calculateBusinessTimeDeadline(startDate, minutes, standardBusinessHours);
          const run2 = calculateBusinessTimeDeadline(startDate, minutes, standardBusinessHours);
          expect(run1.getTime()).toBe(run2.getTime());
        },
      ),
      { numRuns: 100 },
    );
  });
});
