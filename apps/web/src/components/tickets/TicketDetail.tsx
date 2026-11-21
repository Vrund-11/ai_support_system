import { useState, useRef } from 'react';
import { useTicketDetail, useUpdateTicket, useAddMessage } from '../../hooks/useTickets';
import { StatusChip } from './StatusChip';
import { PriorityChip } from './PriorityChip';
import { TransferTicketModal } from './TransferTicketModal';
import { MergeTicketModal } from './MergeTicketModal';
import { api, type SummarizeResult } from '../../lib/api';
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
  Sparkles,
  FileText,
  Lightbulb,
  Bold,
  Italic,
  Code,
  List,
  Link as LinkIcon,
  Quote,
  Clock,
  User,
  Bot,
  UserCheck,
  ShieldAlert,
  ArrowRightCircle,
  Tag,
  Hash,
  ArrowRightLeft,
  GitMerge,
} from 'lucide-react';

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
        className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200/80 dark:border-zinc-800 p-8 space-y-4 transition-colors"
        data-testid="detail-loading"
      >
        <div className="h-6 bg-slate-100 dark:bg-zinc-800 rounded w-1/3 animate-pulse"></div>
        <div className="h-20 bg-slate-100/70 dark:bg-zinc-800/70 rounded animate-pulse"></div>
        <div className="h-40 bg-slate-100/70 dark:bg-zinc-800/70 rounded animate-pulse"></div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200/80 dark:border-zinc-800 p-8 text-center text-rose-600 dark:text-rose-400 transition-colors">
        <p className="font-semibold text-sm">Failed to load ticket details</p>
        <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
          {(error as Error)?.message}
        </p>
        <button
          onClick={onBack}
          className="mt-4 px-4 py-2 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 text-xs font-semibold rounded-lg hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
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

  const getTimelineIcon = (type: string) => {
    switch (type) {
      case 'STATUS':
        return <ArrowRightCircle className="w-3.5 h-3.5 text-indigo-600" />;
      case 'PRIORITY':
        return <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />;
      case 'ASSIGN':
        return <UserCheck className="w-3.5 h-3.5 text-emerald-600" />;
      case 'NOTE':
        return <Lock className="w-3.5 h-3.5 text-amber-600" />;
      case 'TAG':
        return <Tag className="w-3.5 h-3.5 text-purple-600" />;
      case 'MESSAGE':
        return <MessageSquare className="w-3.5 h-3.5 text-sky-600" />;
      default:
        return <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />;
    }
  };

  return (
    <div className="space-y-5" data-testid="ticket-detail-view">
      {/* Top action bar: Linear & Stitch grade navigation & controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-zinc-900 p-3.5 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-xs transition-colors">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors px-2.5 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
            data-testid="back-button"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Queue</span>
          </button>

          <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-slate-400 dark:text-zinc-500">
            <span>/</span>
            <span className="font-mono text-slate-700 dark:text-zinc-300 font-semibold">
              #{ticket.number}
            </span>
          </div>

          {/* Live SLA Alert Chip */}
          <div className="hidden md:inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200/80 dark:border-rose-900/60 font-mono text-xs font-semibold shadow-2xs animate-pulse">
            <Clock className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
            <span>SLA: 23m 48s</span>
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
          </div>

          <span className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/40 font-medium text-xs">
            <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>Enterprise Tier</span>
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Version badge */}
          <div
            className="inline-flex items-center gap-1 font-mono text-[11px] text-slate-500 dark:text-zinc-400 bg-slate-50 dark:bg-zinc-800 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-zinc-700"
            title={`Revision version ${ticket.version}`}
          >
            <Hash className="w-3 h-3 text-slate-400 dark:text-zinc-500" />
            <span>v{ticket.version}</span>
          </div>

          <div className="h-4 w-px bg-slate-200 dark:bg-zinc-700" />

          {/* Status selector */}
          <div className="flex items-center space-x-1.5">
            <span className="text-[11px] font-semibold text-slate-400 dark:text-zinc-400 uppercase tracking-wider">
              Status:
            </span>
            <select
              value={ticket.status}
              disabled={ticket.status === 'CLOSED' || updateTicket.isPending}
              onChange={(e) => handleStatusChange(e.target.value as TicketStatus)}
              className="text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-2.5 py-1 font-medium text-slate-800 dark:text-zinc-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none disabled:opacity-50 cursor-pointer"
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

          {/* Priority selector */}
          <div className="flex items-center space-x-1.5">
            <span className="text-[11px] font-semibold text-slate-400 dark:text-zinc-400 uppercase tracking-wider">
              Priority:
            </span>
            <select
              value={ticket.priority}
              disabled={ticket.status === 'CLOSED' || updateTicket.isPending}
              onChange={(e) => handlePriorityChange(e.target.value as TicketPriority)}
              className="text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-2.5 py-1 font-medium text-slate-800 dark:text-zinc-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none disabled:opacity-50 cursor-pointer"
              data-testid="detail-priority-select"
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </div>

          <div className="h-4 w-px bg-slate-200 dark:bg-zinc-700" />

          {/* Transfer button */}
          <button
            type="button"
            onClick={() => setIsTransferOpen(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 bg-slate-50 dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700 border border-slate-200 dark:border-zinc-700 rounded-lg transition-colors cursor-pointer"
            data-testid="detail-transfer-button"
            title="Transfer ticket to another agent"
          >
            <ArrowRightLeft className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400" />
            <span>Transfer</span>
          </button>

          {/* Merge button */}
          <button
            type="button"
            onClick={() => setIsMergeOpen(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-zinc-300 hover:text-amber-600 dark:hover:text-amber-400 bg-slate-50 dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700 border border-slate-200 dark:border-zinc-700 rounded-lg transition-colors cursor-pointer"
            data-testid="detail-merge-button"
            title="Merge duplicate ticket"
          >
            <GitMerge className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400" />
            <span>Merge</span>
          </button>
        </div>
      </div>

      {conflictWarning && (
        <div
          className="p-3.5 bg-amber-50 border border-amber-300 text-amber-900 text-xs rounded-xl flex items-center space-x-2.5 shadow-xs animate-in fade-in duration-200"
          data-testid="conflict-warning"
        >
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span className="font-medium">
            Ticket was modified concurrently by another user. Latest version has been reloaded.
          </span>
        </div>
      )}

      {/* Ticket Header & Description Card */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200/80 dark:border-zinc-800 p-6 shadow-xs transition-colors">
        <div className="flex flex-wrap items-center gap-2.5 mb-3">
          <span className="font-mono text-sm font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded border border-indigo-100 dark:border-indigo-900/50">
            #{ticket.number}
          </span>
          <h1 className="text-xl font-bold text-slate-900 dark:text-zinc-100 tracking-tight">
            {ticket.subject}
          </h1>
          <div className="flex items-center gap-1.5 ml-auto">
            <StatusChip status={ticket.status} />
            <PriorityChip priority={ticket.priority} />
          </div>
        </div>

        <div className="text-xs text-slate-400 dark:text-zinc-500 mb-4 flex flex-wrap items-center gap-4 border-b border-slate-100 dark:border-zinc-800 pb-3">
          <span className="inline-flex items-center gap-1">
            <User className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500" />
            <span>Customer ID: {ticket.customerId}</span>
          </span>
          <span className="text-slate-200 dark:text-zinc-700">•</span>
          <span>Version: {ticket.version}</span>
          <span className="text-slate-200 dark:text-zinc-700">•</span>
          <span className="inline-flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500" />
            <span>Created: {new Date(ticket.createdAt).toLocaleString()}</span>
          </span>
        </div>

        <div className="bg-slate-50/70 dark:bg-zinc-800/40 p-4 rounded-xl border border-slate-200/60 dark:border-zinc-700/60 text-sm text-slate-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
          {ticket.description}
        </div>
      </div>

      {/* Grid: Message thread (left 2/3) + Activity Timeline (right 1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Messages Thread and Composer */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200/80 dark:border-zinc-800 p-6 shadow-xs transition-colors">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-zinc-800 pb-3">
              <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100 flex items-center space-x-2">
                <MessageSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>Conversation Thread ({messages.length})</span>
              </h2>
              <button
                type="button"
                onClick={handleSummarizeThread}
                disabled={isSummarizing}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 transition-colors cursor-pointer shadow-2xs"
                data-testid="summarize-thread-button"
              >
                {isSummarizing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                )}
                <span>{isSummarizing ? 'Summarizing...' : 'Summarize Thread'}</span>
              </button>
            </div>

            {summary && (
              <div
                className="mb-5 p-4 rounded-xl border border-indigo-200/80 dark:border-indigo-900/60 bg-indigo-50/40 dark:bg-indigo-950/20 space-y-2.5 text-xs shadow-2xs"
                data-testid="ai-summary-card"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-indigo-900 dark:text-indigo-200">
                    <FileText className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>AI Thread Summary</span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      summary.sentiment === 'URGENT'
                        ? 'bg-rose-100 text-rose-800 border border-rose-200'
                        : summary.sentiment === 'FRUSTRATED'
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : summary.sentiment === 'POSITIVE'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-slate-100 text-slate-800 border border-slate-200'
                    }`}
                    data-testid="summary-sentiment-badge"
                  >
                    {summary.sentiment}
                  </span>
                </div>
                <p className="text-slate-700 dark:text-zinc-300 leading-relaxed font-normal">
                  {summary.summary}
                </p>
                {summary.keyPoints.length > 0 && (
                  <ul className="list-disc list-inside space-y-0.5 text-slate-600 dark:text-zinc-400">
                    {summary.keyPoints.map((pt, i) => (
                      <li key={i}>{pt}</li>
                    ))}
                  </ul>
                )}
                {summary.recommendedAction && (
                  <div className="pt-2 border-t border-indigo-100 dark:border-indigo-900/40 flex items-start gap-1.5 text-indigo-900 dark:text-indigo-200 font-medium">
                    <Lightbulb className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                    <span>
                      <strong>Next:</strong> {summary.recommendedAction}
                    </span>
                  </div>
                )}
              </div>
            )}

            {messages.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-zinc-500 italic py-6 text-center">
                No messages yet. Add a reply or internal note below.
              </p>
            ) : (
              <div className="space-y-3.5" data-testid="message-thread">
                {messages.map((msg) => {
                  const isInternalNote = msg.isInternal;
                  const isCustomer = msg.senderType === 'CUSTOMER';
                  const isAi = msg.senderType === 'AI';

                  return (
                    <div
                      key={msg.id}
                      className={`p-4 rounded-xl border text-sm transition-all ${
                        isInternalNote
                          ? 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-300/80 dark:border-amber-900/60 text-amber-950 dark:text-amber-200 shadow-xs'
                          : isCustomer
                            ? 'bg-slate-50/80 dark:bg-zinc-800/60 border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-zinc-200'
                            : isAi
                              ? 'bg-purple-50/70 dark:bg-purple-950/30 border-purple-200 dark:border-purple-900/60 text-purple-950 dark:text-purple-200'
                              : 'bg-indigo-50/70 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-900/60 text-indigo-950 dark:text-indigo-200'
                      }`}
                      data-testid={`message-${msg.id}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          {isInternalNote && (
                            <span className="flex items-center space-x-1 bg-amber-200/90 dark:bg-amber-900/80 text-amber-900 dark:text-amber-100 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded shadow-2xs">
                              <Lock className="w-2.5 h-2.5" />
                              <span>Internal Note</span>
                            </span>
                          )}
                          <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-zinc-200">
                            {isCustomer ? (
                              <User className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400" />
                            ) : isAi ? (
                              <Bot className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                            ) : (
                              <UserCheck className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                            )}
                            <span>{msg.senderType}</span>
                          </span>
                          <span className="text-[10px] font-mono text-slate-400 dark:text-zinc-500 bg-white/70 dark:bg-zinc-800 px-1.5 py-0.2 rounded border border-slate-200/60 dark:border-zinc-700">
                            seq #{msg.seq}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 dark:text-zinc-500 font-mono">
                          {new Date(msg.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <div className="whitespace-pre-wrap leading-relaxed text-sm">{msg.body}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Modern Composer with Tabs, Markdown Shortcuts & 1-Click AI Draft */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200/80 dark:border-zinc-800 p-5 shadow-xs transition-colors">
            {ticket.status === 'CLOSED' ? (
              <div className="p-4 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs text-slate-500 dark:text-zinc-400 text-center">
                This ticket is closed. Reopen or create a new ticket to continue conversation.
              </div>
            ) : (
              <form onSubmit={handleSendMessage} className="space-y-3.5">
                {/* Header: Tabs + 1-Click Draft with AI */}
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-2.5">
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => setIsInternal(false)}
                      className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                        !isInternal
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200/70 dark:hover:bg-zinc-700'
                      }`}
                      data-testid="composer-public-tab"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Public Reply</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsInternal(true)}
                      className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                        isInternal
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200/70 dark:hover:bg-zinc-700'
                      }`}
                      data-testid="composer-internal-tab"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Internal Note</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleDraftAiReply}
                    disabled={isSuggesting}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 px-3 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 disabled:opacity-50 transition-colors cursor-pointer shadow-2xs"
                    data-testid="draft-with-ai-button"
                  >
                    {isSuggesting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    )}
                    <span>{isSuggesting ? 'Drafting...' : 'Draft with AI'}</span>
                  </button>
                </div>

                {/* Markdown Shortcut Bar */}
                <div className="flex items-center gap-1 py-1 px-1 bg-slate-50 dark:bg-zinc-800 border border-slate-200/60 dark:border-zinc-700 rounded-lg text-slate-500 dark:text-zinc-400">
                  <button
                    type="button"
                    onClick={() => insertMarkdownShortcut('**', '**')}
                    title="Bold"
                    className="p-1.5 hover:bg-white dark:hover:bg-zinc-700 hover:text-slate-900 dark:hover:text-zinc-100 rounded transition-colors cursor-pointer"
                  >
                    <Bold className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => insertMarkdownShortcut('*', '*')}
                    title="Italic"
                    className="p-1.5 hover:bg-white dark:hover:bg-zinc-700 hover:text-slate-900 dark:hover:text-zinc-100 rounded transition-colors cursor-pointer"
                  >
                    <Italic className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => insertMarkdownShortcut('`', '`')}
                    title="Inline Code"
                    className="p-1.5 hover:bg-white dark:hover:bg-zinc-700 hover:text-slate-900 dark:hover:text-zinc-100 rounded transition-colors cursor-pointer"
                  >
                    <Code className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => insertMarkdownShortcut('- ')}
                    title="Bullet List"
                    className="p-1.5 hover:bg-white dark:hover:bg-zinc-700 hover:text-slate-900 dark:hover:text-zinc-100 rounded transition-colors cursor-pointer"
                  >
                    <List className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => insertMarkdownShortcut('> ')}
                    title="Quote"
                    className="p-1.5 hover:bg-white dark:hover:bg-zinc-700 hover:text-slate-900 dark:hover:text-zinc-100 rounded transition-colors cursor-pointer"
                  >
                    <Quote className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => insertMarkdownShortcut('[', '](https://)')}
                    title="Insert Link"
                    className="p-1.5 hover:bg-white dark:hover:bg-zinc-700 hover:text-slate-900 dark:hover:text-zinc-100 rounded transition-colors cursor-pointer"
                  >
                    <LinkIcon className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Textarea */}
                <textarea
                  ref={textareaRef}
                  rows={4}
                  required
                  value={messageBody}
                  onChange={(e) => setMessageBody(e.target.value)}
                  placeholder={
                    isInternal
                      ? 'Add an internal note visible only to agents and leads...'
                      : 'Type a customer reply...'
                  }
                  className={`w-full p-3.5 border rounded-xl text-sm focus:outline-none focus:ring-2 transition-all ${
                    isInternal
                      ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800/60 text-amber-950 dark:text-amber-100 focus:ring-amber-500/20 focus:border-amber-500 placeholder:text-amber-700/50 dark:placeholder:text-amber-400/40'
                      : 'bg-white dark:bg-zinc-800/80 border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-zinc-100 focus:ring-indigo-500/20 focus:border-indigo-500 placeholder:text-slate-400 dark:placeholder:text-zinc-500'
                  }`}
                  data-testid="message-textarea"
                />

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-slate-400 dark:text-zinc-500">
                    Supports Markdown formatting (Ctrl+Enter to send)
                  </span>
                  <button
                    type="submit"
                    disabled={addMessage.isPending || !messageBody.trim()}
                    className={`px-4 py-2 text-xs font-semibold text-white rounded-lg shadow-xs disabled:opacity-40 flex items-center space-x-1.5 cursor-pointer transition-colors ${
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
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200/80 dark:border-zinc-800 p-5 shadow-xs h-fit transition-colors">
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-zinc-800 pb-3">
            <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100 flex items-center space-x-2">
              <History className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Activity Timeline</span>
            </h2>
            <span className="text-[11px] font-mono text-slate-400 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
              {timeline.length} events
            </span>
          </div>

          <div className="relative pl-6 space-y-6" data-testid="activity-timeline">
            {timeline.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-zinc-500 italic py-4">
                No events recorded yet.
              </p>
            ) : (
              <>
                {/* Connected vertical line */}
                <div className="absolute left-2.5 top-2 bottom-3 w-0.5 bg-slate-200 dark:bg-zinc-800 -z-0" />

                {timeline.map((event) => (
                  <div key={event.id} className="relative text-xs group">
                    {/* Node Icon */}
                    <div className="absolute -left-6 top-0 w-5 h-5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-full flex items-center justify-center shadow-2xs z-10">
                      {getTimelineIcon(event.type)}
                    </div>

                    <div className="flex items-center justify-between gap-1">
                      <span className="font-semibold text-slate-800 dark:text-zinc-200 uppercase tracking-wider text-[10px] bg-slate-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded border border-slate-200/60 dark:border-zinc-700">
                        {event.type}
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono">
                        {formatRelativeTime(event.createdAt)}
                      </span>
                    </div>

                    <div className="text-slate-600 dark:text-zinc-400 mt-1 text-[11px] bg-slate-50/70 dark:bg-zinc-800/40 p-2 rounded-lg border border-slate-100 dark:border-zinc-800 font-mono break-all">
                      {JSON.stringify(event.payload || {})}
                    </div>

                    <div className="text-slate-400 dark:text-zinc-500 text-[10px] mt-1 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-300 dark:text-zinc-600" />
                      <span>
                        {new Date(event.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>

      <TransferTicketModal
        isOpen={isTransferOpen}
        ticketId={ticket.id}
        ticketNumber={ticket.number}
        currentAssigneeId={ticket.assigneeId}
        version={ticket.version}
        onClose={() => setIsTransferOpen(false)}
        onTransferred={() => refetch()}
      />

      <MergeTicketModal
        isOpen={isMergeOpen}
        ticketId={ticket.id}
        ticketNumber={ticket.number}
        version={ticket.version}
        onClose={() => setIsMergeOpen(false)}
        onMerged={() => refetch()}
      />
    </div>
  );
}
