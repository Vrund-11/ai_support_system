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
    <div className="space-y-space-md" data-testid="public-ticket-tracker">
      {/* Lookup Card */}
      <div className="bg-surface rounded-xl border border-border p-space-lg shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-md mb-space-md">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-body-sm text-body-sm font-semibold bg-primary-fixed text-primary border border-primary/20">
              <span className="material-symbols-outlined text-[16px]">verified_user</span>
              <span>Customer Self-Service Portal</span>
            </div>
            <h2 className="font-headline-lg text-headline-lg font-bold text-text-primary tracking-tight flex items-center gap-2">
              <span className="material-symbols-outlined text-[24px] text-primary">
                confirmation_number
              </span>
              <span>Track Ticket Status</span>
            </h2>
            <p className="font-body-sm text-body-sm text-text-secondary">
              Enter your assigned ticket number and the email address used during submission.
            </p>
          </div>

          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 font-body-sm text-body-sm font-medium text-text-secondary hover:text-text-primary bg-surface-subtle hover:bg-surface-container border border-border rounded-xl transition-colors cursor-pointer self-start sm:self-auto"
            >
              <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                arrow_back
              </span>
              <span>Back</span>
            </button>
          )}
        </div>

        <form onSubmit={handleLookup} className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
          <div className="sm:col-span-4 relative">
            <label className="block text-[11px] font-code-mono uppercase tracking-wider text-text-secondary mb-1.5 font-medium">
              Ticket Number
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-text-secondary text-[18px]">
                confirmation_number
              </span>
              <input
                type="text"
                required
                placeholder="e.g. 1042 or #1042"
                value={ticketNumber}
                onChange={(e) => setTicketNumber(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2.5 bg-surface-subtle border border-border rounded-xl font-body-md text-body-md text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all shadow-xs"
                data-testid="tracker-number-input"
              />
            </div>
          </div>

          <div className="sm:col-span-5 relative">
            <label className="block text-[11px] font-code-mono uppercase tracking-wider text-text-secondary mb-1.5 font-medium">
              Customer Email
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-text-secondary text-[18px]">
                mail
              </span>
              <input
                type="email"
                required
                placeholder="customer@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2.5 bg-surface-subtle border border-border rounded-xl font-body-md text-body-md text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all shadow-xs"
                data-testid="tracker-email-input"
              />
            </div>
          </div>

          <div className="sm:col-span-3 flex items-end">
            <button
              type="submit"
              disabled={loading || !ticketNumber.trim() || !email.trim()}
              className="w-full py-2.5 px-4 bg-primary hover:bg-primary-container disabled:opacity-50 text-on-primary font-headline-sm text-headline-sm font-semibold rounded-xl shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
              data-testid="tracker-lookup-button"
            >
              {loading ? (
                <>
                  <span
                    className="material-symbols-outlined text-[18px] animate-spin"
                    aria-hidden="true"
                  >
                    progress_activity
                  </span>
                  <span>Looking up...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                    search
                  </span>
                  <span>Find Ticket</span>
                </>
              )}
            </button>
          </div>
        </form>

        {error && (
          <div
            className="mt-4 p-3.5 bg-error-container border border-error/20 rounded-xl flex items-start gap-2.5 text-on-error-container font-body-sm text-body-sm animate-in fade-in duration-200"
            data-testid="tracker-error-alert"
          >
            <span className="material-symbols-outlined text-[18px] text-error shrink-0">
              warning
            </span>
            <span className="font-medium leading-relaxed">{error}</span>
          </div>
        )}
      </div>

      {/* Ticket Details & Timeline */}
      {trackedData && (
        <div
          className="space-y-space-md animate-in fade-in duration-300"
          data-testid="tracker-result-card"
        >
          {/* Header Card */}
          <div className="bg-surface rounded-xl border border-border p-space-lg shadow-xs space-y-space-md">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
              <div className="flex items-center gap-2.5">
                <span className="font-code-mono text-sm font-bold text-primary bg-primary-fixed px-2.5 py-1 rounded-lg border border-primary/20">
                  #{trackedData.ticket.number}
                </span>
                <h3 className="font-headline-md text-headline-md font-bold text-text-primary">
                  {trackedData.ticket.subject}
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <StatusChip status={trackedData.ticket.status} />
                <PriorityChip priority={trackedData.ticket.priority} />
              </div>
            </div>

            <div className="font-body-sm text-body-sm text-text-secondary flex flex-wrap items-center gap-4">
              <span className="inline-flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px]">schedule</span>
                <span>Opened {formatRelativeTime(trackedData.ticket.createdAt)}</span>
              </span>
              <span>•</span>
              <span className="font-code-mono text-code-mono">
                Last updated {new Date(trackedData.ticket.updatedAt).toLocaleString()}
              </span>
            </div>

            <div className="bg-surface-subtle p-4 rounded-xl border border-border font-body-md text-body-md text-text-primary leading-relaxed whitespace-pre-wrap">
              {trackedData.ticket.description}
            </div>
          </div>

          {/* Grid: Public Message Thread & Timeline Events */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-space-md">
            {/* Public Messages */}
            <div className="lg:col-span-2 bg-surface rounded-xl border border-border p-space-lg shadow-xs space-y-space-md">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h4 className="font-headline-sm text-headline-sm font-bold text-text-primary flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-primary">chat</span>
                  <span>Public Conversation ({trackedData.messages.length})</span>
                </h4>
                <span className="font-code-mono text-code-mono text-text-secondary text-[11px]">
                  Internal notes hidden
                </span>
              </div>

              {trackedData.messages.length === 0 ? (
                <p className="font-body-sm text-body-sm text-text-secondary italic py-6 text-center">
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
                        className={`p-4 rounded-xl border font-body-md text-body-md transition-all ${
                          isCustomer
                            ? 'bg-surface-subtle border-border text-text-primary'
                            : isAi
                              ? 'bg-surface-container border-border text-text-primary'
                              : 'bg-primary-fixed border-primary/20 text-text-primary'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="flex items-center gap-1.5 font-body-sm text-body-sm font-semibold">
                            <span className="material-symbols-outlined text-[16px]">
                              {isCustomer ? 'person' : isAi ? 'smart_toy' : 'support_agent'}
                            </span>
                            <span>
                              {isCustomer
                                ? 'Customer'
                                : isAi
                                  ? 'AI Assistant'
                                  : 'Support Specialist'}
                            </span>
                          </span>
                          <span className="font-code-mono text-code-mono text-text-secondary text-[11px]">
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
            <div className="bg-surface rounded-xl border border-border p-space-lg shadow-xs space-y-space-md h-fit">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h4 className="font-headline-sm text-headline-sm font-bold text-text-primary flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-primary">
                    history
                  </span>
                  <span>Timeline</span>
                </h4>
                <span className="font-code-mono text-[11px] text-text-secondary bg-surface-subtle px-2 py-0.5 rounded border border-border">
                  {trackedData.timeline.length} events
                </span>
              </div>

              {trackedData.timeline.length === 0 ? (
                <p className="font-body-sm text-body-sm text-text-secondary italic py-4">
                  No events logged.
                </p>
              ) : (
                <div className="relative pl-6 space-y-4" data-testid="tracker-timeline-events">
                  <div className="absolute left-2.5 top-2 bottom-3 w-0.5 bg-border -z-0" />
                  {trackedData.timeline.map((event) => (
                    <div key={event.id} className="relative font-body-sm text-body-sm">
                      <div className="absolute -left-6 top-0 w-5 h-5 bg-surface border border-border rounded-full flex items-center justify-center z-10 text-primary">
                        <span className="material-symbols-outlined text-[14px]">check</span>
                      </div>
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-code-mono uppercase tracking-wider text-[10px] bg-surface-subtle text-text-primary px-1.5 py-0.5 rounded border border-border font-semibold">
                          {event.type}
                        </span>
                        <span className="font-code-mono text-text-secondary text-[10px]">
                          {formatRelativeTime(event.createdAt)}
                        </span>
                      </div>
                      {event.payload && Object.keys(event.payload).length > 0 && (
                        <div className="text-text-secondary mt-1 font-code-mono text-[11px] bg-surface-subtle p-2 rounded-lg border border-border break-all">
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
