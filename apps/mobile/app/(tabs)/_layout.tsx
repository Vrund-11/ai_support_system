import React, { useState } from 'react';

export interface TabProps {
  currentTab: 'inbox' | 'mine' | 'notifications' | 'settings';
  onSelectTab: (tab: 'inbox' | 'mine' | 'notifications' | 'settings') => void;
}

export default function TabLayout({ currentTab, onSelectTab }: TabProps) {
  const tabs = [
    { id: 'inbox', label: 'Inbox', icon: '📥' },
    { id: 'mine', label: 'My Tickets', icon: '👤' },
    { id: 'notifications', label: 'Alerts', icon: '🔔' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
  ] as const;

  return (
    <nav
      style={{
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        height: '60px',
        backgroundColor: '#1e293b',
        borderTop: '1px solid #334155',
        position: 'sticky',
        bottom: 0,
        width: '100%',
      }}
    >
      {tabs.map((tab) => {
        const isActive = currentTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onSelectTab(tab.id)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              background: 'none',
              border: 'none',
              color: isActive ? '#38bdf8' : '#94a3b8',
              cursor: 'pointer',
              padding: '6px 12px',
            }}
          >
            <span style={{ fontSize: '18px' }}>{tab.icon}</span>
            <span
              style={{
                fontSize: '11px',
                fontWeight: isActive ? 'bold' : 'normal',
                marginTop: '2px',
              }}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
