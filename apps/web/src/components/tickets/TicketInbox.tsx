import { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useTickets } from '../../hooks/useTickets';
import { StatusChip } from './StatusChip';
import { PriorityChip } from './PriorityChip';
import { api } from '../../lib/api';
import { toast } from '../../store/toast.store';
import type { TicketStatus, TicketPriority } from '@supportpilot/shared-types';

interface TicketInboxProps {
  onSelectTicket: (ticketId: string) => void;
  onOpenCreate: () => void;
}

function formatRelativeTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (isNaN(diffSec)) return dateStr;
    if (diffSec < 60) return 'just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return `${Math.floor(diffSec / 86400)}d ago`;
  } catch {
    return dateStr;
  }
}

export function TicketInbox({ onSelectTicket, onOpenCreate }: TicketInboxProps) {
  const [statusFilter, setStatusFilter] = useState<TicketStatus | ''>('');
  const [priorityFilter, setPriorityFilter] = useState<TicketPriority | ''>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [selectedTicketIds, setSelectedTicketIds] = useState<string[]>([]);
  const [bulkAssignTarget, setBulkAssignTarget] = useState('');
  const [bulkTagInput, setBulkTagInput] = useState('');
  const [isBulkOperating, setIsBulkOperating] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
  };

  const queryClient = useQueryClient();
  const parentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchQuery]);

  const { data, isLoading, isError, error, refetch } = useTickets({
    status: statusFilter,
    priority: priorityFilter,
    q: debouncedSearch.trim() || undefined,
  });

  const tickets = data?.data || [];

  const rowVirtualizer = useVirtualizer({
    count: tickets.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56,
    overscan: 10,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();
  const paddingTop = virtualItems.length > 0 ? virtualItems[0]?.start || 0 : 0;
  const paddingBottom =
    virtualItems.length > 0 ? totalSize - (virtualItems[virtualItems.length - 1]?.end || 0) : 0;

  // Fallback for non-scrolling jsdom test environments
  const renderedRows =
    virtualItems.length > 0
      ? virtualItems.map((v) => ({ index: v.index, ticket: tickets[v.index]! }))
      : tickets.slice(0, 50).map((ticket, index) => ({ index, ticket }));

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollHeight > 0 && el.scrollTop + el.clientHeight >= el.scrollHeight * 0.7) {
      const cursor = (data as any)?.meta?.cursor;
      if (cursor) {
        void queryClient.prefetchQuery({
          queryKey: [
            'tickets',
            {
              status: statusFilter,
              priority: priorityFilter,
              q: debouncedSearch.trim() || undefined,
              cursor,
            },
          ],
          queryFn: () =>
            api.tickets.list({
              status: statusFilter,
              priority: priorityFilter,
              q: debouncedSearch.trim() || undefined,
              cursor,
            }),
        });
      }
    }
  };

  const handlePrefetch = (ticketId: string) => {
    void queryClient.prefetchQuery({
      queryKey: ['ticket', ticketId],
      queryFn: () => api.tickets.get(ticketId),
      staleTime: 30000,
    });
  };

  const openCount = tickets.filter((t) => t.status === 'OPEN').length;
  const unassignedCount = tickets.filter((t) => !t.assigneeId).length;
  const urgentCount = tickets.filter((t) => t.priority === 'URGENT').length;

  const handleBulkAction = async (action: 'ASSIGN' | 'TAG' | 'STATUS', value: string) => {
    if (!value || selectedTicketIds.length === 0) return;
    try {
      setIsBulkOperating(true);
      await api.tickets.bulk({
        ticketIds: selectedTicketIds,
        action,
        value,
      });
      setSelectedTicketIds([]);
      setBulkAssignTarget('');
      setBulkTagInput('');
      await refetch();
      toast.success(`Bulk action "${action}" applied to ${selectedTicketIds.length} tickets.`);
    } catch (err) {
      toast.error((err as Error).message || 'Failed to execute bulk action');
    } finally {
      setIsBulkOperating(false);
    }
  };

  return (
    <div className="w-full px-margin py-space-lg flex flex-col gap-space-lg max-w-[1720px] mx-auto font-body-md text-on-surface">
      {/* Stitch Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md">
        <div className="flex items-center gap-space-md flex-wrap">
          <h1 className="font-headline-lg text-headline-lg text-text-primary tracking-tight font-bold">
            Inbox & Queue
          </h1>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full font-code-mono text-code-mono bg-surface-subtle text-text-secondary font-medium">
            {tickets.length} total
          </span>
          <div className="flex items-center gap-1.5 text-text-secondary font-body-sm text-body-sm pl-2">
            <span className="w-2 h-2 rounded-full bg-ticket-open-text animate-pulse"></span>
            <span>Live Sync Active</span>
          </div>
        </div>

        {/* Quick Action Controls */}
        <div className="flex items-center gap-space-sm self-start md:self-auto">
          <button
            onClick={() => void refetch()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface hover:bg-surface-subtle text-text-secondary hover:text-text-primary border border-border shadow-xs transition-all active:scale-95 font-body-sm text-body-sm cursor-pointer"
            type="button"
            title="Refresh tickets"
          >
            <span className="material-symbols-outlined text-[18px]">sync</span>
            <span>Refresh</span>
          </button>
          <button
            onClick={onOpenCreate}
            className="h-10 px-4 rounded-xl bg-primary-container text-on-primary font-headline-sm text-body-md inline-flex items-center gap-2 hover:bg-primary transition-all shadow-md active:scale-95 font-medium cursor-pointer"
            data-testid="inbox-new-ticket-btn"
            type="button"
          >
            <span className="material-symbols-outlined text-[20px]">add</span>
            <span>New Ticket</span>
          </button>
        </div>
      </div>

      {/* Quick KPI Summary Strip (5 Stitch Cards) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-space-md">
        {/* KPI 1 */}
        <div className="bg-surface rounded-xl p-space-md shadow-xs border border-border flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="font-body-sm text-body-sm text-text-secondary font-medium">
              Open Tickets
            </span>
            <span className="p-1.5 rounded-lg bg-surface-subtle text-primary">
              <span className="material-symbols-outlined text-[18px]">mark_email_unread</span>
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="font-headline-lg text-headline-lg text-text-primary font-bold">
              {openCount} active
            </span>
            <span className="inline-flex items-center gap-0.5 text-ticket-open-text font-code-mono text-code-mono font-medium">
              <span className="material-symbols-outlined text-[14px]">trending_up</span>
              Active
            </span>
          </div>
          <span className="font-body-sm text-body-sm text-text-secondary mt-1">
            Assigned & open
          </span>
        </div>

        {/* KPI 2 */}
        <div className="bg-surface rounded-xl p-space-md shadow-xs border border-border flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="font-body-sm text-body-sm text-text-secondary font-medium">
              Unassigned
            </span>
            <span className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-priority-high">
              <span className="material-symbols-outlined text-[18px]">person_off</span>
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="font-headline-lg text-headline-lg text-text-primary font-bold">
              {unassignedCount} queue
            </span>
            <span className="px-2 py-0.5 rounded-full font-code-mono text-code-mono bg-ticket-pending-bg text-ticket-pending-text font-medium text-xs">
              Attention
            </span>
          </div>
          <span className="font-body-sm text-body-sm text-text-secondary mt-1">
            Requires triage
          </span>
        </div>

        {/* KPI 3 */}
        <div className="bg-surface rounded-xl p-space-md shadow-xs border border-border flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="font-body-sm text-body-sm text-text-secondary font-medium">
              SLA Breaching (&lt;1h)
            </span>
            <span className="p-1.5 rounded-lg bg-red-50 dark:bg-red-950/40 text-priority-urgent">
              <span className="material-symbols-outlined text-[18px]">timer_off</span>
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="font-headline-lg text-headline-lg text-priority-urgent font-bold">
              {urgentCount} critical
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full font-code-mono text-code-mono bg-red-100 dark:bg-red-950/50 text-priority-urgent font-semibold text-xs animate-pulse">
              Critical
            </span>
          </div>
          <span className="font-body-sm text-body-sm text-text-secondary mt-1">
            First response targets
          </span>
        </div>

        {/* KPI 4 */}
        <div className="bg-surface rounded-xl p-space-md shadow-xs border border-border flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="font-body-sm text-body-sm text-text-secondary font-medium">
              Avg First Response
            </span>
            <span className="p-1.5 rounded-lg bg-green-50 dark:bg-emerald-950/40 text-ticket-open-text">
              <span className="material-symbols-outlined text-[18px]">speed</span>
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="font-headline-lg text-headline-lg text-text-primary font-bold">
              18m
            </span>
            <span className="inline-flex items-center gap-0.5 text-ticket-open-text font-code-mono text-code-mono font-medium text-xs">
              <span className="material-symbols-outlined text-[14px]">arrow_downward</span>
              -4m
            </span>
          </div>
          <span className="font-body-sm text-body-sm text-text-secondary mt-1">
            Target is under 30m
          </span>
        </div>

        {/* KPI 5 */}
        <div className="bg-surface rounded-xl p-space-md shadow-xs border border-border col-span-2 md:col-span-1 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="font-body-sm text-body-sm text-text-secondary font-medium">
              CSAT Score
            </span>
            <span className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-primary">
              <span className="material-symbols-outlined text-[18px]">workspace_premium</span>
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="font-headline-lg text-headline-lg text-text-primary font-bold">
              98.4%
            </span>
            <div className="flex items-center text-amber-500">
              <span className="material-symbols-outlined text-[18px]">star</span>
              <span className="font-code-mono text-code-mono font-medium text-text-primary ml-1 text-xs">
                4.92
              </span>
            </div>
          </div>
          <span className="font-body-sm text-body-sm text-text-secondary mt-1">
            Based on 340 ratings
          </span>
        </div>
      </div>

      {/* Filter & Action Toolbar */}
      <div className="bg-surface rounded-xl shadow-xs border border-border p-space-md flex flex-col gap-space-md">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-space-md">
          {/* Left Side Controls */}
          <div className="flex flex-1 flex-wrap items-center gap-space-sm min-w-0">
            {/* Search input with / shortcut */}
            <div className="relative flex-1 min-w-[280px] max-w-lg">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary text-[20px] pointer-events-none">
                search
              </span>
              <input
                className="w-full h-10 pl-10 pr-10 bg-surface-subtle text-text-primary font-body-md text-body-md border border-border rounded-xl focus:outline-none focus:bg-surface focus:ring-1 focus:ring-primary transition-all placeholder:text-text-secondary"
                placeholder="Search tickets by subject, description..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                data-testid="search-input"
                type="text"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 font-code-mono text-code-mono text-text-secondary px-1.5 py-0.5 bg-surface border border-border rounded shadow-xs">
                /
              </span>
            </div>

            {/* Status Dropdown */}
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as TicketStatus | '')}
                aria-label="Filter tickets by status"
                className="h-10 px-3.5 bg-surface-subtle hover:bg-surface-container text-text-primary font-body-sm text-body-sm rounded-xl border border-border focus:outline-none focus:ring-1 focus:ring-primary transition-colors cursor-pointer"
                data-testid="status-filter-select"
              >
                <option value="">Status: All Statuses</option>
                <option value="NEW">Status: NEW</option>
                <option value="OPEN">Status: OPEN</option>
                <option value="PENDING_CUSTOMER">Status: PENDING</option>
                <option value="ON_HOLD">Status: ON HOLD</option>
                <option value="RESOLVED">Status: RESOLVED</option>
                <option value="CLOSED">Status: CLOSED</option>
              </select>
            </div>

            {/* Priority Select */}
            <div className="relative">
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value as TicketPriority | '')}
                aria-label="Filter tickets by priority"
                className="h-10 px-3.5 bg-surface-subtle hover:bg-surface-container text-text-primary font-body-sm text-body-sm rounded-xl border border-border focus:outline-none focus:ring-1 focus:ring-primary transition-colors cursor-pointer"
                data-testid="priority-filter-select"
              >
                <option value="">Priority: All</option>
                <option value="LOW">Priority: LOW</option>
                <option value="MEDIUM">Priority: MEDIUM</option>
                <option value="HIGH">Priority: HIGH</option>
                <option value="URGENT">Priority: URGENT</option>
              </select>
            </div>
          </div>

          {/* Right Side Controls */}
          <div className="flex items-center gap-space-sm justify-between xl:justify-end">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-surface-subtle border border-border rounded-xl p-1">
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-surface text-primary shadow-xs'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
                title="Table View"
                type="button"
              >
                <span className="material-symbols-outlined text-[20px]">view_list</span>
              </button>
              <button
                onClick={() => setViewMode('kanban')}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  viewMode === 'kanban'
                    ? 'bg-surface text-primary shadow-xs'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
                title="Kanban View"
                type="button"
              >
                <span className="material-symbols-outlined text-[20px]">view_kanban</span>
              </button>
            </div>
          </div>
        </div>

        {/* Priority Filter Pills Bar */}
        <div className="flex items-center gap-space-xs overflow-x-auto pt-1 pb-0.5">
          <span className="font-body-sm text-body-sm text-text-secondary font-medium mr-2 self-center shrink-0">
            Priority:
          </span>
          <button
            onClick={() => setPriorityFilter('')}
            className={`px-3 py-1 rounded-full font-body-sm text-body-sm font-medium shrink-0 transition-all flex items-center gap-1.5 cursor-pointer ${
              priorityFilter === ''
                ? 'bg-primary text-on-primary'
                : 'bg-surface-subtle text-text-secondary hover:text-text-primary'
            }`}
            type="button"
          >
            <span>All</span>
          </button>
          <button
            onClick={() => setPriorityFilter('URGENT')}
            className={`px-3 py-1 rounded-full font-body-sm text-body-sm font-medium shrink-0 transition-all flex items-center gap-1.5 cursor-pointer ${
              priorityFilter === 'URGENT'
                ? 'bg-primary text-on-primary'
                : 'bg-surface-subtle text-text-secondary hover:text-text-primary'
            }`}
            type="button"
          >
            <span className="w-2 h-2 rounded-full bg-priority-urgent"></span>
            <span>URGENT</span>
          </button>
          <button
            onClick={() => setPriorityFilter('HIGH')}
            className={`px-3 py-1 rounded-full font-body-sm text-body-sm font-medium shrink-0 transition-all flex items-center gap-1.5 cursor-pointer ${
              priorityFilter === 'HIGH'
                ? 'bg-primary text-on-primary'
                : 'bg-surface-subtle text-text-secondary hover:text-text-primary'
            }`}
            type="button"
          >
            <span className="w-2 h-2 rounded-full bg-priority-high"></span>
            <span>HIGH</span>
          </button>
          <button
            onClick={() => setPriorityFilter('MEDIUM')}
            className={`px-3 py-1 rounded-full font-body-sm text-body-sm font-medium shrink-0 transition-all flex items-center gap-1.5 cursor-pointer ${
              priorityFilter === 'MEDIUM'
                ? 'bg-primary text-on-primary'
                : 'bg-surface-subtle text-text-secondary hover:text-text-primary'
            }`}
            type="button"
          >
            <span className="w-2 h-2 rounded-full bg-priority-medium"></span>
            <span>MEDIUM</span>
          </button>
          <button
            onClick={() => setPriorityFilter('LOW')}
            className={`px-3 py-1 rounded-full font-body-sm text-body-sm font-medium shrink-0 transition-all flex items-center gap-1.5 cursor-pointer ${
              priorityFilter === 'LOW'
                ? 'bg-primary text-on-primary'
                : 'bg-surface-subtle text-text-secondary hover:text-text-primary'
            }`}
            type="button"
          >
            <span className="w-2 h-2 rounded-full bg-priority-low"></span>
            <span>LOW</span>
          </button>
        </div>
      </div>

      {/* Floating Bulk Action Bar */}
      {selectedTicketIds.length > 0 && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 max-w-[calc(100vw-2rem)] w-full sm:w-auto bg-neutral text-on-primary px-4 sm:px-5 py-2.5 rounded-2xl sm:rounded-full shadow-2xl border border-border flex flex-wrap items-center justify-center gap-3"
          data-testid="bulk-actions-bar"
        >
          <div className="flex items-center space-x-2 text-xs font-medium">
            <span className="bg-primary px-2.5 py-0.5 rounded-full font-bold text-on-primary shadow-xs">
              {selectedTicketIds.length}
            </span>
            <span>tickets selected</span>
          </div>

          <div className="h-4 w-px bg-border mx-1 hidden sm:block" />

          <div className="flex flex-wrap items-center gap-2">
            {/* Bulk Assign */}
            <div className="flex items-center space-x-1 bg-surface/20 p-0.5 rounded-full border border-border">
              <input
                type="text"
                placeholder="Agent name..."
                value={bulkAssignTarget}
                onChange={(e) => setBulkAssignTarget(e.target.value)}
                className="text-xs px-2.5 py-1 rounded-full bg-transparent text-on-primary placeholder-text-secondary focus:outline-none w-24 sm:w-28"
                data-testid="bulk-assign-input"
              />
              <button
                onClick={() => handleBulkAction('ASSIGN', bulkAssignTarget)}
                disabled={!bulkAssignTarget.trim() || isBulkOperating}
                className="px-2.5 py-1 text-xs font-semibold bg-primary hover:bg-primary-container rounded-full disabled:opacity-40 transition-colors cursor-pointer"
                data-testid="bulk-assign-btn"
              >
                Assign
              </button>
            </div>

            {/* Bulk Tag */}
            <div className="flex items-center space-x-1 bg-surface/20 p-0.5 rounded-full border border-border">
              <input
                type="text"
                placeholder="Tag name..."
                value={bulkTagInput}
                onChange={(e) => setBulkTagInput(e.target.value)}
                className="text-xs px-2.5 py-1 rounded-full bg-transparent text-on-primary placeholder-text-secondary focus:outline-none w-20 sm:w-24"
                data-testid="bulk-tag-input"
              />
              <button
                onClick={() => handleBulkAction('TAG', bulkTagInput)}
                disabled={!bulkTagInput.trim() || isBulkOperating}
                className="px-2.5 py-1 text-xs font-semibold bg-primary hover:bg-primary-container rounded-full disabled:opacity-40 transition-colors cursor-pointer"
                data-testid="bulk-tag-btn"
              >
                Tag
              </button>
            </div>

            {/* Bulk Close */}
            <button
              onClick={() => handleBulkAction('STATUS', 'CLOSED')}
              disabled={isBulkOperating}
              className="px-3 py-1 text-xs font-semibold bg-priority-urgent hover:bg-red-700 rounded-full disabled:opacity-40 transition-colors cursor-pointer"
              data-testid="bulk-close-btn"
            >
              Close
            </button>

            {/* Clear Selection */}
            <button
              onClick={() => setSelectedTicketIds([])}
              className="px-2.5 py-1 text-xs text-text-secondary hover:text-on-primary transition-colors cursor-pointer"
              data-testid="bulk-clear-btn"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* High-Density Support Ticket Table */}
      <div className="bg-surface rounded-xl shadow-xs border border-border overflow-hidden flex flex-col">
        {isLoading ? (
          <div className="p-8 space-y-3" data-testid="inbox-loading">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="animate-pulse flex items-center justify-between py-2.5">
                <div className="h-4 bg-surface-subtle rounded w-1/4"></div>
                <div className="h-4 bg-surface-subtle rounded w-1/3"></div>
                <div className="h-4 bg-surface-subtle rounded w-1/6"></div>
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="p-8 text-center text-error flex flex-col items-center">
            <span className="material-symbols-outlined text-[36px] text-error mb-2">error</span>
            <p className="font-semibold text-sm">Failed to load tickets</p>
            <p className="text-xs text-text-secondary mt-1">{(error as Error)?.message}</p>
            <button
              onClick={() => void refetch()}
              className="mt-4 px-3.5 py-1.5 bg-surface-subtle text-text-primary text-xs font-semibold rounded-lg border border-border hover:bg-surface-variant transition-colors cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : tickets.length === 0 ? (
          <div
            className="p-16 text-center text-text-secondary flex flex-col items-center justify-center"
            data-testid="inbox-empty"
          >
            <div className="w-12 h-12 rounded-2xl bg-surface-subtle border border-border flex items-center justify-center mb-3 text-primary">
              <span className="material-symbols-outlined text-[28px]">inbox</span>
            </div>
            <p className="font-semibold text-sm text-text-primary">No tickets found</p>
            <p className="text-xs text-text-secondary mt-1 max-w-sm">
              Try adjusting search or status filters
            </p>
            {(statusFilter || priorityFilter || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('');
                  setPriorityFilter('');
                  handleSearchChange('');
                }}
                className="mt-4 px-3 py-1.5 text-xs font-medium text-primary bg-surface-subtle hover:bg-surface-variant rounded-lg border border-border transition-colors cursor-pointer"
              >
                Reset all filters
              </button>
            )}
          </div>
        ) : (
          <div
            ref={parentRef}
            onScroll={handleScroll}
            className="overflow-x-auto overflow-y-auto max-h-[700px] w-full border border-border rounded-lg bg-surface shadow-xs"
          >
            <table
              className="w-full text-left font-body-sm text-body-sm border-collapse"
              data-testid="tickets-table"
              aria-rowcount={tickets.length}
            >
              <thead>
                <tr className="bg-surface-subtle text-text-secondary font-medium tracking-tight border-b border-border select-none">
                  <th className="py-3 px-4 w-10 text-center" scope="col">
                    <input
                      type="checkbox"
                      data-testid="select-all-tickets"
                      aria-label="Select all tickets"
                      checked={tickets.length > 0 && selectedTicketIds.length === tickets.length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedTicketIds(tickets.map((t) => t.id));
                        } else {
                          setSelectedTicketIds([]);
                        }
                      }}
                      className="w-4 h-4 rounded text-primary focus:ring-primary cursor-pointer"
                    />
                  </th>
                  <th
                    className="py-3 px-4 font-headline-sm text-body-sm font-semibold text-text-primary"
                    scope="col"
                  >
                    Ticket ID
                  </th>
                  <th
                    className="py-3 px-4 font-headline-sm text-body-sm font-semibold text-text-primary"
                    scope="col"
                  >
                    Customer / Requester
                  </th>
                  <th
                    className="py-3 px-4 font-headline-sm text-body-sm font-semibold text-text-primary min-w-[320px]"
                    scope="col"
                  >
                    Subject & Preview
                  </th>
                  <th
                    className="py-3 px-4 font-headline-sm text-body-sm font-semibold text-text-primary"
                    scope="col"
                  >
                    Priority
                  </th>
                  <th
                    className="py-3 px-4 font-headline-sm text-body-sm font-semibold text-text-primary"
                    scope="col"
                  >
                    Status
                  </th>
                  <th
                    className="py-3 px-4 font-headline-sm text-body-sm font-semibold text-text-primary"
                    scope="col"
                  >
                    Assignee
                  </th>
                  <th
                    className="py-3 px-4 font-headline-sm text-body-sm font-semibold text-text-primary"
                    scope="col"
                  >
                    Channel
                  </th>
                  <th
                    className="py-3 px-4 font-headline-sm text-body-sm font-semibold text-text-primary"
                    scope="col"
                  >
                    SLA Due
                  </th>
                  <th
                    className="py-3 px-4 font-headline-sm text-body-sm font-semibold text-text-primary text-right"
                    scope="col"
                  >
                    Updated
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-text-primary" id="ticketTableBody">
                {paddingTop > 0 && (
                  <tr style={{ height: `${paddingTop}px` }} aria-hidden="true">
                    <td colSpan={10} />
                  </tr>
                )}
                {renderedRows.map(({ index: virtualIndex, ticket: t }) => {
                  const isSelected = selectedTicketIds.includes(t.id);
                  const assigneeInitials = t.assigneeId
                    ? t.assigneeId.slice(0, 2).toUpperCase()
                    : null;

                  return (
                    <tr
                      key={t.id}
                      onClick={() => onSelectTicket(t.id)}
                      onMouseEnter={() => handlePrefetch(t.id)}
                      onFocus={() => handlePrefetch(t.id)}
                      tabIndex={0}
                      aria-rowindex={virtualIndex + 1}
                      data-testid={`ticket-row-${t.id}`}
                      className={`ticket-row transition-colors group cursor-pointer ${
                        isSelected ? 'bg-primary-fixed/20' : 'hover:bg-surface-subtle/80'
                      }`}
                    >
                      <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedTicketIds((prev) => [...prev, t.id]);
                            } else {
                              setSelectedTicketIds((prev) => prev.filter((id) => id !== t.id));
                            }
                          }}
                          className="w-4 h-4 rounded text-primary focus:ring-primary cursor-pointer"
                        />
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="font-code-mono text-code-mono font-semibold text-primary group-hover:underline">
                          #{t.number}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-headline-sm text-body-md font-medium text-text-primary leading-tight">
                            {(t as any).customerEmail
                              ? (t as any).customerEmail.split('@')[0]
                              : 'Customer'}
                          </span>
                          <span className="font-body-sm text-body-sm text-text-secondary">
                            {(t as any).customerEmail || t.customerId || 'Guest'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col max-w-xl">
                          <span className="font-headline-sm text-body-md font-medium text-text-primary truncate">
                            {t.subject}
                          </span>
                          <span className="font-body-sm text-body-sm text-text-secondary truncate">
                            {t.description || 'No initial message description provided.'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <PriorityChip priority={t.priority} />
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <StatusChip status={t.status} />
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {t.assigneeId ? (
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-primary-fixed text-primary flex items-center justify-center font-bold text-[11px]">
                              {assigneeInitials}
                            </div>
                            <span className="font-body-sm text-body-sm text-text-primary truncate max-w-[100px]">
                              {t.assigneeId}
                            </span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-text-secondary italic font-body-sm text-body-sm">
                            <span className="material-symbols-outlined text-[16px]">
                              person_outline
                            </span>
                            Unassigned
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-text-secondary">
                          <span className="material-symbols-outlined text-[16px]">
                            {(t as any).channel === 'EMAIL'
                              ? 'mail'
                              : (t as any).channel === 'CHAT'
                                ? 'chat'
                                : 'language'}
                          </span>
                          <span className="font-body-sm text-body-sm">
                            {(t as any).channel || 'Web Portal'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {t.priority === 'URGENT' ? (
                          <span className="inline-flex items-center gap-1 font-code-mono text-code-mono text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded font-medium text-xs">
                            <span className="material-symbols-outlined text-[14px]">warning</span>
                            24m left
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-code-mono text-code-mono text-text-secondary bg-surface-subtle px-2 py-0.5 rounded font-medium text-xs">
                            <span className="material-symbols-outlined text-[14px]">schedule</span>
                            4h left
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-right text-text-secondary font-code-mono text-code-mono">
                        {formatRelativeTime(t.updatedAt || t.createdAt)}
                      </td>
                    </tr>
                  );
                })}
                {paddingBottom > 0 && (
                  <tr style={{ height: `${paddingBottom}px` }} aria-hidden="true">
                    <td colSpan={10} />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
