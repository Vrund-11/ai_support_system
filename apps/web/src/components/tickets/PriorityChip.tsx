import type { TicketPriority } from '@supportpilot/shared-types';

const PRIORITY_CONFIG: Record<TicketPriority, { label: string; bg: string; text: string }> = {
  LOW: { label: 'Low', bg: 'bg-slate-100', text: 'text-slate-700' },
  MEDIUM: { label: 'Medium', bg: 'bg-blue-100', text: 'text-blue-700' },
  HIGH: { label: 'High', bg: 'bg-amber-100', text: 'text-amber-800' },
  URGENT: { label: 'Urgent', bg: 'bg-rose-100', text: 'text-rose-800' },
};

export function PriorityChip({ priority }: { priority: TicketPriority }) {
  const config = PRIORITY_CONFIG[priority] || {
    label: priority,
    bg: 'bg-slate-100',
    text: 'text-slate-700',
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${config.bg} ${config.text}`}
      data-testid={`priority-chip-${priority}`}
    >
      {config.label}
    </span>
  );
}
