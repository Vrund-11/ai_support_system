import React from 'react';

export default function NotificationsScreen() {
  const notifications = [
    {
      id: 'notif_1',
      title: 'SLA Milestone Approaching',
      detail: 'Ticket #104 first response target in 15 minutes',
      time: '10m ago',
      type: 'sla_warning',
    },
    {
      id: 'notif_2',
      title: 'New Customer Escalation',
      detail: 'High priority billing question assigned to your queue',
      time: '25m ago',
      type: 'assignment',
    },
  ];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: '#0f172a',
      }}
    >
      <div style={{ padding: '16px', borderBottom: '1px solid #1e293b' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#f8fafc', margin: 0 }}>
          Alerts & Activity
        </h1>
      </div>
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {notifications.map((n) => (
          <div
            key={n.id}
            style={{
              backgroundColor: '#1e293b',
              padding: '14px',
              borderRadius: '8px',
              border: '1px solid #334155',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '4px',
              }}
            >
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: 'bold',
                  color: n.type === 'sla_warning' ? '#f59e0b' : '#38bdf8',
                }}
              >
                {n.title}
              </span>
              <span style={{ fontSize: '11px', color: '#64748b' }}>{n.time}</span>
            </div>
            <p style={{ margin: 0, fontSize: '12px', color: '#cbd5e1' }}>{n.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
