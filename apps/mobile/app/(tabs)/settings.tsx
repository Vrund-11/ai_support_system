import React, { useState } from 'react';
import { useAuthStore } from '../../src/lib/auth.store.js';

export default function SettingsScreen() {
  const { user, isBiometricsEnabled, enableBiometrics, logout } = useAuthStore();
  const [presence, setPresence] = useState<'ONLINE' | 'AWAY' | 'OFFLINE'>('ONLINE');

  const togglePresence = () => {
    setPresence((prev) => (prev === 'ONLINE' ? 'AWAY' : 'ONLINE'));
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: '#0f172a',
        padding: '16px',
      }}
    >
      <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#f8fafc', marginBottom: '20px' }}>
        Agent Preferences
      </h1>

      {/* User Info */}
      <div
        style={{
          backgroundColor: '#1e293b',
          padding: '16px',
          borderRadius: '10px',
          marginBottom: '16px',
          border: '1px solid #334155',
        }}
      >
        <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#f1f5f9' }}>
          {user?.name || 'Agent User'}
        </div>
        <div style={{ fontSize: '13px', color: '#94a3b8' }}>
          {user?.email || 'agent@example.com'}
        </div>
        <div style={{ fontSize: '11px', color: '#38bdf8', marginTop: '4px' }}>
          Role: {user?.role || 'AGENT'}
        </div>
      </div>

      {/* Presence Toggle (MOB-7) */}
      <div
        style={{
          backgroundColor: '#1e293b',
          padding: '16px',
          borderRadius: '10px',
          marginBottom: '16px',
          border: '1px solid #334155',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <div style={{ fontSize: '14px', fontWeight: '600', color: '#f1f5f9' }}>
            Active Presence
          </div>
          <div style={{ fontSize: '12px', color: presence === 'ONLINE' ? '#22c55e' : '#f59e0b' }}>
            ● {presence}
          </div>
        </div>
        <button
          onClick={togglePresence}
          style={{
            padding: '8px 12px',
            borderRadius: '6px',
            border: 'none',
            backgroundColor: '#334155',
            color: '#fff',
            fontSize: '13px',
            cursor: 'pointer',
          }}
        >
          Toggle {presence === 'ONLINE' ? 'Away' : 'Online'}
        </button>
      </div>

      {/* Biometrics Setting (MOB-1) */}
      <div
        style={{
          backgroundColor: '#1e293b',
          padding: '16px',
          borderRadius: '10px',
          marginBottom: '24px',
          border: '1px solid #334155',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <div style={{ fontSize: '14px', fontWeight: '600', color: '#f1f5f9' }}>
            Biometric Unlock
          </div>
          <div style={{ fontSize: '12px', color: '#94a3b8' }}>
            {isBiometricsEnabled ? 'Enabled' : 'Disabled'}
          </div>
        </div>
        {!isBiometricsEnabled && (
          <button
            onClick={() => void enableBiometrics()}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: '#0284c7',
              color: '#fff',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            Enable
          </button>
        )}
      </div>

      {/* Sign Out Button */}
      <button
        onClick={() => void logout()}
        style={{
          width: '100%',
          padding: '12px',
          borderRadius: '8px',
          backgroundColor: '#ef4444',
          color: '#fff',
          fontWeight: 'bold',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        Sign Out
      </button>

      <div
        style={{
          textAlign: 'center',
          marginTop: 'auto',
          padding: '16px',
          fontSize: '11px',
          color: '#64748b',
        }}
      >
        SupportPilot Mobile v1.0.0
      </div>
    </div>
  );
}
