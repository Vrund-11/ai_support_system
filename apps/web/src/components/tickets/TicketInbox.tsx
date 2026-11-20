import { useState, useTransition } from 'react';
import { useTickets } from '../../hooks/useTickets';
import { StatusChip } from './StatusChip';
import { PriorityChip } from './PriorityChip';
import { api } from '../../lib/api';
import type { TicketStatus, TicketPriority } from '@supportpilot/shared-types';
import { Search, Filter, AlertCircle, RefreshCw } from 'lucide-react';

interface TicketInboxProps {
  onSelectTicket: (ticketId: string) => void;
  onOpenCreate: () => void;
}

export function TicketInbox({ onSelectTicket }: TicketInboxProps) {
  const [statusFilter, setStatusFilter] = useState<TicketStatus | ''>('');
  const [priorityFilter, setPriorityFilter] = useState<TicketPriority | ''>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [, startTransition] = useTransition();

  const [selectedTicketIds, setSelectedTicketIds] = useState<string[]>([]);
  const [bulkAssignTarget, setBulkAssignTarget] = useState('');
  const [bulkTagInput, setBulkTagInput] = useState('');
  const [isBulkOperating, setIsBulkOperating] = useState(false);

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    startTransition(() => {
      setDebouncedSearch(val);
    });
  };

  const { data, isLoading, isError, error, refetch } = useTickets({
    status: statusFilter,
    priority: priorityFilter,
    q: debouncedSearch.trim() || undefined,
  });

  const tickets = data?.data || [];

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
    } catch (err) {
      alert((err as Error).message || 'Failed to execute bulk action');
    } finally {
      setIsBulkOperating(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters and search bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search tickets by subject..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            data-testid="search-input"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center space-x-1.5 text-xs text-slate-500">
            <Filter className="w-3.5 h-3.5" />
            <span className="font-semibold uppercase tracking-wider">Filters:</span>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as TicketStatus | '')}
            className="text-xs bg-slate-50 border border-slate-300 rounded-md px-2.5 py-1.5 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
            className="text-xs bg-slate-50 border border-slate-300 rounded-md px-2.5 py-1.5 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
            className="p-1.5 text-slate-400 hover:text-slate-600 border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Bulk actions bar */}
      {selectedTicketIds.length > 0 && (
        <div
          className="bg-slate-900 text-white px-4 py-3 rounded-xl shadow-lg flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-150"
          data-testid="bulk-actions-bar"
        >
          <div className="flex items-center space-x-2 text-xs font-medium">
            <span className="bg-indigo-600 px-2 py-0.5 rounded font-bold">
              {selectedTicketIds.length}
            </span>
            <span>tickets selected</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Bulk Assign */}
            <div className="flex items-center space-x-1">
              <input
                type="text"
                placeholder="Agent name..."
                value={bulkAssignTarget}
                onChange={(e) => setBulkAssignTarget(e.target.value)}
                className="text-xs px-2 py-1 rounded bg-slate-800 text-white placeholder-slate-400 border border-slate-700 focus:outline-none"
                data-testid="bulk-assign-input"
              />
              <button
                onClick={() => handleBulkAction('ASSIGN', bulkAssignTarget)}
                disabled={!bulkAssignTarget.trim() || isBulkOperating}
                className="px-2.5 py-1 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 rounded disabled:opacity-50 transition-colors"
                data-testid="bulk-assign-btn"
              >
                Assign
              </button>
            </div>

            {/* Bulk Tag */}
            <div className="flex items-center space-x-1">
              <input
                type="text"
                placeholder="Tag name..."
                value={bulkTagInput}
                onChange={(e) => setBulkTagInput(e.target.value)}
                className="text-xs px-2 py-1 rounded bg-slate-800 text-white placeholder-slate-400 border border-slate-700 focus:outline-none"
                data-testid="bulk-tag-input"
              />
              <button
                onClick={() => handleBulkAction('TAG', bulkTagInput)}
                disabled={!bulkTagInput.trim() || isBulkOperating}
                className="px-2.5 py-1 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 rounded disabled:opacity-50 transition-colors"
                data-testid="bulk-tag-btn"
              >
                Tag
              </button>
            </div>

            {/* Bulk Close */}
            <button
              onClick={() => handleBulkAction('STATUS', 'CLOSED')}
              disabled={isBulkOperating}
              className="px-2.5 py-1 text-xs font-semibold bg-rose-600 hover:bg-rose-500 rounded disabled:opacity-50 transition-colors"
              data-testid="bulk-close-btn"
            >
              Close
            </button>

            {/* Clear Selection */}
            <button
              onClick={() => setSelectedTicketIds([])}
              className="px-2 py-1 text-xs text-slate-400 hover:text-white transition-colors"
              data-testid="bulk-clear-btn"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Ticket List Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 space-y-3" data-testid="inbox-loading">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="animate-pulse flex items-center justify-between py-2">
                <div className="h-4 bg-slate-200 rounded w-1/4"></div>
                <div className="h-4 bg-slate-200 rounded w-1/3"></div>
                <div className="h-4 bg-slate-200 rounded w-1/6"></div>
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="p-8 text-center text-rose-600 flex flex-col items-center">
            <AlertCircle className="w-8 h-8 mb-2" />
            <p className="font-semibold text-sm">Failed to load tickets</p>
            <p className="text-xs text-rose-500 mt-1">{(error as Error)?.message}</p>
            <button
              onClick={() => void refetch()}
              className="mt-4 px-3 py-1.5 bg-rose-50 text-rose-700 text-xs font-semibold rounded border border-rose-200 hover:bg-rose-100"
            >
              Retry
            </button>
          </div>
        ) : tickets.length === 0 ? (
          <div className="p-12 text-center text-slate-500" data-testid="inbox-empty">
            <p className="font-medium text-sm">No tickets found</p>
            <p className="text-xs text-slate-400 mt-1">Try adjusting search or status filters</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm" data-testid="tickets-table">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-3 w-8">
                    <input
                      type="checkbox"
                      data-testid="select-all-tickets"
                      checked={tickets.length > 0 && selectedTicketIds.length === tickets.length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedTicketIds(tickets.map((t) => t.id));
                        } else {
                          setSelectedTicketIds([]);
                        }
                      }}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                  </th>
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Subject</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Tags</th>
                  <th className="px-4 py-3 text-right">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tickets.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => onSelectTicket(t.id)}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                    data-testid={`ticket-row-${t.id}`}
                  >
                    <td className="px-3 py-3.5" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        data-testid={`ticket-checkbox-${t.id}`}
                        checked={selectedTicketIds.includes(t.id)}
                        onChange={() => {
                          setSelectedTicketIds((prev) =>
                            prev.includes(t.id)
                              ? prev.filter((id) => id !== t.id)
                              : [...prev, t.id],
                          );
                        }}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs font-semibold text-indigo-600">
                      #{t.number}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-medium text-slate-900 line-clamp-1">{t.subject}</div>
                      <div className="text-xs text-slate-400 line-clamp-1 mt-0.5">
                        {t.description}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusChip status={t.status} />
                    </td>
                    <td className="px-4 py-3.5">
                      <PriorityChip priority={t.priority} />
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap gap-1">
                        {t.tags?.map((tag) => (
                          <span
                            key={tag}
                            className="bg-slate-100 text-slate-600 text-[10px] font-mono px-1.5 py-0.5 rounded"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right text-xs text-slate-400">
                      {new Date(t.updatedAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
