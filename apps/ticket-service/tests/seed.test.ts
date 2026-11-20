import { describe, it, expect } from 'vitest';
import { runSeed, generateSeedTickets, SEED_DATA } from '../src/seed.js';

describe('Seed Data Generator (S4-T09)', () => {
  it('generates 50 realistic tickets across statuses, priorities, and categories', () => {
    const acmeId = SEED_DATA.tenants[0]!._id;
    const tickets = generateSeedTickets(acmeId, 50);

    expect(tickets.length).toBe(50);
    expect(tickets[0].number).toBe(1);
    expect(tickets[49].number).toBe(50);

    const statuses = new Set(tickets.map((t) => t.status));
    expect(statuses.has('NEW')).toBe(true);
    expect(statuses.has('OPEN')).toBe(true);
    expect(statuses.has('RESOLVED')).toBe(true);

    const priorities = new Set(tickets.map((t) => t.priority));
    expect(priorities.has('URGENT')).toBe(true);
    expect(priorities.has('HIGH')).toBe(true);
    expect(priorities.has('MEDIUM')).toBe(true);
    expect(priorities.has('LOW')).toBe(true);
  });

  it('runs hermetic seed dry-run and outputs expected resource counts', async () => {
    const stats = await runSeed('memory');

    expect(stats.tenantsCount).toBe(3);
    expect(stats.usersCount).toBe(8);
    expect(stats.ticketsCount).toBe(50);
    expect(stats.rulesCount).toBe(4);
    expect(stats.featureFlagsCount).toBe(15);
  });
});
