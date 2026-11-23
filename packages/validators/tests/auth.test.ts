import { describe, it, expect } from 'vitest';
import {
  registerTenantSchema,
  loginSchema,
  refreshSchema,
  logoutSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  resendVerificationSchema,
} from '../src/auth.js';

describe('auth schemas', () => {
  describe('registerTenantSchema', () => {
    const validData = {
      tenantName: 'Acme Corp',
      name: 'John Doe',
      email: 'John.Doe@Example.com',
      password: 'SecurePassword123!',
    };

    it('parses valid registration payload and transforms email', () => {
      const parsed = registerTenantSchema.parse(validData);
      expect(parsed.tenantName).toBe('Acme Corp');
      expect(parsed.name).toBe('John Doe');
      expect(parsed.email).toBe('john.doe@example.com');
      expect(parsed.password).toBe('SecurePassword123!');
    });

    it('trims tenantName and name whitespace', () => {
      const parsed = registerTenantSchema.parse({
        ...validData,
        tenantName: '   Acme Corp   ',
        name: '   John Doe   ',
      });
      expect(parsed.tenantName).toBe('Acme Corp');
      expect(parsed.name).toBe('John Doe');
    });

    it('rejects tenantName shorter than 2 chars or longer than 100 chars', () => {
      expect(() => registerTenantSchema.parse({ ...validData, tenantName: 'A' })).toThrow();
      expect(() =>
        registerTenantSchema.parse({ ...validData, tenantName: 'A'.repeat(101) }),
      ).toThrow();
    });

    it('rejects name shorter than 2 chars or longer than 100 chars', () => {
      expect(() => registerTenantSchema.parse({ ...validData, name: 'J' })).toThrow();
      expect(() => registerTenantSchema.parse({ ...validData, name: 'J'.repeat(101) })).toThrow();
    });

    it('rejects invalid email formats', () => {
      expect(() => registerTenantSchema.parse({ ...validData, email: 'not-an-email' })).toThrow();
      expect(() =>
        registerTenantSchema.parse({ ...validData, email: '@missing-user.com' }),
      ).toThrow();
      expect(() => registerTenantSchema.parse({ ...validData, email: '' })).toThrow();
    });

    it('rejects password shorter than 8 chars or longer than 128 chars', () => {
      expect(() => registerTenantSchema.parse({ ...validData, password: 'short' })).toThrow();
      expect(() =>
        registerTenantSchema.parse({ ...validData, password: 'P'.repeat(129) }),
      ).toThrow();
    });

    it('rejects missing required fields', () => {
      expect(() => registerTenantSchema.parse({})).toThrow();
    });
  });

  describe('loginSchema', () => {
    it('parses valid login credentials and normalizes email', () => {
      const parsed = loginSchema.parse({
        email: '  USER@EXAMPLE.COM  ',
        password: 'any-password',
      });
      expect(parsed.email).toBe('user@example.com');
      expect(parsed.password).toBe('any-password');
    });

    it('rejects invalid email', () => {
      expect(() => loginSchema.parse({ email: 'bad-email', password: 'pwd' })).toThrow();
    });

    it('rejects empty password', () => {
      expect(() => loginSchema.parse({ email: 'test@example.com', password: '' })).toThrow();
    });
  });

  describe('refreshSchema', () => {
    it('accepts valid refresh token', () => {
      const parsed = refreshSchema.parse({ refreshToken: 'valid-refresh-token' });
      expect(parsed.refreshToken).toBe('valid-refresh-token');
    });

    it('rejects empty refresh token', () => {
      expect(() => refreshSchema.parse({ refreshToken: '' })).toThrow();
      expect(() => refreshSchema.parse({})).toThrow();
    });
  });

  describe('logoutSchema', () => {
    it('accepts valid logout payload', () => {
      const parsed = logoutSchema.parse({ refreshToken: 'active-refresh-token' });
      expect(parsed.refreshToken).toBe('active-refresh-token');
    });

    it('rejects empty token', () => {
      expect(() => logoutSchema.parse({ refreshToken: '' })).toThrow();
    });
  });

  describe('forgotPasswordSchema', () => {
    it('accepts valid email and lowercases it', () => {
      const parsed = forgotPasswordSchema.parse({ email: 'SUPPORT@SUPPORTPILOT.IO' });
      expect(parsed.email).toBe('support@supportpilot.io');
    });

    it('rejects invalid email', () => {
      expect(() => forgotPasswordSchema.parse({ email: 'invalid' })).toThrow();
      expect(() => forgotPasswordSchema.parse({})).toThrow();
    });
  });

  describe('resetPasswordSchema', () => {
    it('accepts valid token and new password', () => {
      const parsed = resetPasswordSchema.parse({
        token: 'reset-token-123',
        newPassword: 'BrandNewPassword123!',
      });
      expect(parsed.token).toBe('reset-token-123');
      expect(parsed.newPassword).toBe('BrandNewPassword123!');
    });

    it('rejects empty token', () => {
      expect(() =>
        resetPasswordSchema.parse({ token: '', newPassword: 'BrandNewPassword123!' }),
      ).toThrow();
    });

    it('rejects password < 8 chars or > 128 chars', () => {
      expect(() => resetPasswordSchema.parse({ token: 'tok', newPassword: 'short' })).toThrow();
      expect(() =>
        resetPasswordSchema.parse({ token: 'tok', newPassword: 'X'.repeat(129) }),
      ).toThrow();
    });
  });

  describe('verifyEmailSchema', () => {
    it('accepts valid token', () => {
      const parsed = verifyEmailSchema.parse({ token: 'verify-token-abc' });
      expect(parsed.token).toBe('verify-token-abc');
    });

    it('rejects empty token', () => {
      expect(() => verifyEmailSchema.parse({ token: '' })).toThrow();
      expect(() => verifyEmailSchema.parse({})).toThrow();
    });
  });

  describe('resendVerificationSchema', () => {
    it('accepts valid email and lowercases it', () => {
      const parsed = resendVerificationSchema.parse({ email: 'DEV@COMPANY.COM' });
      expect(parsed.email).toBe('dev@company.com');
    });

    it('rejects malformed email', () => {
      expect(() => resendVerificationSchema.parse({ email: 'invalid' })).toThrow();
    });
  });
});
