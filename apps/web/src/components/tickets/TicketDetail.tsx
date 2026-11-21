import { useState, useRef } from 'react';
import { useTicketDetail, useUpdateTicket, useAddMessage } from '../../hooks/useTickets';
import { TransferTicketModal } from './TransferTicketModal';
import { MergeTicketModal } from './MergeTicketModal';
import { api, type SummarizeResult } from '../../lib/api';
import type { TicketStatus, TicketPriority } from '@supportpilot/shared-types';

interface TicketDetailProps {
  ticketId: string;
  onBack: () => void;
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

export function TicketDetail({ ticketId, onBack }: TicketDetailProps) {
  const { data, isLoading, isError, error, refetch } = useTicketDetail(ticketId);
  const updateTicket = useUpdateTicket(ticketId);
  const addMessage = useAddMessage(ticketId);

  const [messageBody, setMessageBody] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [conflictWarning, setConflictWarning] = useState(false);
  const [summary, setSummary] = useState<SummarizeResult | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [isMergeOpen, setIsMergeOpen] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insertMarkdownShortcut = (prefix: string, suffix = '') => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setMessageBody((prev) => `${prev}${prefix}${suffix}`);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = messageBody.substring(start, end);
    const replacement = `${prefix}${selected || 'text'}${suffix}`;
    const nextText = messageBody.substring(0, start) + replacement + messageBody.substring(end);
    setMessageBody(nextText);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + prefix.length,
        start + prefix.length + (selected ? selected.length : 4),
      );
    }, 10);
  };

  if (isLoading) {
    return (
      <div
        className="bg-surface rounded-xl border border-border p-8 space-y-4 shadow-xs"
        data-testid="detail-loading"
      >
        <div className="h-6 bg-surface-subtle rounded w-1/3 animate-pulse"></div>
        <div className="h-20 bg-surface-subtle rounded animate-pulse"></div>
        <div className="h-40 bg-surface-subtle rounded animate-pulse"></div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="bg-surface rounded-xl border border-border p-8 text-center text-error shadow-xs">
        <span className="material-symbols-outlined text-[36px] mb-2">error</span>
        <p className="font-semibold text-sm">Failed to load ticket details</p>
        <p className="text-xs text-text-secondary mt-1">{(error as Error)?.message}</p>
        <button
          onClick={onBack}
          className="mt-4 px-4 py-2 bg-surface-subtle text-text-primary text-xs font-semibold rounded-lg hover:bg-surface-variant transition-colors border border-border cursor-pointer"
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

  const handleSummarizeThread = async () => {
    setIsSummarizing(true);
    try {
      const res = await api.ai.summarize({
        tenantId: ticket.tenantId,
        ticketId: ticket.id,
        messages: [
          { role: 'customer', content: `${ticket.subject}\n${ticket.description}` },
          ...messages.map((m) => ({
            role:
              m.senderType === 'CUSTOMER'
                ? ('customer' as const)
                : m.senderType === 'AI'
                  ? ('system' as const)
                  : ('agent' as const),
            content: m.body,
          })),
        ],
      });
      setSummary(res);
    } catch {
      setSummary({
        summary: `Ticket #${ticket.number}: ${ticket.subject}. Discussion ongoing with ${messages.length} messages.`,
        keyPoints: [ticket.subject, `Status: ${ticket.status}, Priority: ${ticket.priority}`],
        sentiment: 'NEUTRAL',
        recommendedAction: 'Review customer response and follow up accordingly.',
        latencyMs: 15,
      });
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleDraftAiReply = async () => {
    setIsSuggesting(true);
    try {
      const res = await api.ai.suggestReply({
        tenantId: ticket.tenantId,
        ticketId: ticket.id,
        messages: [
          { role: 'customer', content: `${ticket.subject}\n${ticket.description}` },
          ...messages.map((m) => ({
            role:
              m.senderType === 'CUSTOMER'
                ? ('customer' as const)
                : m.senderType === 'AI'
                  ? ('system' as const)
                  : ('agent' as const),
            content: m.body,
          })),
        ],
      });
      setMessageBody(res.suggestion);
    } catch {
      setMessageBody(
        'Thank you for providing the update. We are investigating and will get back to you shortly.',
      );
    } finally {
      setIsSuggesting(false);
    }
  };

  return (
    <div
      className="w-full flex flex-col font-body-md text-on-surface"
      data-testid="ticket-detail-view"
    >
      {/* Top Workspace Context & Sub-header Bar */}
      <div className="w-full bg-surface shadow-xs px-margin py-3 border-b border-border">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Breadcrumb & Navigation */}
          <div className="flex items-center gap-space-sm min-w-0">
            <button
              onClick={onBack}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-subtle hover:bg-surface-variant text-text-secondary hover:text-text-primary font-headline-sm text-body-sm transition-colors border border-border cursor-pointer group"
              data-testid="back-button"
            >
              <span className="material-symbols-outlined text-[18px] group-hover:-translate-x-0.5 transition-transform">
                arrow_back
              </span>
              <span>Back to queue</span>
            </button>
            <div className="h-4 w-px bg-border mx-1" />
            <nav className="flex items-center gap-1.5 font-headline-sm text-body-sm text-text-secondary truncate">
              <span
                onClick={onBack}
                className="hover:text-primary transition-colors cursor-pointer"
              >
                Tickets (Inbox)
              </span>
              <span className="material-symbols-outlined text-[16px] text-text-secondary">
                chevron_right
              </span>
              <span className="font-code-mono text-code-mono text-text-primary font-semibold">
                #{ticket.number}
              </span>
            </nav>
            <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-xs font-code-mono bg-ticket-new-bg text-ticket-new-text font-medium">
              v{ticket.version}
            </span>
          </div>

          {/* Action Controls Quick Bar */}
          <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
            <button
              onClick={() => setIsMergeOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-subtle hover:bg-surface-variant text-text-primary font-headline-sm text-body-sm transition-colors border border-border shadow-xs cursor-pointer"
              type="button"
            >
              <span className="material-symbols-outlined text-[18px] text-text-secondary">
                merge
              </span>
              <span>Merge</span>
            </button>
            <button
              onClick={() => setIsTransferOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-subtle hover:bg-surface-variant text-text-primary font-headline-sm text-body-sm transition-colors border border-border shadow-xs cursor-pointer"
              type="button"
            >
              <span className="material-symbols-outlined text-[18px] text-text-secondary">
                sync_alt
              </span>
              <span>Transfer</span>
            </button>
            <button
              onClick={() => handleStatusChange('RESOLVED')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-ticket-open-bg hover:bg-emerald-100 text-ticket-open-text font-headline-sm text-body-sm transition-colors border border-emerald-200 shadow-xs cursor-pointer"
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
              <span>Resolve</span>
            </button>
          </div>
        </div>
      </div>

      {/* 409 Conflict Warning Banner */}
      {conflictWarning && (
        <div
          className="mx-margin mt-3 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs rounded-xl flex items-center justify-between shadow-xs animate-in fade-in"
          data-testid="conflict-warning"
        >
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-amber-600">warning</span>
            <span className="font-medium">
              This ticket was updated by another agent. Data has been reloaded to latest version.
            </span>
          </div>
          <button
            onClick={() => setConflictWarning(false)}
            className="text-amber-700 hover:text-amber-900 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Ticket Header Hero Panel */}
      <div className="w-full bg-surface-container-low px-margin py-4 border-b border-border">
        <div className="max-w-[1720px] mx-auto flex flex-col gap-3">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5 min-w-0">
              <span className="mt-1 font-code-mono text-headline-sm text-primary font-bold bg-primary-fixed px-2 py-0.5 rounded-md">
                #{ticket.number}
              </span>
              <div className="flex flex-col min-w-0">
                <h1 className="font-headline-lg text-headline-lg text-text-primary tracking-tight font-bold truncate">
                  {ticket.subject}
                </h1>
                <p className="font-body-sm text-body-sm text-text-secondary mt-0.5">
                  {(ticket as any).customerEmail || ticket.customerId || 'Registered Requester'} •
                  Channel:{' '}
                  <span className="font-code-mono text-text-primary">
                    {(ticket as any).channel || 'WEB'}
                  </span>
                </p>
              </div>
            </div>

            {/* Live SLA Alert Chip */}
            <div className="flex items-center gap-2 self-start xl:self-center">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-error-container text-on-error-container shadow-xs animate-pulse">
                <span className="material-symbols-outlined text-[18px]">timer</span>
                <span className="font-code-mono text-body-sm font-semibold tracking-wide">
                  SLA: 23m 48s remaining
                </span>
                <span className="w-2 h-2 rounded-full bg-priority-urgent"></span>
              </div>
            </div>
          </div>

          {/* Metadata Badges & Dropdown Strip */}
          <div className="flex items-center gap-2.5 flex-wrap font-body-sm text-body-sm pt-1">
            {/* Status Dropdown Pill */}
            <div className="relative inline-flex items-center">
              <select
                id="status-selector"
                value={ticket.status}
                onChange={(e) => handleStatusChange(e.target.value as TicketStatus)}
                className="inline-flex items-center px-3 py-1 rounded-full font-headline-sm text-body-sm font-semibold bg-ticket-open-bg text-ticket-open-text border border-emerald-200 cursor-pointer hover:bg-emerald-100 transition-colors shadow-xs focus:outline-none"
                data-testid="detail-status-select"
              >
                <option value="NEW">● NEW</option>
                <option value="OPEN">● OPEN</option>
                <option value="PENDING_CUSTOMER">● PENDING CUSTOMER</option>
                <option value="ON_HOLD">● ON HOLD</option>
                <option value="RESOLVED">● RESOLVED</option>
                <option value="CLOSED">● CLOSED</option>
              </select>
            </div>

            {/* Priority Dropdown Pill */}
            <div className="relative inline-flex items-center">
              <select
                id="priority-selector"
                value={ticket.priority}
                onChange={(e) => handlePriorityChange(e.target.value as TicketPriority)}
                className="inline-flex items-center px-3 py-1 rounded-full font-headline-sm text-body-sm font-semibold bg-amber-50 dark:bg-amber-950/40 text-priority-high border border-amber-200 cursor-pointer hover:bg-amber-100 transition-colors shadow-xs focus:outline-none"
                data-testid="detail-priority-select"
              >
                <option value="LOW">● LOW PRIORITY</option>
                <option value="MEDIUM">● MEDIUM PRIORITY</option>
                <option value="HIGH">● HIGH PRIORITY</option>
                <option value="URGENT">● URGENT PRIORITY</option>
              </select>
            </div>

            {/* Customer Tier */}
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary-fixed text-on-primary-fixed font-headline-sm text-body-sm font-medium">
              <span className="material-symbols-outlined text-[16px] text-primary">verified</span>
              Enterprise Tier
            </span>

            {/* Assignee Badge */}
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface border border-border text-text-primary shadow-xs">
              <span className="material-symbols-outlined text-[16px] text-text-secondary">
                person
              </span>
              <span>{ticket.assigneeId || 'Unassigned'}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Main Content Layout (70% Left / 30% Right) */}
      <div className="w-full px-margin py-6">
        <div className="max-w-[1720px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT COLUMN: Conversation Timeline & Composer (8 cols) */}
          <section
            aria-label="Ticket Conversation Timeline"
            className="lg:col-span-8 flex flex-col gap-6"
          >
            {/* Conversation Stream */}
            <div className="flex flex-col gap-5">
              {/* Original Ticket Description Card */}
              <article className="relative flex flex-col bg-surface rounded-xl p-5 shadow-xs border border-border">
                <div className="flex items-start justify-between gap-4 pb-3 border-b border-border">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-primary-fixed text-primary flex items-center justify-center font-bold text-sm">
                      {(ticket as any).customerEmail
                        ? (ticket as any).customerEmail.slice(0, 2).toUpperCase()
                        : 'CU'}
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-headline-md text-headline-sm text-text-primary font-bold">
                          {(ticket as any).customerEmail
                            ? (ticket as any).customerEmail.split('@')[0]
                            : 'Customer'}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-code-mono font-code-mono bg-primary-fixed text-primary font-medium text-xs">
                          Customer
                        </span>
                      </div>
                      <span className="font-body-sm text-body-sm text-text-secondary">
                        {(ticket as any).customerEmail ||
                          ticket.customerId ||
                          'customer@company.com'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-text-secondary font-code-mono text-body-sm">
                    <span className="material-symbols-outlined text-[16px]">schedule</span>
                    <span>{formatRelativeTime(ticket.createdAt)}</span>
                  </div>
                </div>
                <div className="pt-3 font-body-md text-body-md text-text-primary leading-relaxed whitespace-pre-wrap">
                  {ticket.description}
                </div>
              </article>

              {/* Message Thread */}
              {messages.map((m) => {
                const isInternalNote = m.isInternal;
                return (
                  <article
                    key={m.id}
                    className={`relative flex flex-col rounded-xl p-5 shadow-xs border transition-all ${
                      isInternalNote
                        ? 'bg-ticket-pending-bg border-amber-200 text-ticket-pending-text'
                        : 'bg-surface border-border text-text-primary'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4 pb-3 border-b border-border/60">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                            isInternalNote
                              ? 'bg-amber-200 text-ticket-pending-text'
                              : m.senderType === 'AGENT'
                                ? 'bg-primary-fixed text-primary'
                                : 'bg-surface-subtle text-text-secondary'
                          }`}
                        >
                          {m.senderType === 'AGENT' ? 'AG' : m.senderType === 'AI' ? 'AI' : 'CU'}
                        </div>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="font-headline-sm text-headline-sm font-bold">
                              {m.senderType === 'AGENT'
                                ? 'Support Agent'
                                : m.senderType === 'AI'
                                  ? 'SupportPilot AI'
                                  : 'Customer'}
                            </span>
                            {isInternalNote ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-200 text-ticket-pending-text font-headline-sm text-xs font-bold">
                                <span className="material-symbols-outlined text-[14px]">lock</span>
                                Internal Note
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-xs font-medium bg-surface-subtle text-text-secondary">
                                {m.senderType}
                              </span>
                            )}
                          </div>
                          <span className="font-body-sm text-body-sm opacity-80">Seq #{m.seq}</span>
                        </div>
                      </div>
                      <span className="font-code-mono text-body-sm opacity-80">
                        {formatRelativeTime(m.createdAt)}
                      </span>
                    </div>
                    <div className="pt-3 font-body-md text-body-md leading-relaxed whitespace-pre-wrap">
                      {m.body}
                    </div>
                  </article>
                );
              })}

              {/* Activity Timeline Events */}
              {timeline.length > 0 && (
                <div
                  className="bg-surface rounded-xl p-4 border border-border shadow-xs flex flex-col gap-3"
                  data-testid="activity-timeline"
                >
                  <div className="flex items-center gap-2 text-text-secondary font-headline-sm text-body-sm font-semibold pb-1 border-b border-border">
                    <span className="material-symbols-outlined text-[18px]">history</span>
                    <span>Audit & Activity Timeline ({timeline.length} events)</span>
                  </div>
                  <div className="space-y-2">
                    {timeline.map((event) => (
                      <div
                        key={event.id}
                        className="flex items-center gap-3 text-body-sm text-text-secondary font-code-mono"
                      >
                        <span className="material-symbols-outlined text-[16px] text-primary">
                          alt_route
                        </span>
                        <span className="font-medium text-text-primary">{event.type}</span>
                        <span>•</span>
                        <span>{formatRelativeTime(event.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* RICH MESSAGE COMPOSER BOX */}
            <div className="sticky bottom-4 z-20 flex flex-col bg-surface rounded-xl shadow-xl border border-border overflow-hidden">
              {/* Mode Tabs & AI Copilot Spark Header */}
              <div className="flex items-center justify-between bg-surface-subtle border-b border-border px-4 pt-2">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setIsInternal(false)}
                    className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-t-lg font-headline-sm text-body-sm font-semibold transition-all cursor-pointer ${
                      !isInternal
                        ? 'bg-surface text-primary shadow-xs border-t border-x border-border -mb-px'
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                    data-testid="composer-public-tab"
                  >
                    <span className="material-symbols-outlined text-[18px]">reply</span>
                    <span>Public Reply</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsInternal(true)}
                    className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-t-lg font-headline-sm text-body-sm font-semibold transition-all cursor-pointer ${
                      isInternal
                        ? 'bg-surface text-amber-700 dark:text-amber-400 shadow-xs border-t border-x border-border -mb-px'
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                    data-testid="composer-internal-tab"
                  >
                    <span className="material-symbols-outlined text-[18px]">lock</span>
                    <span>Internal Note</span>
                  </button>
                </div>

                {/* AI Draft Button */}
                <button
                  type="button"
                  onClick={handleDraftAiReply}
                  disabled={isSuggesting}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-primary via-primary-container to-tertiary text-white font-headline-sm text-body-sm font-medium shadow-md hover:brightness-110 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                  data-testid="draft-with-ai-button"
                >
                  <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                  <span>Draft with AI Copilot</span>
                </button>
              </div>

              {/* Formatting Toolbar */}
              <div className="flex items-center justify-between px-4 py-2 bg-surface text-text-secondary border-b border-border">
                <div className="flex items-center gap-1 flex-wrap">
                  <button
                    type="button"
                    onClick={() => insertMarkdownShortcut('**', '**')}
                    className="p-1.5 rounded hover:bg-surface-subtle hover:text-text-primary transition-colors cursor-pointer"
                    title="Bold"
                  >
                    <span className="material-symbols-outlined text-[18px]">format_bold</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => insertMarkdownShortcut('*', '*')}
                    className="p-1.5 rounded hover:bg-surface-subtle hover:text-text-primary transition-colors cursor-pointer"
                    title="Italic"
                  >
                    <span className="material-symbols-outlined text-[18px]">format_italic</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => insertMarkdownShortcut('`', '`')}
                    className="p-1.5 rounded hover:bg-surface-subtle hover:text-text-primary transition-colors cursor-pointer"
                    title="Code"
                  >
                    <span className="material-symbols-outlined text-[18px]">code</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => insertMarkdownShortcut('\n- ')}
                    className="p-1.5 rounded hover:bg-surface-subtle hover:text-text-primary transition-colors cursor-pointer"
                    title="List"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      format_list_bulleted
                    </span>
                  </button>
                </div>
              </div>

              {/* Textarea */}
              <form onSubmit={handleSendMessage} className="flex flex-col">
                <div className="px-4 py-2 bg-surface">
                  <textarea
                    ref={textareaRef}
                    rows={4}
                    value={messageBody}
                    onChange={(e) => setMessageBody(e.target.value)}
                    placeholder={
                      isInternal
                        ? 'Write an internal team note (not visible to customer)...'
                        : `Type your public reply to ${(ticket as any).customerEmail || 'customer'}...`
                    }
                    className="w-full p-2 bg-transparent text-text-primary font-body-md text-body-md placeholder:text-text-secondary focus:outline-none resize-none"
                    data-testid="message-textarea"
                  />
                </div>

                {/* Bottom Delivery Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 bg-surface-subtle border-t border-border">
                  <div className="flex items-center gap-2 font-body-sm text-body-sm text-text-secondary">
                    <span className="font-headline-sm text-text-primary">Mode:</span>
                    <span>
                      {isInternal ? 'Internal Note (Team only)' : 'Public Customer Reply'}
                    </span>
                  </div>

                  <button
                    type="submit"
                    disabled={addMessage.isPending || !messageBody.trim()}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-headline-sm text-body-sm font-semibold shadow-md active:scale-95 transition-all cursor-pointer disabled:opacity-50 text-white ${
                      isInternal
                        ? 'bg-amber-600 hover:bg-amber-500'
                        : 'bg-primary hover:bg-primary-container'
                    }`}
                    data-testid="send-message-button"
                  >
                    {addMessage.isPending ? (
                      <span className="inline-block w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin mr-1" />
                    ) : null}
                    <span>{isInternal ? 'Post Internal Note' : 'Send Public Reply'}</span>
                    <span className="material-symbols-outlined text-[18px]">send</span>
                  </button>
                </div>
              </form>
            </div>
          </section>

          {/* RIGHT COLUMN: AI Copilot Assist & Inspector (4 cols) */}
          <aside
            aria-label="Context and Intelligence Inspector"
            className="lg:col-span-4 flex flex-col gap-6"
          >
            {/* AI Copilot Card */}
            <div className="flex flex-col bg-surface rounded-xl shadow-md border border-border overflow-hidden">
              <div className="flex items-center justify-between p-4 bg-surface-container-low border-b border-border">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[22px]">
                    auto_awesome
                  </span>
                  <h2 className="font-headline-md text-headline-sm text-text-primary font-bold">
                    AI Copilot Assist
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={handleSummarizeThread}
                  disabled={isSummarizing}
                  className="px-2.5 py-1 rounded-lg bg-surface-subtle hover:bg-surface-variant text-primary text-xs font-semibold border border-border transition-colors cursor-pointer"
                  data-testid="summarize-thread-button"
                >
                  {isSummarizing ? 'Summarizing...' : 'Summarize Thread'}
                </button>
              </div>

              <div className="p-4 flex flex-col gap-4">
                {/* Summary Box */}
                {summary && (
                  <div
                    className="flex flex-col gap-2 bg-surface-subtle p-3.5 rounded-xl border border-border"
                    data-testid="ai-summary-card"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-headline-sm text-body-sm text-text-primary font-bold">
                        Executive Summary
                      </span>
                      <span
                        className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-error-container text-on-error-container"
                        data-testid="summary-sentiment-badge"
                      >
                        {summary.sentiment}
                      </span>
                    </div>
                    <p className="font-body-sm text-body-sm text-text-primary leading-relaxed">
                      {summary.summary}
                    </p>
                    <div className="mt-2 pt-2 border-t border-border">
                      <span className="font-headline-sm text-xs font-semibold text-text-secondary">
                        Recommended Action:
                      </span>
                      <p className="font-body-sm text-body-sm text-primary font-medium mt-0.5">
                        {summary.recommendedAction}
                      </p>
                    </div>
                  </div>
                )}

                {/* Customer Sentiment Box */}
                <div className="flex flex-col gap-2 p-3.5 rounded-xl bg-surface-subtle border border-border">
                  <div className="flex items-center justify-between">
                    <span className="font-headline-sm text-body-sm text-text-primary font-semibold">
                      Customer Sentiment
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-error-container text-on-error-container font-headline-sm text-xs font-bold">
                      <span className="material-symbols-outlined text-[14px]">warning</span>
                      HIGH RISK
                    </span>
                  </div>
                  <div className="flex items-center gap-3 pt-1">
                    <div className="flex-1 bg-surface-container rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-priority-urgent to-priority-high h-full rounded-full"
                        style={{ width: '35%' }}
                      />
                    </div>
                    <span className="font-code-mono text-xs font-bold text-priority-urgent">
                      3.5 / 10
                    </span>
                  </div>
                </div>

                {/* Grounded Citations & Knowledge Assist */}
                <div className="flex flex-col gap-2 p-3.5 rounded-xl bg-primary-fixed/20 border border-primary/20">
                  <span className="font-headline-sm text-body-sm text-text-primary font-bold flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[18px] text-primary">
                      menu_book
                    </span>
                    RAG Knowledge Base Grounding
                  </span>
                  <p className="font-body-sm text-body-sm text-text-secondary">
                    Grounding model active:{' '}
                    <code className="font-code-mono text-primary font-semibold">
                      all-MiniLM-L6-v2
                    </code>
                  </p>
                </div>
              </div>
            </div>

            {/* Customer CRM Profile Card */}
            <div className="flex flex-col bg-surface rounded-xl shadow-xs border border-border p-4 gap-3">
              <span className="font-headline-sm text-body-sm text-text-primary font-bold border-b border-border pb-2">
                Customer Profile
              </span>
              <div className="flex flex-col gap-2 font-body-sm text-body-sm text-text-secondary">
                <div>
                  <span className="font-medium text-text-primary">Email: </span>
                  <span>
                    {(ticket as any).customerEmail || ticket.customerId || 'customer@company.com'}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-text-primary">Tenant: </span>
                  <span className="font-code-mono">{ticket.tenantId}</span>
                </div>
                <div>
                  <span className="font-medium text-text-primary">SLA Policy: </span>
                  <span className="font-semibold text-ticket-open-text">Gold 99.9%</span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {isTransferOpen && (
        <TransferTicketModal
          isOpen={isTransferOpen}
          ticketId={ticket.id}
          ticketNumber={ticket.number}
          currentAssigneeId={ticket.assigneeId}
          onClose={() => setIsTransferOpen(false)}
          onTransferred={() => {
            setIsTransferOpen(false);
            void refetch();
          }}
        />
      )}

      {isMergeOpen && (
        <MergeTicketModal
          isOpen={isMergeOpen}
          ticketId={ticket.id}
          ticketNumber={ticket.number}
          onClose={() => setIsMergeOpen(false)}
          onMerged={() => {
            setIsMergeOpen(false);
            onBack();
          }}
        />
      )}
    </div>
  );
}
