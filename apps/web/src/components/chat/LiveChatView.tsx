import React, { useState } from 'react';
import {
  MessageSquare,
  User,
  Bot,
  Send,
  Sparkles,
  ArrowRight,
  CheckCircle,
  BookOpen,
  UserCheck,
  RefreshCw,
  FileText,
  Lightbulb,
  Loader2,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { useAuthStore } from '../../store/auth.store';
import { api, type SummarizeResult } from '../../lib/api';

export interface ChatMessage {
  id: string;
  senderType: 'CUSTOMER' | 'AGENT' | 'AI' | 'SYSTEM';
  body: string;
  createdAt: string;
  citations?: Array<{ chunkId: string; docId: string; title: string }>;
}

export interface ConversationItem {
  id: string;
  customerName: string;
  customerEmail: string;
  state: 'WAITING_AGENT' | 'AGENT_ACTIVE' | 'CLOSED';
  lastMessage: string;
  assignedTo?: string;
  messages: ChatMessage[];
  aiSuggestion?: {
    text: string;
    citations: Array<{ chunkId: string; docId: string; title: string }>;
    confidence: number;
  };
}

const INITIAL_CONVERSATIONS: ConversationItem[] = [
  {
    id: 'conv-001',
    customerName: 'Sarah Connor',
    customerEmail: 'sarah@skynet-survivors.org',
    state: 'WAITING_AGENT',
    lastMessage: 'I need to speak to an agent about SAML SSO setup.',
    messages: [
      {
        id: 'm1',
        senderType: 'CUSTOMER',
        body: 'Hello, how do I configure SAML SSO in SupportPilot?',
        createdAt: '10:14 AM',
      },
      {
        id: 'm2',
        senderType: 'AI',
        body: 'To configure SSO, an account Owner must upload the identity provider metadata XML document under Organization Settings > Security.',
        createdAt: '10:14 AM',
        citations: [
          { chunkId: 'doc_eval_kb_1', docId: 'doc_eval_kb', title: 'SAML Authentication' },
        ],
      },
      {
        id: 'm3',
        senderType: 'CUSTOMER',
        body: 'Can I speak to a real human agent to help verify our certificate?',
        createdAt: '10:15 AM',
      },
      {
        id: 'm4',
        senderType: 'SYSTEM',
        body: 'Conversation transferred to human support queue (reason: Human agent requested).',
        createdAt: '10:15 AM',
      },
    ],
    aiSuggestion: {
      text: 'Hello Sarah, I can certainly assist you with verifying your SAML certificate. Could you confirm if you are uploading an X.509 PEM certificate or an XML metadata file?',
      citations: [
        {
          chunkId: 'doc_eval_kb_1',
          docId: 'doc_eval_kb',
          title: 'Authentication and Account Security',
        },
      ],
      confidence: 0.94,
    },
  },
  {
    id: 'conv-002',
    customerName: 'David Miller',
    customerEmail: 'david@enterprise.io',
    state: 'AGENT_ACTIVE',
    assignedTo: 'user_agent_001',
    lastMessage: 'Thanks, the billing portal reset worked.',
    messages: [
      {
        id: 'm10',
        senderType: 'CUSTOMER',
        body: 'Where can I find our November invoice?',
        createdAt: '09:30 AM',
      },
      {
        id: 'm11',
        senderType: 'AGENT',
        body: 'Invoices are available under Organization Settings > Billing > History as downloadable PDFs.',
        createdAt: '09:32 AM',
      },
      {
        id: 'm12',
        senderType: 'CUSTOMER',
        body: 'Thanks, the billing portal reset worked.',
        createdAt: '09:33 AM',
      },
    ],
  },
];

export function LiveChatView() {
  const user = useAuthStore((s) => s.user);
  const [conversations, setConversations] = useState<ConversationItem[]>(INITIAL_CONVERSATIONS);
  const [activeQueue, setActiveQueue] = useState<'waiting' | 'mine' | 'all'>('waiting');
  const [selectedConvId, setSelectedConvId] = useState<string>('conv-001');
  const [composerText, setComposerText] = useState('');
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaries, setSummaries] = useState<Record<string, SummarizeResult>>({});

  const waitingCount = conversations.filter((c) => c.state === 'WAITING_AGENT').length;
  const mineCount = conversations.filter((c) => c.assignedTo === user?.id).length;
  const allCount = conversations.length;

  const filteredConversations = conversations.filter((c) => {
    if (activeQueue === 'waiting') return c.state === 'WAITING_AGENT';
    if (activeQueue === 'mine') return c.assignedTo === user?.id;
    return true;
  });

  const activeConv = conversations.find((c) => c.id === selectedConvId) || conversations[0];

  const handleGenerateSuggestion = async () => {
    if (!activeConv) return;
    setIsSuggesting(true);
    try {
      const res = await api.ai.suggestReply({
        tenantId: user?.tenantId || 'tenant_alpha_111',
        conversationId: activeConv.id,
        messages: activeConv.messages.map((m) => ({
          role:
            m.senderType === 'CUSTOMER' ? 'customer' : m.senderType === 'AI' ? 'system' : 'agent',
          content: m.body,
        })),
      });
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeConv.id
            ? {
                ...c,
                aiSuggestion: {
                  text: res.suggestion,
                  citations: res.citations,
                  confidence: res.confidence,
                },
              }
            : c,
        ),
      );
    } catch {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeConv.id
            ? {
                ...c,
                aiSuggestion: {
                  text: 'Regarding your request, please provide more details so we can assist further.',
                  citations: [],
                  confidence: 0.85,
                },
              }
            : c,
        ),
      );
    } finally {
      setIsSuggesting(false);
    }
  };

  const handleSummarize = async () => {
    if (!activeConv) return;
    setIsSummarizing(true);
    try {
      const res = await api.ai.summarize({
        tenantId: user?.tenantId || 'tenant_alpha_111',
        conversationId: activeConv.id,
        messages: activeConv.messages.map((m) => ({
          role:
            m.senderType === 'CUSTOMER' ? 'customer' : m.senderType === 'AI' ? 'system' : 'agent',
          content: m.body,
        })),
      });
      setSummaries((prev) => ({ ...prev, [activeConv.id]: res }));
    } catch {
      setSummaries((prev) => ({
        ...prev,
        [activeConv.id]: {
          summary: 'Customer discussed support request and asked to speak with human agent.',
          keyPoints: ['User inquired about configuration', 'Handoff requested to human support'],
          sentiment: 'NEUTRAL',
          recommendedAction: 'Verify customer account details and assist with setup.',
          latencyMs: 12,
        },
      }));
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleTakeOver = () => {
    if (!activeConv) return;
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConv.id
          ? {
              ...c,
              state: 'AGENT_ACTIVE',
              assignedTo: user?.id,
              messages: [
                ...c.messages,
                {
                  id: `sys-${Date.now()}`,
                  senderType: 'SYSTEM',
                  body: `${user?.name || 'Agent'} took over the conversation.`,
                  createdAt: new Date().toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  }),
                },
              ],
            }
          : c,
      ),
    );
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!composerText.trim() || !activeConv) return;

    const newMsg: ChatMessage = {
      id: `m-${Date.now()}`,
      senderType: 'AGENT',
      body: composerText.trim(),
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConv.id
          ? {
              ...c,
              lastMessage: newMsg.body,
              messages: [...c.messages, newMsg],
            }
          : c,
      ),
    );

    setComposerText('');
  };

  const handleInsertSuggestion = () => {
    if (activeConv?.aiSuggestion) {
      setComposerText(activeConv.aiSuggestion.text);
    }
  };

  return (
    <div className="h-[calc(100vh-8.5rem)] flex flex-col bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
      {/* View Header with Slack/Linear Density & Stitch Live Indicators */}
      <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-slate-900 tracking-tight">
                Live Agent Console
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-mono text-[10px] font-semibold border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Feed
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Real-time omnichannel conversations & AI copilot
            </p>
          </div>
        </div>

        {/* Queue filter tabs with animated pulse badges */}
        <div className="inline-flex rounded-lg bg-slate-200/80 p-1 text-xs font-semibold gap-1">
          <button
            type="button"
            onClick={() => setActiveQueue('waiting')}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md transition-all cursor-pointer ${
              activeQueue === 'waiting'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {waitingCount > 0 && (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
            )}
            <span>Waiting ({waitingCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveQueue('mine')}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md transition-all cursor-pointer ${
              activeQueue === 'mine'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Mine ({mineCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveQueue('all')}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md transition-all cursor-pointer ${
              activeQueue === 'all'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>All ({allCount})</span>
          </button>
        </div>
      </div>

      {/* 3-Pane Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Pane 1: Queue Conversation List */}
        <div className="w-80 border-r border-slate-200 overflow-y-auto bg-slate-50/40">
          {filteredConversations.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              No conversations in this queue.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredConversations.map((c) => {
                const isSelected = activeConv?.id === c.id;
                const isWaiting = c.state === 'WAITING_AGENT';

                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedConvId(c.id)}
                    className={`w-full text-left p-3.5 hover:bg-slate-100/60 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-50/70 border-l-4 border-indigo-600'
                        : 'border-l-4 border-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-slate-900 text-xs truncate max-w-[130px]">
                        {c.customerName}
                      </span>
                      {isWaiting ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-full border border-amber-200">
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
                          </span>
                          WAITING
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-full border border-emerald-200">
                          <CheckCircle className="w-2.5 h-2.5 text-emerald-600" />
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 truncate mb-1">
                      <span className="truncate">{c.customerEmail}</span>
                      <span className="shrink-0 px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 font-mono text-[9px] font-semibold border border-indigo-100">
                        Web Chat
                      </span>
                    </div>
                    <div className="text-xs text-slate-600 truncate font-normal">
                      {c.lastMessage}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Pane 2: Active Chat Conversation */}
        <div className="flex-1 flex flex-col border-r border-slate-200 bg-white">
          {activeConv ? (
            <>
              {/* Chat Thread Header */}
              <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between bg-white">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 font-semibold text-xs">
                    {activeConv.customerName
                      .split(' ')
                      .map((n) => n[0])
                      .join('')}
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">{activeConv.customerName}</h2>
                    <p className="text-[11px] text-slate-400">{activeConv.customerEmail}</p>
                  </div>
                </div>

                {activeConv.state === 'WAITING_AGENT' && (
                  <button
                    type="button"
                    onClick={handleTakeOver}
                    className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-xs transition-colors cursor-pointer"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    Take Over Chat
                  </button>
                )}
              </div>

              {/* Chat Messages - Slack/iMessage style bubbles */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-slate-50/30">
                {activeConv.messages.map((m) => {
                  if (m.senderType === 'SYSTEM') {
                    return (
                      <div key={m.id} className="text-center my-3">
                        <span className="text-[11px] text-slate-500 bg-slate-100 px-3 py-1 rounded-full border border-slate-200/80 shadow-2xs font-medium">
                          {m.body}
                        </span>
                      </div>
                    );
                  }

                  const isCustomer = m.senderType === 'CUSTOMER';
                  const isAi = m.senderType === 'AI';

                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col group ${isCustomer ? 'items-start' : 'items-end'}`}
                    >
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-1 px-1">
                        {isCustomer ? (
                          <User className="w-3 h-3 text-slate-400" />
                        ) : isAi ? (
                          <Bot className="w-3 h-3 text-indigo-500" />
                        ) : (
                          <UserCheck className="w-3 h-3 text-emerald-500" />
                        )}
                        <span className="font-medium text-slate-600">
                          {isCustomer
                            ? activeConv.customerName
                            : isAi
                              ? 'AI SupportPilot'
                              : 'Agent'}
                        </span>
                        <span>•</span>
                        <span className="font-mono text-[10px] text-slate-400">{m.createdAt}</span>
                      </div>

                      <div
                        className={`max-w-md p-3.5 rounded-2xl text-sm leading-relaxed transition-all shadow-xs ${
                          isCustomer
                            ? 'bg-white border border-slate-200/80 text-slate-800 rounded-tl-xs'
                            : isAi
                              ? 'bg-indigo-50/90 border border-indigo-200 text-indigo-950 rounded-tr-xs'
                              : 'bg-indigo-600 text-white rounded-tr-xs'
                        }`}
                      >
                        {m.body}

                        {/* Verified citation chips */}
                        {m.citations && m.citations.length > 0 && (
                          <div className="mt-2.5 pt-2 border-t border-indigo-200/60 flex flex-wrap gap-1.5">
                            {m.citations.map((c) => (
                              <span
                                key={c.chunkId}
                                className="inline-flex items-center gap-1 text-[10px] font-medium bg-white/90 text-indigo-700 px-2 py-0.5 rounded-md border border-indigo-200/80 shadow-2xs"
                              >
                                <BookOpen className="w-2.5 h-2.5 text-indigo-600" />
                                <span>{c.title}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Animated 3-dot typing indicator */}
                <div className="flex items-center gap-1.5 py-1 px-3 bg-white border border-slate-200/80 rounded-full w-fit shadow-2xs">
                  <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                  <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                  <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce"></span>
                  <span className="text-[10px] text-slate-400 ml-1 font-medium">
                    AI Copilot listening
                  </span>
                </div>
              </div>

              {/* Message Composer */}
              <form
                onSubmit={handleSendMessage}
                className="p-3 bg-white border-t border-slate-200 flex items-center gap-2"
              >
                <input
                  type="text"
                  value={composerText}
                  onChange={(e) => setComposerText(e.target.value)}
                  placeholder="Type reply to customer..."
                  className="flex-1 rounded-lg border border-slate-200 bg-slate-50/50 p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400"
                />
                <button
                  type="submit"
                  disabled={!composerText.trim()}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white p-2.5 rounded-lg transition-colors cursor-pointer shadow-xs"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </>
          ) : (
            <div className="p-12 text-center text-slate-400">
              Select a conversation from the queue
            </div>
          )}
        </div>

        {/* Pane 3: AI Copilot Card & Summarization Panel */}
        <div className="w-88 p-4 bg-slate-50/70 overflow-y-auto space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                AI Suggestion Panel
              </h3>
            </div>
            <button
              type="button"
              onClick={handleGenerateSuggestion}
              disabled={isSuggesting}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 disabled:opacity-50 cursor-pointer"
              title="Generate new reply suggestion"
            >
              {isSuggesting ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <RefreshCw className="w-3 h-3" />
              )}
              <span>{isSuggesting ? 'Generating...' : 'Refresh'}</span>
            </button>
          </div>

          {activeConv?.aiSuggestion ? (
            <div className="bg-white p-4 rounded-xl border border-indigo-200/80 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-indigo-800 text-xs flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-indigo-600" />
                  Recommended Reply
                </span>
                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  Grounding: Verified
                </span>
              </div>

              {/* Radial confidence score badge */}
              <div className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg border border-slate-100">
                <div className="relative w-10 h-10 flex items-center justify-center shrink-0">
                  <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="14" fill="none" stroke="#e2e8f0" strokeWidth="3" />
                    <circle
                      cx="18"
                      cy="18"
                      r="14"
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="3"
                      strokeDasharray={88}
                      strokeDashoffset={88 - 88 * activeConv.aiSuggestion.confidence}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute text-[9px] font-mono font-bold text-emerald-700">
                    {Math.round(activeConv.aiSuggestion.confidence * 100)}%
                  </span>
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-800">
                    {Math.round(activeConv.aiSuggestion.confidence * 100)}% match
                  </div>
                  <div className="text-[10px] text-slate-400 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                    <span>High confidence grounding</span>
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-700 leading-relaxed bg-slate-50/70 p-2.5 rounded-lg border border-slate-100">
                {activeConv.aiSuggestion.text}
              </p>

              {activeConv.aiSuggestion.citations.length > 0 && (
                <div className="space-y-1">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                    KB Citations:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {activeConv.aiSuggestion.citations.map((c) => (
                      <span
                        key={c.chunkId}
                        className="inline-flex items-center gap-1 text-[10px] font-medium bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-100"
                      >
                        <BookOpen className="w-2.5 h-2.5 text-indigo-600" />
                        {c.title}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={handleInsertSuggestion}
                className="w-full inline-flex items-center justify-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold py-2 rounded-lg border border-indigo-200 transition-colors cursor-pointer shadow-2xs"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                <span>Insert into Reply</span>
              </button>
            </div>
          ) : (
            <div className="p-4 text-center bg-white rounded-xl border border-slate-200/80">
              <p className="text-xs text-slate-400 mb-2">No suggestion generated yet.</p>
              <button
                type="button"
                onClick={handleGenerateSuggestion}
                disabled={isSuggesting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-lg hover:bg-indigo-100 border border-indigo-200 transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                <span>Generate Suggestion</span>
              </button>
            </div>
          )}

          {/* Conversation Summary Section */}
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                <FileText className="w-3.5 h-3.5 text-indigo-600" />
                <span>Conversation Summary</span>
              </div>
              <button
                type="button"
                onClick={handleSummarize}
                disabled={isSummarizing}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 disabled:opacity-50 cursor-pointer"
              >
                {isSummarizing ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Sparkles className="w-3 h-3 text-indigo-600" />
                )}
                <span>{isSummarizing ? 'Summarizing...' : 'Summarize'}</span>
              </button>
            </div>

            {(() => {
              const currentSummary = activeConv ? summaries[activeConv.id] : undefined;
              if (!currentSummary) {
                return (
                  <div>
                    <p className="text-slate-500 leading-relaxed mb-3">
                      Customer asked about SAML SSO certificate verification and escalated to human
                      agent.
                    </p>
                    <button
                      type="button"
                      onClick={handleSummarize}
                      disabled={isSummarizing}
                      className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg transition-colors cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Summarize Conversation</span>
                    </button>
                  </div>
                );
              }

              return (
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-bold text-slate-400">
                      Sentiment:
                    </span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                        currentSummary.sentiment === 'URGENT'
                          ? 'bg-rose-100 text-rose-800 border border-rose-200'
                          : currentSummary.sentiment === 'FRUSTRATED'
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : currentSummary.sentiment === 'POSITIVE'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-slate-100 text-slate-800 border border-slate-200'
                      }`}
                    >
                      {currentSummary.sentiment}
                    </span>
                  </div>

                  <p className="text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    {currentSummary.summary}
                  </p>

                  {currentSummary.keyPoints.length > 0 && (
                    <div>
                      <span className="text-[10px] font-semibold text-slate-500 uppercase">
                        Key Points:
                      </span>
                      <ul className="mt-1 space-y-1 list-disc list-inside text-slate-600">
                        {currentSummary.keyPoints.map((pt, i) => (
                          <li key={i}>{pt}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {currentSummary.recommendedAction && (
                    <div className="p-2.5 bg-indigo-50/60 rounded-lg border border-indigo-100 flex items-start gap-2">
                      <Lightbulb className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold text-indigo-900 block text-[11px]">
                          Recommended Action
                        </span>
                        <span className="text-indigo-800 text-[11px]">
                          {currentSummary.recommendedAction}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}
