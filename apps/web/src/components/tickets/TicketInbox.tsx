import { useState, useEffect } from 'react';
import { useTickets } from '../../hooks/useTickets';
import { StatusChip } from './StatusChip';
import { PriorityChip } from './PriorityChip';
import { api } from '../../lib/api';
import { toast } from '../../store/toast.store';
import type { TicketStatus, TicketPriority } from '@supportpilot/shared-types';
import {
  Search,
  Filter,
  AlertCircle,
  RefreshCw,
  X,
  Inbox,
  Clock,
  UserCheck,
  UserX,
} from 'lucide-react';

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

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data, isLoading, isError, error, refetch } = useTickets({
    status: statusFilter,
    priority: priorityFilter,
    q: debouncedSearch.trim() || undefined,
  });

  const tickets = data?.data || [];

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

  // Header filter chips with live counts
  const filterChips: Array<{
    label: string;
    value: TicketStatus | '';
    count?: number;
  }> = [
    { label: 'All', value: '', count: tickets.length },
    {
      label: 'Open',
      value: 'OPEN',
      count: statusFilter === '' ? tickets.filter((t) => t.status === 'OPEN').length : undefined,
    },
    {
      label: 'In Progress',
      value: 'PENDING_CUSTOMER',
      count:
        statusFilter === ''
          ? tickets.filter((t) => t.status === 'PENDING_CUSTOMER' || t.status === 'ON_HOLD').length
          : undefined,
    },
    {
      label: 'Resolved',
      value: 'RESOLVED',
      count:
        statusFilter === '' ? tickets.filter((t) => t.status === 'RESOLVED').length : undefined,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Stitch Metric KPI Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-3.5 border border-slate-200/80 dark:border-zinc-800 shadow-xs flex flex-col justify-between transition-colors">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400 font-medium">
            <span>Open Tickets</span>
            <span className="p-1 rounded-md bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
              <Inbox className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-bold text-slate-900 dark:text-zinc-100">
              {openCount} tickets
            </span>
            <span className="text-[11px] font-mono font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.5 rounded">
              Active
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-xl p-3.5 border border-slate-200/80 dark:border-zinc-800 shadow-xs flex flex-col justify-between transition-colors">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400 font-medium">
            <span>Unassigned</span>
            <span className="p-1 rounded-md bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
              <UserX className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-bold text-slate-900 dark:text-zinc-100">
              {unassignedCount} queue
            </span>
            <span className="text-[11px] font-mono font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-1.5 py-0.5 rounded">
              Needs Triage
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-xl p-3.5 border border-slate-200/80 dark:border-zinc-800 shadow-xs flex flex-col justify-between transition-colors">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400 font-medium">
            <span>Urgent Priority</span>
            <span className="p-1 rounded-md bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400">
              <AlertCircle className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-bold text-rose-600 dark:text-rose-400">
              {urgentCount} critical
            </span>
            <span className="text-[11px] font-mono font-medium text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 px-1.5 py-0.5 rounded">
              Critical
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-xl p-3.5 border border-slate-200/80 dark:border-zinc-800 shadow-xs flex flex-col justify-between transition-colors">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400 font-medium">
            <span>Avg First Response</span>
            <span className="p-1 rounded-md bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
              <Clock className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-bold text-slate-900 dark:text-zinc-100">18m</span>
            <span className="text-[11px] font-mono font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.5 rounded">
              -4m target
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-xl p-3.5 border border-slate-200/80 dark:border-zinc-800 shadow-xs col-span-2 sm:col-span-1 flex flex-col justify-between transition-colors">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400 font-medium">
            <span>CSAT Score</span>
            <span className="p-1 rounded-md bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
              <UserCheck className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-bold text-slate-900 dark:text-zinc-100">98.4%</span>
            <span className="text-[11px] font-mono font-medium text-amber-500">★ 4.92</span>
          </div>
        </div>
      </div>
      {/* Header Filter Chips Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-zinc-900 p-3.5 rounded-xl border border-slate-200/80 dark:border-zinc-800 shadow-xs transition-colors">
        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
          {filterChips.map((chip) => {
            const isActive = statusFilter === chip.value;
            return (
              <button
                key={chip.label}
                type="button"
                onClick={() => setStatusFilter(chip.value)}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200/70 dark:hover:bg-zinc-700 hover:text-slate-900 dark:hover:text-zinc-100'
                }`}
              >
                <span>{chip.label}</span>
                {typeof chip.count === 'number' && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                      isActive
                        ? 'bg-indigo-700/80 text-white'
                        : 'bg-slate-200 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300'
                    }`}
                  >
                    ({chip.count})
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Secondary controls: priority filter & refresh */}
        <div className="flex items-center gap-2">
          {/* Status select for test compatibility and granular options */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as TicketStatus | '')}
            aria-label="Filter tickets by status"
            className="text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 text-slate-700 dark:text-zinc-200 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            data-testid="status-filter-select"
          >
            <option value="">All Statuses</option>
            <option value="NEW">New</option>
            <option value="OPEN">Open</option>
            <option value="PENDING_CUSTOMER">Pending Customer</option>
            <option value="ON_HOLD">On Hold</option>
            <option value="RESOLVED">Resolved</option>
            <option value="CLOSED">Closed</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as TicketPriority | '')}
            aria-label="Filter tickets by priority"
            className="text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 text-slate-700 dark:text-zinc-200 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            data-testid="priority-filter-select"
          >
            <option value="">All Priorities</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </select>

          <button
            onClick={() => void refetch()}
            title="Refresh tickets"
            className="p-1.5 text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 border border-slate-200 dark:border-zinc-700 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Search and Secondary Filter Row */}
      <div className="bg-white dark:bg-zinc-900 px-4 py-3 rounded-xl border border-slate-200/80 dark:border-zinc-800 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between transition-colors">
        <div className="relative w-full md:w-96 group">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400 dark:text-zinc-500 group-focus-within:text-indigo-600 dark:group-focus-within:text-indigo-400 transition-colors" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search tickets by subject, description..."
            aria-label="Search tickets"
            className="w-full pl-9 pr-8 py-1.5 text-sm bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400 dark:placeholder:text-zinc-500"
            data-testid="search-input"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => handleSearchChange('')}
              className="absolute right-2.5 top-2 text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors"
              title="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400 w-full md:w-auto justify-end">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500" />
            <span className="font-semibold uppercase tracking-wider text-[11px] text-slate-400 dark:text-zinc-500">
              Showing {tickets.length} {tickets.length === 1 ? 'ticket' : 'tickets'}
            </span>
          </div>
          {onOpenCreate && (
            <button
              type="button"
              onClick={onOpenCreate}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
              data-testid="inbox-new-ticket-btn"
            >
              <span>+ New Ticket</span>
            </button>
          )}
        </div>
      </div>

      {/* Floating bulk action bar */}
      {selectedTicketIds.length > 0 && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 max-w-[calc(100vw-2rem)] w-full sm:w-auto bg-zinc-900/90 backdrop-blur-md text-white px-4 sm:px-5 py-2.5 rounded-2xl sm:rounded-full shadow-2xl border border-zinc-700/50 flex flex-wrap items-center justify-center gap-3 animate-in fade-in slide-in-from-bottom-3 duration-200"
          data-testid="bulk-actions-bar"
        >
          <div className="flex items-center space-x-2 text-xs font-medium">
            <span className="bg-indigo-600 px-2.5 py-0.5 rounded-full font-bold text-white shadow-xs">
              {selectedTicketIds.length}
            </span>
            <span className="text-zinc-200">tickets selected</span>
          </div>

          <div className="h-4 w-px bg-zinc-700 mx-1 hidden sm:block" />

          <div className="flex flex-wrap items-center gap-2">
            {/* Bulk Assign */}
            <div className="flex items-center space-x-1 bg-zinc-800/80 p-0.5 rounded-full border border-zinc-700">
              <input
                type="text"
                placeholder="Agent name..."
                value={bulkAssignTarget}
                onChange={(e) => setBulkAssignTarget(e.target.value)}
                className="text-xs px-2.5 py-1 rounded-full bg-transparent text-white placeholder-zinc-400 focus:outline-none w-24 sm:w-28"
                data-testid="bulk-assign-input"
              />
              <button
                onClick={() => handleBulkAction('ASSIGN', bulkAssignTarget)}
                disabled={!bulkAssignTarget.trim() || isBulkOperating}
                className="px-2.5 py-1 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 rounded-full disabled:opacity-40 transition-colors cursor-pointer"
                data-testid="bulk-assign-btn"
              >
                Assign
              </button>
            </div>

            {/* Bulk Tag */}
            <div className="flex items-center space-x-1 bg-zinc-800/80 p-0.5 rounded-full border border-zinc-700">
              <input
                type="text"
                placeholder="Tag name..."
                value={bulkTagInput}
                onChange={(e) => setBulkTagInput(e.target.value)}
                className="text-xs px-2.5 py-1 rounded-full bg-transparent text-white placeholder-zinc-400 focus:outline-none w-20 sm:w-24"
                data-testid="bulk-tag-input"
              />
              <button
                onClick={() => handleBulkAction('TAG', bulkTagInput)}
                disabled={!bulkTagInput.trim() || isBulkOperating}
                className="px-2.5 py-1 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 rounded-full disabled:opacity-40 transition-colors cursor-pointer"
                data-testid="bulk-tag-btn"
              >
                Tag
              </button>
            </div>

            {/* Bulk Close */}
            <button
              onClick={() => handleBulkAction('STATUS', 'CLOSED')}
              disabled={isBulkOperating}
              className="px-3 py-1 text-xs font-semibold bg-rose-600 hover:bg-rose-500 rounded-full disabled:opacity-40 transition-colors shadow-xs cursor-pointer"
              data-testid="bulk-close-btn"
            >
              Close
            </button>

            {/* Clear Selection */}
            <button
              onClick={() => setSelectedTicketIds([])}
              className="px-2.5 py-1 text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer"
              data-testid="bulk-clear-btn"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Ticket List Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200/80 dark:border-zinc-800 shadow-xs overflow-hidden transition-colors">
        {isLoading ? (
          <div className="p-8 space-y-3" data-testid="inbox-loading">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="animate-pulse flex items-center justify-between py-2.5">
                <div className="h-4 bg-slate-100 dark:bg-zinc-800 rounded w-1/4"></div>
                <div className="h-4 bg-slate-100 dark:bg-zinc-800 rounded w-1/3"></div>
                <div className="h-4 bg-slate-100 dark:bg-zinc-800 rounded w-1/6"></div>
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="p-8 text-center text-rose-600 dark:text-rose-400 flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-center justify-center mb-3">
              <AlertCircle className="w-6 h-6 text-rose-600 dark:text-rose-400" />
            </div>
            <p className="font-semibold text-sm">Failed to load tickets</p>
            <p className="text-xs text-rose-500 dark:text-rose-400/80 mt-1">
              {(error as Error)?.message}
            </p>
            <button
              onClick={() => void refetch()}
              className="mt-4 px-3.5 py-1.5 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs font-semibold rounded-lg border border-rose-200 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : tickets.length === 0 ? (
          <div
            className="p-16 text-center text-slate-500 dark:text-zinc-400 flex flex-col items-center justify-center"
            data-testid="inbox-empty"
          >
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-center mb-3 text-indigo-600 dark:text-indigo-400">
              <Inbox className="w-6 h-6" />
            </div>
            <p className="font-semibold text-sm text-slate-800 dark:text-zinc-200">
              No tickets found
            </p>
            <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1 max-w-sm">
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
                className="mt-4 px-3 py-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded-lg border border-indigo-200 dark:border-indigo-800 transition-colors cursor-pointer"
              >
                Reset all filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm hidden md:table" data-testid="tickets-table">
              <thead className="bg-slate-50/75 dark:bg-zinc-800/60 border-b border-slate-200 dark:border-zinc-800 text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider select-none">
                <tr>
                  <th className="px-3.5 py-3 w-8">
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
                      className="rounded border-slate-300 dark:border-zinc-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                  </th>
                  <th className="px-3 py-3 w-20">#</th>
                  <th className="px-4 py-3">Subject</th>
                  <th className="px-4 py-3 w-32">Status</th>
                  <th className="px-4 py-3 w-28">Priority</th>
                  <th className="px-4 py-3 w-28">Assignee</th>
                  <th className="px-4 py-3">Tags</th>
                  <th className="px-4 py-3 text-right w-36">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {tickets.map((t) => {
                  const isSelected = selectedTicketIds.includes(t.id);
                  return (
                    <tr
                      key={t.id}
                      onClick={() => onSelectTicket(t.id)}
                      className={`group cursor-pointer transition-colors duration-150 ${
                        isSelected
                          ? 'bg-indigo-50/40 dark:bg-indigo-950/30 hover:bg-indigo-50/60 dark:hover:bg-indigo-950/50'
                          : 'hover:bg-slate-50/80 dark:hover:bg-zinc-800/50'
                      }`}
                      data-testid={`ticket-row-${t.id}`}
                    >
                      <td className="px-3.5 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          data-testid={`ticket-checkbox-${t.id}`}
                          checked={isSelected}
                          onChange={() => {
                            setSelectedTicketIds((prev) =>
                              prev.includes(t.id)
                                ? prev.filter((id) => id !== t.id)
                                : [...prev, t.id],
                            );
                          }}
                          className="rounded border-slate-300 dark:border-zinc-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      </td>
                      <td className="px-3 py-3 font-mono text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                        #{t.number}
                      </td>
                      <td className="px-4 py-3 max-w-md">
                        <div className="font-medium text-slate-900 dark:text-zinc-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-1">
                          {t.subject}
                        </div>
                        <div className="text-xs text-slate-400 dark:text-zinc-500 line-clamp-1 mt-0.5">
                          {t.description}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusChip status={t.status} />
                      </td>
                      <td className="px-4 py-3">
                        <PriorityChip priority={t.priority} />
                      </td>
                      <td className="px-4 py-3">
                        {t.assigneeId ? (
                          <div
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-slate-700 dark:text-zinc-300"
                            title={`Assigned to ${t.assigneeId}`}
                          >
                            <span className="w-4 h-4 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 font-bold text-[9px] flex items-center justify-center">
                              <UserCheck className="w-2.5 h-2.5" />
                            </span>
                            <span className="truncate max-w-[70px] text-[11px] font-medium">
                              {t.assigneeId}
                            </span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 dark:text-zinc-500">
                            <UserX className="w-3 h-3 text-slate-300 dark:text-zinc-600" />
                            <span className="italic">Unassigned</span>
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {t.tags && t.tags.length > 0 ? (
                            t.tags.map((tag) => (
                              <span
                                key={tag}
                                className="bg-slate-100/90 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 text-[10px] font-mono px-1.5 py-0.5 rounded border border-slate-200/60 dark:border-zinc-700"
                              >
                                {tag}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-300 dark:text-zinc-600 text-xs">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-slate-400 dark:text-zinc-500">
                        <div className="flex items-center justify-end gap-1 font-mono text-[11px] text-slate-500 dark:text-zinc-400">
                          <Clock className="w-3 h-3 text-slate-400 dark:text-zinc-500" />
                          <span>{formatRelativeTime(t.updatedAt)}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 dark:text-zinc-500">
                          {new Date(t.updatedAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Mobile Ticket Cards View (Stitch Mobile Spec) */}
            <div className="block md:hidden divide-y divide-slate-100">
              {tickets.map((t) => {
                const isSelected = selectedTicketIds.includes(t.id);
                const priorityBorder =
                  t.priority === 'URGENT'
                    ? 'border-l-4 border-l-rose-500'
                    : t.priority === 'HIGH'
                      ? 'border-l-4 border-l-amber-500'
                      : t.priority === 'MEDIUM'
                        ? 'border-l-4 border-l-blue-500'
                        : 'border-l-4 border-l-slate-300';

                return (
                  <div
                    key={`mobile-${t.id}`}
                    role="button"
                    tabIndex={0}
                    aria-label={`View ticket #${t.number}: ${t.subject}`}
                    onClick={() => onSelectTicket(t.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelectTicket(t.id);
                      }
                    }}
                    className={`p-3.5 flex flex-col gap-2 ${priorityBorder} transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-50/50 dark:bg-indigo-950/40'
                        : 'bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800/60'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          aria-label={`Select ticket #${t.number}`}
                          data-testid={`ticket-checkbox-mobile-${t.id}`}
                          onClick={(e) => e.stopPropagation()}
                          onChange={() => {
                            setSelectedTicketIds((prev) =>
                              prev.includes(t.id)
                                ? prev.filter((id) => id !== t.id)
                                : [...prev, t.id],
                            );
                          }}
                          className="rounded border-slate-300 dark:border-zinc-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                        <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                          Ticket #{t.number}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <StatusChip status={t.status} />
                        <span className="text-[11px] font-mono text-slate-400 dark:text-zinc-500">
                          {formatRelativeTime(t.updatedAt)}
                        </span>
                      </div>
                    </div>

                    <div>
                      <div className="font-semibold text-sm text-slate-900 dark:text-zinc-100 line-clamp-1">
                        Subject: {t.subject}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-zinc-400 line-clamp-2 mt-0.5">
                        Details: {t.description}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-50 dark:border-zinc-800">
                      <PriorityChip priority={t.priority} />
                      {t.assigneeId ? (
                        <span className="text-[11px] text-slate-600 dark:text-zinc-400 font-medium truncate max-w-[120px]">
                          {t.assigneeId}
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400 dark:text-zinc-500 italic">
                          Unassigned
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
