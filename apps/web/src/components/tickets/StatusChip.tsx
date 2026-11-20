import type { TicketStatus } from '@supportpilot/shared-types';

const STATUS_CONFIG: Record<TicketStatus, { label: string; bg: string; text: string }> = {
  NEW: { label: 'New', bg: 'bg-emerald-100', text: 'text-emerald-800' },
  OPEN: { label: 'Open', bg: 'bg-blue-100', text: 'text-blue-800' },
  PENDING_CUSTOMER: { label: 'Pending Customer', bg: 'bg-purple-100', text: 'text-purple-800' },
  ON_HOLD: { label: 'On Hold', bg: 'bg-amber-100', text: 'text-amber-800' },
  RESOLVED: { label: 'Resolved', bg: 'bg-teal-100', text: 'text-teal-800' },
  CLOSED: { label: 'Closed', bg: 'bg-slate-200', text: 'text-slate-700' },
};

export function StatusChip({ status }: { status: TicketStatus }) {
  const config = STATUS_CONFIG[status] || {
    label: status,
    bg: 'bg-slate-100',
    text: 'text-slate-700',
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${config.bg} ${config.text}`}
      data-testid={`status-chip-${status}`}
    >
      {config.label}
    </span>
  );
}
