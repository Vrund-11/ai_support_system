import type { TicketPriority } from '@supportpilot/shared-types';

const PRIORITY_CONFIG: Record<
  TicketPriority,
  { label: string; bg: string; text: string; dot: string }
> = {
  LOW: { label: 'LOW', bg: 'bg-surface-subtle', text: 'text-priority-low', dot: 'bg-priority-low' },
  MEDIUM: {
    label: 'MEDIUM',
    bg: 'bg-blue-100 dark:bg-blue-950/40',
    text: 'text-priority-medium',
    dot: 'bg-priority-medium',
  },
  HIGH: {
    label: 'HIGH',
    bg: 'bg-amber-100 dark:bg-amber-950/40',
    text: 'text-priority-high',
    dot: 'bg-priority-high',
  },
  URGENT: {
    label: 'URGENT',
    bg: 'bg-red-100 dark:bg-red-950/40',
    text: 'text-priority-urgent',
    dot: 'bg-priority-urgent',
  },
};

export function PriorityChip({ priority }: { priority: TicketPriority }) {
  const config = PRIORITY_CONFIG[priority] || {
    label: priority,
    bg: 'bg-surface-subtle',
    text: 'text-text-secondary',
    dot: 'bg-text-secondary',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-code-mono text-code-mono font-medium ${config.bg} ${config.text}`}
      data-testid={`priority-chip-${priority}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}
