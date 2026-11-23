import { describe, it, expect } from 'vitest';
import { inviteTeamMemberSchema, updateNotificationPrefsSchema } from '../src/team.js';

describe('team schemas', () => {
  describe('inviteTeamMemberSchema', () => {
    it('parses minimal invite with default AGENT role', () => {
      const parsed = inviteTeamMemberSchema.parse({
        email: '  agent@example.com  ',
        name: '  Agent Smith  ',
      });
      expect(parsed.email).toBe('agent@example.com');
      expect(parsed.name).toBe('Agent Smith');
      expect(parsed.role).toBe('AGENT');
    });

    it('accepts explicit valid roles', () => {
      const roles = ['OWNER', 'LEAD', 'AGENT', 'VIEWER'] as const;
      for (const role of roles) {
        const parsed = inviteTeamMemberSchema.parse({
          email: 'user@example.com',
          name: 'User',
          role,
        });
        expect(parsed.role).toBe(role);
      }
    });

    it('rejects invalid role', () => {
      expect(() =>
        inviteTeamMemberSchema.parse({
          email: 'user@example.com',
          name: 'User',
          role: 'ADMIN',
        }),
      ).toThrow();
    });

    it('rejects invalid email', () => {
      expect(() =>
        inviteTeamMemberSchema.parse({
          email: 'not-an-email',
          name: 'User',
        }),
      ).toThrow();
    });

    it('rejects empty name or name > 150 chars', () => {
      expect(() =>
        inviteTeamMemberSchema.parse({
          email: 'user@example.com',
          name: '',
        }),
      ).toThrow();

      expect(() =>
        inviteTeamMemberSchema.parse({
          email: 'user@example.com',
          name: 'X'.repeat(151),
        }),
      ).toThrow();
    });
  });

  describe('updateNotificationPrefsSchema', () => {
    it('parses valid notification prefs', () => {
      const parsed = updateNotificationPrefsSchema.parse({
        email: true,
        push: false,
        inApp: true,
      });
      expect(parsed.email).toBe(true);
      expect(parsed.push).toBe(false);
      expect(parsed.inApp).toBe(true);
    });

    it('accepts empty object (all optional)', () => {
      const parsed = updateNotificationPrefsSchema.parse({});
      expect(parsed).toEqual({});
    });

    it('rejects non-boolean values', () => {
      expect(() =>
        updateNotificationPrefsSchema.parse({
          email: 'yes',
        }),
      ).toThrow();
    });
  });
});
