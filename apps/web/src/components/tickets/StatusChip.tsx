import type { TicketStatus } from '@supportpilot/shared-types';

const STATUS_CONFIG: Record<TicketStatus, { label: string; bg: string; text: string }> = {
  NEW: { label: 'NEW', bg: 'bg-ticket-new-bg', text: 'text-ticket-new-text' },
  OPEN: { label: 'OPEN', bg: 'bg-ticket-open-bg', text: 'text-ticket-open-text' },
  PENDING_CUSTOMER: {
    label: 'PENDING',
    bg: 'bg-ticket-pending-bg',
    text: 'text-ticket-pending-text',
  },
  ON_HOLD: { label: 'ON HOLD', bg: 'bg-ticket-onhold-bg', text: 'text-ticket-onhold-text' },
  RESOLVED: { label: 'RESOLVED', bg: 'bg-surface-subtle', text: 'text-text-secondary' },
  CLOSED: { label: 'CLOSED', bg: 'bg-surface-subtle', text: 'text-outline' },
};

export function StatusChip({ status }: { status: TicketStatus }) {
  const config = STATUS_CONFIG[status] || {
    label: status,
    bg: 'bg-surface-subtle',
    text: 'text-text-secondary',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-body-sm text-body-sm font-medium ${config.bg} ${config.text}`}
      data-testid={`status-chip-${status}`}
    >
      {config.label}
    </span>
  );
}
