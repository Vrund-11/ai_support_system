import React, { useState } from 'react';
import { useAuthStore } from '../../src/lib/auth.store.js';

export default function LoginScreen({ onLoginSuccess }: { onLoginSuccess?: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tenantId, setTenantId] = useState('');

  const { login, loginWithBiometrics, isBiometricsEnabled, isLoading, error, clearError } =
    useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    const success = await login({ email, password, tenantId: tenantId || undefined });
    if (success && onLoginSuccess) {
      onLoginSuccess();
    }
  };

  const handleBiometricUnlock = async () => {
    clearError();
    const success = await loginWithBiometrics();
    if (success && onLoginSuccess) {
      onLoginSuccess();
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100%',
        padding: '24px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '360px',
          backgroundColor: '#1e293b',
          padding: '32px',
          borderRadius: '16px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
        }}
      >
        <h1
          style={{
            fontSize: '24px',
            fontWeight: 'bold',
            color: '#38bdf8',
            marginBottom: '8px',
            textAlign: 'center',
          }}
        >
          SupportPilot
        </h1>
        <p
          style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '24px', textAlign: 'center' }}
        >
          Agent Workspace Mobile
        </p>

        {error && (
          <div
            style={{
              backgroundColor: '#7f1d1d',
              color: '#fca5a5',
              padding: '12px',
              borderRadius: '8px',
              marginBottom: '16px',
              fontSize: '13px',
            }}
          >
            {error}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
        >
          <div>
            <label
              style={{ display: 'block', fontSize: '12px', color: '#cbd5e1', marginBottom: '4px' }}
            >
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="agent@example.com"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #334155',
                backgroundColor: '#0f172a',
                color: '#fff',
                fontSize: '14px',
              }}
            />
          </div>

          <div>
            <label
              style={{ display: 'block', fontSize: '12px', color: '#cbd5e1', marginBottom: '4px' }}
            >
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #334155',
                backgroundColor: '#0f172a',
                color: '#fff',
                fontSize: '14px',
              }}
            />
          </div>

          <div>
            <label
              style={{ display: 'block', fontSize: '12px', color: '#cbd5e1', marginBottom: '4px' }}
            >
              Tenant ID (optional)
            </label>
            <input
              type="text"
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              placeholder="tenant-acme"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #334155',
                backgroundColor: '#0f172a',
                color: '#fff',
                fontSize: '14px',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '8px',
              backgroundColor: '#0284c7',
              color: '#fff',
              fontWeight: 'bold',
              border: 'none',
              cursor: 'pointer',
              marginTop: '8px',
            }}
          >
            {isLoading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        {isBiometricsEnabled && (
          <button
            type="button"
            onClick={handleBiometricUnlock}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '8px',
              backgroundColor: '#334155',
              color: '#38bdf8',
              fontWeight: '600',
              border: '1px solid #475569',
              cursor: 'pointer',
              marginTop: '12px',
            }}
          >
            Unlock with Biometrics (Face ID / Fingerprint)
          </button>
        )}
      </div>
    </div>
  );
}
