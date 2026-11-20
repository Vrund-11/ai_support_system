import { useState } from 'react';
import { useTicketDetail, useUpdateTicket, useAddMessage } from '../../hooks/useTickets';
import { StatusChip } from './StatusChip';
import { PriorityChip } from './PriorityChip';
import type { TicketStatus, TicketPriority } from '@supportpilot/shared-types';
import {
  ArrowLeft,
  Send,
  Lock,
  MessageSquare,
  History,
  AlertTriangle,
  Loader2,
  CheckCircle2,
} from 'lucide-react';

interface TicketDetailProps {
  ticketId: string;
  onBack: () => void;
}

export function TicketDetail({ ticketId, onBack }: TicketDetailProps) {
  const { data, isLoading, isError, error, refetch } = useTicketDetail(ticketId);
  const updateTicket = useUpdateTicket(ticketId);
  const addMessage = useAddMessage(ticketId);

  const [messageBody, setMessageBody] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [conflictWarning, setConflictWarning] = useState(false);

  if (isLoading) {
    return (
      <div
        className="bg-white rounded-xl border border-slate-200 p-8 space-y-4"
        data-testid="detail-loading"
      >
        <div className="h-6 bg-slate-200 rounded w-1/3 animate-pulse"></div>
        <div className="h-20 bg-slate-100 rounded animate-pulse"></div>
        <div className="h-40 bg-slate-100 rounded animate-pulse"></div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-rose-600">
        <p className="font-semibold text-sm">Failed to load ticket details</p>
        <p className="text-xs text-slate-500 mt-1">{(error as Error)?.message}</p>
        <button
          onClick={onBack}
          className="mt-4 px-4 py-2 bg-slate-100 text-slate-700 text-xs font-semibold rounded-md hover:bg-slate-200"
        >
          Back to Inbox
        </button>
      </div>
    );
  }

  const { ticket, timeline, messages } = data;

  const handleStatusChange = async (newStatus: TicketStatus) => {
    setConflictWarning(false);
    try {
      await updateTicket.mutateAsync({
        version: ticket.version,
        status: newStatus,
      });
    } catch (err: unknown) {
      if ((err as { status?: number })?.status === 409) {
        setConflictWarning(true);
        void refetch();
      }
    }
  };

  const handlePriorityChange = async (newPriority: TicketPriority) => {
    setConflictWarning(false);
    try {
      await updateTicket.mutateAsync({
        version: ticket.version,
        priority: newPriority,
      });
    } catch (err: unknown) {
      if ((err as { status?: number })?.status === 409) {
        setConflictWarning(true);
        void refetch();
      }
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageBody.trim()) return;

    try {
      await addMessage.mutateAsync({
        body: messageBody.trim(),
        isInternal,
      });
      setMessageBody('');
    } catch {
      // Handled by mutation state
    }
  };

  return (
    <div className="space-y-6" data-testid="ticket-detail-view">
      {/* Top action bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center space-x-1.5 text-xs font-medium text-slate-600 hover:text-indigo-600 transition-colors"
          data-testid="back-button"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Inbox</span>
        </button>

        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold text-slate-500 uppercase">Status:</span>
            <select
              value={ticket.status}
              disabled={ticket.status === 'CLOSED' || updateTicket.isPending}
              onChange={(e) => handleStatusChange(e.target.value as TicketStatus)}
              className="text-xs bg-white border border-slate-300 rounded px-2 py-1 font-medium text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:opacity-50"
              data-testid="detail-status-select"
            >
              <option value="NEW">New</option>
              <option value="OPEN">Open</option>
              <option value="PENDING_CUSTOMER">Pending Customer</option>
              <option value="ON_HOLD">On Hold</option>
              <option value="RESOLVED">Resolved</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold text-slate-500 uppercase">Priority:</span>
            <select
              value={ticket.priority}
              disabled={ticket.status === 'CLOSED' || updateTicket.isPending}
              onChange={(e) => handlePriorityChange(e.target.value as TicketPriority)}
              className="text-xs bg-white border border-slate-300 rounded px-2 py-1 font-medium text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:opacity-50"
              data-testid="detail-priority-select"
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </div>
        </div>
      </div>

      {conflictWarning && (
        <div
          className="p-3 bg-amber-50 border border-amber-300 text-amber-800 text-xs rounded-lg flex items-center space-x-2"
          data-testid="conflict-warning"
        >
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            Ticket was modified concurrently by another user. Latest version has been reloaded.
          </span>
        </div>
      )}

      {/* Ticket Header & Description */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center space-x-3 mb-2">
          <span className="font-mono text-sm font-bold text-indigo-600">#{ticket.number}</span>
          <h1 className="text-xl font-bold text-slate-900">{ticket.subject}</h1>
          <StatusChip status={ticket.status} />
          <PriorityChip priority={ticket.priority} />
        </div>

        <div className="text-xs text-slate-400 mb-4 flex items-center space-x-4">
          <span>Customer ID: {ticket.customerId}</span>
          <span>Version: {ticket.version}</span>
          <span>Created: {new Date(ticket.createdAt).toLocaleString()}</span>
        </div>

        <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
          {ticket.description}
        </div>
      </div>

      {/* Grid: Message thread (left 2/3) + Activity Timeline (right 1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Messages Thread and Composer */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h2 className="text-sm font-bold text-slate-900 mb-4 flex items-center space-x-2">
              <MessageSquare className="w-4 h-4 text-indigo-600" />
              <span>Conversation Thread ({messages.length})</span>
            </h2>

            {messages.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-4">
                No messages yet. Add a reply or note below.
              </p>
            ) : (
              <div className="space-y-4" data-testid="message-thread">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`p-4 rounded-lg border text-sm ${
                      msg.isInternal
                        ? 'bg-amber-50/70 border-amber-200 text-slate-800'
                        : msg.senderType === 'CUSTOMER'
                          ? 'bg-slate-50 border-slate-200 text-slate-800'
                          : msg.senderType === 'AI'
                            ? 'bg-purple-50/60 border-purple-200 text-slate-800'
                            : 'bg-indigo-50/60 border-indigo-200 text-slate-800'
                    }`}
                    data-testid={`message-${msg.id}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        {msg.isInternal && (
                          <span className="flex items-center space-x-1 bg-amber-200/80 text-amber-900 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded">
                            <Lock className="w-2.5 h-2.5" />
                            <span>Internal Note</span>
                          </span>
                        )}
                        <span className="text-xs font-semibold text-slate-700">
                          {msg.senderType}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">seq #{msg.seq}</span>
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {new Date(msg.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <div className="whitespace-pre-wrap leading-relaxed text-sm">{msg.body}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Composer */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            {ticket.status === 'CLOSED' ? (
              <div className="p-3 bg-slate-100 rounded-lg text-xs text-slate-500 text-center">
                This ticket is closed. Reopen or create a new ticket to continue conversation.
              </div>
            ) : (
              <form onSubmit={handleSendMessage} className="space-y-4">
                <div className="flex items-center space-x-4 border-b border-slate-100 pb-3">
                  <button
                    type="button"
                    onClick={() => setIsInternal(false)}
                    className={`flex items-center space-x-1.5 text-xs font-semibold pb-1 border-b-2 transition-colors cursor-pointer ${
                      !isInternal
                        ? 'border-indigo-600 text-indigo-600'
                        : 'border-transparent text-slate-400 hover:text-slate-600'
                    }`}
                    data-testid="composer-public-tab"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Public Reply</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsInternal(true)}
                    className={`flex items-center space-x-1.5 text-xs font-semibold pb-1 border-b-2 transition-colors cursor-pointer ${
                      isInternal
                        ? 'border-amber-500 text-amber-700'
                        : 'border-transparent text-slate-400 hover:text-slate-600'
                    }`}
                    data-testid="composer-internal-tab"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Internal Note</span>
                  </button>
                </div>

                <textarea
                  rows={3}
                  required
                  value={messageBody}
                  onChange={(e) => setMessageBody(e.target.value)}
                  placeholder={
                    isInternal
                      ? 'Add an internal note visible only to agents and leads...'
                      : 'Type a customer reply...'
                  }
                  className={`w-full p-3 border rounded-lg text-sm focus:outline-none focus:ring-2 ${
                    isInternal
                      ? 'bg-amber-50/30 border-amber-200 focus:ring-amber-500'
                      : 'bg-white border-slate-300 focus:ring-indigo-500'
                  }`}
                  data-testid="message-textarea"
                />

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={addMessage.isPending || !messageBody.trim()}
                    className={`px-4 py-2 text-xs font-medium text-white rounded-md shadow-sm disabled:opacity-50 flex items-center space-x-1.5 cursor-pointer ${
                      isInternal
                        ? 'bg-amber-600 hover:bg-amber-700'
                        : 'bg-indigo-600 hover:bg-indigo-700'
                    }`}
                    data-testid="send-message-button"
                  >
                    {addMessage.isPending ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Sending...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>{isInternal ? 'Post Note' : 'Send Reply'}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Activity Timeline (right column) */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm h-fit">
          <h2 className="text-sm font-bold text-slate-900 mb-4 flex items-center space-x-2">
            <History className="w-4 h-4 text-indigo-600" />
            <span>Activity Timeline</span>
          </h2>

          <div className="space-y-4" data-testid="activity-timeline">
            {timeline.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No events recorded yet.</p>
            ) : (
              timeline.map((event) => (
                <div
                  key={event.id}
                  className="relative pl-6 pb-2 border-l border-slate-200 last:border-l-0 text-xs"
                >
                  <div className="absolute -left-1.5 top-0.5 w-3 h-3 bg-white border-2 border-indigo-500 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="w-2 h-2 text-indigo-500" />
                  </div>
                  <div className="font-semibold text-slate-700 uppercase tracking-wider text-[10px]">
                    {event.type}
                  </div>
                  <div className="text-slate-500 mt-0.5 text-[11px]">
                    {JSON.stringify(event.payload || {})}
                  </div>
                  <div className="text-slate-400 text-[10px] mt-1">
                    {new Date(event.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
