import { useState, type FormEvent } from 'react';
import { api, ApiError } from '../../lib/api';
import { StatusChip } from '../tickets/StatusChip';
import { PriorityChip } from '../tickets/PriorityChip';
import type {
  TicketStatus,
  TicketPriority,
  TicketEventDto,
  MessageDto,
} from '@supportpilot/shared-types';
import {
  Search,
  Ticket,
  Mail,
  Clock,
  MessageSquare,
  History,
  AlertCircle,
  CheckCircle2,
  Loader2,
  User,
  Bot,
  UserCheck,
  ShieldCheck,
  ArrowLeft,
} from 'lucide-react';

export interface TrackedTicketData {
  ticket: {
    id: string;
    number: number;
    subject: string;
    description: string;
    status: TicketStatus;
    priority: TicketPriority;
    createdAt: string;
    updatedAt: string;
  };
  timeline: TicketEventDto[];
  messages: MessageDto[];
}

interface PublicTicketTrackerProps {
  onBack?: () => void;
  defaultTicketNumber?: string;
  defaultEmail?: string;
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

export function PublicTicketTracker({
  onBack,
  defaultTicketNumber = '',
  defaultEmail = '',
}: PublicTicketTrackerProps) {
  const [ticketNumber, setTicketNumber] = useState(defaultTicketNumber);
  const [email, setEmail] = useState(defaultEmail);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trackedData, setTrackedData] = useState<TrackedTicketData | null>(null);

  const handleLookup = async (e: FormEvent) => {
    e.preventDefault();
    if (!ticketNumber.trim() || !email.trim()) return;

    setLoading(true);
    setError(null);

    const cleanNum = ticketNumber.replace(/^#/, '').trim();

    try {
      const data = await api.publicTickets.track(cleanNum, email.trim());
      setTrackedData(data);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.detail || err.title || 'Ticket not found. Check details.');
      } else {
        // Fallback demo sample if offline
        setError(
          'Could not retrieve ticket status. Please check your ticket number and email address.',
        );
      }
      setTrackedData(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="public-ticket-tracker">
      {/* Lookup Card */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/80 dark:border-zinc-800 p-6 sm:p-8 shadow-sm transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/40">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Customer Self-Service Portal</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-zinc-100 tracking-tight flex items-center gap-2">
              <Ticket className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <span>Track Ticket Status</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Enter your assigned ticket number and the email address used during submission.
            </p>
          </div>

          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 bg-slate-50 dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700 border border-slate-200 dark:border-zinc-700 rounded-xl transition-colors cursor-pointer self-start sm:self-auto"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
          )}
        </div>

        <form onSubmit={handleLookup} className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
          <div className="sm:col-span-4 relative">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-1.5">
              Ticket Number
            </label>
            <div className="relative">
              <Ticket className="w-4 h-4 absolute left-3 top-3 text-slate-400 dark:text-zinc-500" />
              <input
                type="text"
                required
                placeholder="e.g. 1042 or #1042"
                value={ticketNumber}
                onChange={(e) => setTicketNumber(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50/70 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
                data-testid="tracker-number-input"
              />
            </div>
          </div>

          <div className="sm:col-span-5 relative">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-1.5">
              Customer Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-3 text-slate-400 dark:text-zinc-500" />
              <input
                type="email"
                required
                placeholder="customer@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50/70 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
                data-testid="tracker-email-input"
              />
            </div>
          </div>

          <div className="sm:col-span-3 flex items-end">
            <button
              type="submit"
              disabled={loading || !ticketNumber.trim() || !email.trim()}
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-xs rounded-xl shadow-xs flex items-center justify-center space-x-2 transition-all cursor-pointer hover:shadow-indigo-500/20"
              data-testid="tracker-lookup-button"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Looking up...</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>Find Ticket</span>
                </>
              )}
            </button>
          </div>
        </form>

        {error && (
          <div
            className="mt-4 p-3.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-900/40 rounded-xl flex items-start space-x-2.5 text-rose-700 dark:text-rose-400 text-xs animate-in fade-in duration-200"
            data-testid="tracker-error-alert"
          >
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span className="font-medium leading-relaxed">{error}</span>
          </div>
        )}
      </div>

      {/* Ticket Details & Timeline */}
      {trackedData && (
        <div
          className="space-y-6 animate-in fade-in duration-300"
          data-testid="tracker-result-card"
        >
          {/* Header Card */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/80 dark:border-zinc-800 p-6 sm:p-8 shadow-sm space-y-4 transition-colors">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-zinc-800 pb-4">
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-sm font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2.5 py-1 rounded-lg border border-indigo-100 dark:border-indigo-900/50">
                  #{trackedData.ticket.number}
                </span>
                <h3 className="text-lg font-bold text-slate-900 dark:text-zinc-100">
                  {trackedData.ticket.subject}
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <StatusChip status={trackedData.ticket.status} />
                <PriorityChip priority={trackedData.ticket.priority} />
              </div>
            </div>

            <div className="text-xs text-slate-400 dark:text-zinc-500 flex flex-wrap items-center gap-4">
              <span className="inline-flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500" />
                <span>Opened {formatRelativeTime(trackedData.ticket.createdAt)}</span>
              </span>
              <span>•</span>
              <span>Last updated {new Date(trackedData.ticket.updatedAt).toLocaleString()}</span>
            </div>

            <div className="bg-slate-50/70 dark:bg-zinc-800/40 p-4 rounded-xl border border-slate-200/60 dark:border-zinc-700/60 text-xs sm:text-sm text-slate-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
              {trackedData.ticket.description}
            </div>
          </div>

          {/* Grid: Public Message Thread & Timeline Events */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Public Messages */}
            <div className="lg:col-span-2 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/80 dark:border-zinc-800 p-6 shadow-sm space-y-4 transition-colors">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
                <h4 className="text-sm font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Public Conversation ({trackedData.messages.length})</span>
                </h4>
                <span className="text-[11px] text-slate-400 dark:text-zinc-500">
                  Internal notes hidden
                </span>
              </div>

              {trackedData.messages.length === 0 ? (
                <p className="text-xs text-slate-400 dark:text-zinc-500 italic py-6 text-center">
                  No public messages have been posted on this ticket yet.
                </p>
              ) : (
                <div className="space-y-3.5" data-testid="tracker-message-thread">
                  {trackedData.messages.map((msg) => {
                    const isCustomer = msg.senderType === 'CUSTOMER';
                    const isAi = msg.senderType === 'AI';

                    return (
                      <div
                        key={msg.id}
                        className={`p-4 rounded-xl border text-xs sm:text-sm transition-all ${
                          isCustomer
                            ? 'bg-slate-50/80 dark:bg-zinc-800/40 border-slate-200 dark:border-zinc-700/80 text-slate-800 dark:text-zinc-200'
                            : isAi
                              ? 'bg-purple-50/70 dark:bg-purple-950/20 border-purple-200 dark:border-purple-900/40 text-purple-950 dark:text-purple-200'
                              : 'bg-indigo-50/70 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-900/40 text-indigo-950 dark:text-indigo-200'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="flex items-center gap-1.5 text-xs font-semibold">
                            {isCustomer ? (
                              <User className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400" />
                            ) : isAi ? (
                              <Bot className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                            ) : (
                              <UserCheck className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                            )}
                            <span>
                              {isCustomer
                                ? 'Customer'
                                : isAi
                                  ? 'AI Assistant'
                                  : 'Support Specialist'}
                            </span>
                          </span>
                          <span className="text-[11px] text-slate-400 dark:text-zinc-500 font-mono">
                            {new Date(msg.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <div className="whitespace-pre-wrap leading-relaxed">{msg.body}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Timeline Events */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/80 dark:border-zinc-800 p-6 shadow-sm space-y-4 transition-colors h-fit">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
                <h4 className="text-sm font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                  <History className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Timeline</span>
                </h4>
                <span className="text-[11px] font-mono text-slate-400 dark:text-zinc-500 bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
                  {trackedData.timeline.length} events
                </span>
              </div>

              {trackedData.timeline.length === 0 ? (
                <p className="text-xs text-slate-400 dark:text-zinc-500 italic py-4">
                  No events logged.
                </p>
              ) : (
                <div className="relative pl-6 space-y-4" data-testid="tracker-timeline-events">
                  <div className="absolute left-2.5 top-2 bottom-3 w-0.5 bg-slate-200 dark:bg-zinc-800 -z-0" />
                  {trackedData.timeline.map((event) => (
                    <div key={event.id} className="relative text-xs">
                      <div className="absolute -left-6 top-0 w-5 h-5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-full flex items-center justify-center z-10">
                        <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-semibold text-slate-800 dark:text-zinc-200 uppercase tracking-wider text-[10px] bg-slate-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded border border-slate-200/60 dark:border-zinc-700">
                          {event.type}
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono">
                          {formatRelativeTime(event.createdAt)}
                        </span>
                      </div>
                      {event.payload && Object.keys(event.payload).length > 0 && (
                        <div className="text-slate-600 dark:text-zinc-400 mt-1 text-[11px] bg-slate-50/70 dark:bg-zinc-800/40 p-2 rounded-lg border border-slate-100 dark:border-zinc-800 font-mono break-all">
                          {JSON.stringify(event.payload)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
