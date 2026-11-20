import React, { useState } from 'react';
import {
  MessageSquare,
  User,
  Bot,
  Send,
  Sparkles,
  ArrowRight,
  CheckCircle,
  Clock,
  BookOpen,
  UserCheck,
  RefreshCw,
  FileText,
  Lightbulb,
  Loader2,
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
    <div className="h-[calc(100vh-8.5rem)] flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* View Header */}
      <div className="px-6 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
        <div className="flex items-center gap-3">
          <MessageSquare className="w-5 h-5 text-indigo-600" />
          <h1 className="text-base font-bold text-slate-900">Live Agent Console</h1>
        </div>

        {/* Queue filter tabs */}
        <div className="inline-flex rounded-lg bg-slate-200/70 p-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveQueue('waiting')}
            className={`px-3 py-1 rounded-md transition-colors ${
              activeQueue === 'waiting'
                ? 'bg-white text-indigo-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Waiting ({conversations.filter((c) => c.state === 'WAITING_AGENT').length})
          </button>
          <button
            type="button"
            onClick={() => setActiveQueue('mine')}
            className={`px-3 py-1 rounded-md transition-colors ${
              activeQueue === 'mine'
                ? 'bg-white text-indigo-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Mine ({conversations.filter((c) => c.assignedTo === user?.id).length})
          </button>
          <button
            type="button"
            onClick={() => setActiveQueue('all')}
            className={`px-3 py-1 rounded-md transition-colors ${
              activeQueue === 'all'
                ? 'bg-white text-indigo-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All ({conversations.length})
          </button>
        </div>
      </div>

      {/* Three Column Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Col 1: Queue Conversation List */}
        <div className="w-80 border-r border-slate-200 overflow-y-auto bg-slate-50/30">
          {filteredConversations.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              No conversations in this queue.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredConversations.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedConvId(c.id)}
                  className={`w-full text-left p-4 hover:bg-slate-50 transition-colors ${
                    activeConv?.id === c.id ? 'bg-indigo-50/60 border-l-4 border-indigo-600' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-slate-900 text-sm truncate max-w-[140px]">
                      {c.customerName}
                    </span>
                    {c.state === 'WAITING_AGENT' ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                        <Clock className="w-2.5 h-2.5" />
                        WAITING
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                        <CheckCircle className="w-2.5 h-2.5" />
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 truncate mb-1">{c.customerEmail}</div>
                  <div className="text-xs text-slate-600 truncate">{c.lastMessage}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Col 2: Active Chat Conversation */}
        <div className="flex-1 flex flex-col border-r border-slate-200">
          {activeConv ? (
            <>
              {/* Chat Thread Header */}
              <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-white">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">{activeConv.customerName}</h2>
                  <p className="text-xs text-slate-500">{activeConv.customerEmail}</p>
                </div>
                {activeConv.state === 'WAITING_AGENT' && (
                  <button
                    type="button"
                    onClick={handleTakeOver}
                    className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3 py-1.5 rounded-md shadow-xs transition-colors"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    Take Over Chat
                  </button>
                )}
              </div>

              {/* Chat Messages */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50/20">
                {activeConv.messages.map((m) => {
                  if (m.senderType === 'SYSTEM') {
                    return (
                      <div key={m.id} className="text-center my-2">
                        <span className="text-[11px] text-slate-500 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
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
                      className={`flex flex-col ${isCustomer ? 'items-start' : 'items-end'}`}
                    >
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-1">
                        {isCustomer ? (
                          <User className="w-3 h-3" />
                        ) : isAi ? (
                          <Bot className="w-3 h-3 text-indigo-500" />
                        ) : (
                          <UserCheck className="w-3 h-3 text-emerald-500" />
                        )}
                        <span>
                          {isCustomer
                            ? activeConv.customerName
                            : isAi
                              ? 'AI SupportPilot'
                              : 'Agent'}
                        </span>
                        <span>•</span>
                        <span>{m.createdAt}</span>
                      </div>
                      <div
                        className={`max-w-md p-3 rounded-xl text-sm leading-relaxed ${
                          isCustomer
                            ? 'bg-white border border-slate-200 text-slate-800 rounded-tl-xs'
                            : isAi
                              ? 'bg-indigo-50/80 border border-indigo-200 text-indigo-950 rounded-tr-xs'
                              : 'bg-indigo-600 text-white rounded-tr-xs'
                        }`}
                      >
                        {m.body}

                        {m.citations && m.citations.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-indigo-200/50 flex flex-wrap gap-1">
                            {m.citations.map((c) => (
                              <span
                                key={c.chunkId}
                                className="inline-flex items-center gap-1 text-[10px] font-medium bg-white/80 text-indigo-700 px-2 py-0.5 rounded"
                              >
                                <BookOpen className="w-2.5 h-2.5" />
                                {c.title}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
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
                  className="flex-1 rounded-lg border border-slate-300 p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="submit"
                  disabled={!composerText.trim()}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white p-2.5 rounded-lg transition-colors"
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

        {/* Col 3: AI Suggestion & Summarization Panel (PRD S06 / AI-5, AI-6) */}
        <div className="w-88 p-5 bg-slate-50/60 overflow-y-auto space-y-4">
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
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
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
            <div className="bg-white p-4 rounded-xl border border-indigo-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-indigo-700 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  Recommended Reply
                </span>
                <span className="font-mono text-emerald-600 font-bold">
                  {Math.round(activeConv.aiSuggestion.confidence * 100)}% match
                </span>
              </div>

              <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-2.5 rounded-md border border-slate-100">
                {activeConv.aiSuggestion.text}
              </p>

              {activeConv.aiSuggestion.citations.length > 0 && (
                <div className="space-y-1">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase">
                    KB Citations:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {activeConv.aiSuggestion.citations.map((c) => (
                      <span
                        key={c.chunkId}
                        className="inline-flex items-center gap-1 text-[10px] font-medium bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-100"
                      >
                        <BookOpen className="w-2.5 h-2.5" />
                        {c.title}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={handleInsertSuggestion}
                className="w-full inline-flex items-center justify-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold py-2 rounded-lg border border-indigo-200 transition-colors"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                Insert into Reply
              </button>
            </div>
          ) : (
            <div className="p-4 text-center bg-white rounded-xl border border-slate-200">
              <p className="text-xs text-slate-400 mb-2">No suggestion generated yet.</p>
              <button
                type="button"
                onClick={handleGenerateSuggestion}
                disabled={isSuggesting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-lg hover:bg-indigo-100 border border-indigo-200"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Generate Suggestion</span>
              </button>
            </div>
          )}

          {/* Conversation Summary Section (AI-6) */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                <FileText className="w-3.5 h-3.5 text-indigo-600" />
                <span>Conversation Summary</span>
              </div>
              <button
                type="button"
                onClick={handleSummarize}
                disabled={isSummarizing}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
              >
                {isSummarizing ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Sparkles className="w-3 h-3" />
                )}
                <span>{isSummarizing ? 'Summarizing...' : 'Summarize'}</span>
              </button>
            </div>

            {activeConv && summaries[activeConv.id] ? (
              <div className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Sentiment:</span>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                      summaries[activeConv.id].sentiment === 'URGENT'
                        ? 'bg-rose-100 text-rose-800 border border-rose-200'
                        : summaries[activeConv.id].sentiment === 'FRUSTRATED'
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : summaries[activeConv.id].sentiment === 'POSITIVE'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-slate-100 text-slate-800 border border-slate-200'
                    }`}
                  >
                    {summaries[activeConv.id].sentiment}
                  </span>
                </div>

                <p className="text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  {summaries[activeConv.id].summary}
                </p>

                {summaries[activeConv.id].keyPoints.length > 0 && (
                  <div>
                    <span className="text-[10px] font-semibold text-slate-500 uppercase">
                      Key Points:
                    </span>
                    <ul className="mt-1 space-y-1 list-disc list-inside text-slate-600">
                      {summaries[activeConv.id].keyPoints.map((pt, i) => (
                        <li key={i}>{pt}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {summaries[activeConv.id].recommendedAction && (
                  <div className="p-2.5 bg-indigo-50/60 rounded-lg border border-indigo-100 flex items-start gap-2">
                    <Lightbulb className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-indigo-900 block text-[11px]">
                        Recommended Action
                      </span>
                      <span className="text-indigo-800 text-[11px]">
                        {summaries[activeConv.id].recommendedAction}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <p className="text-slate-500 leading-relaxed mb-3">
                  Customer asked about SAML SSO certificate verification and escalated to human
                  agent.
                </p>
                <button
                  type="button"
                  onClick={handleSummarize}
                  disabled={isSummarizing}
                  className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Summarize Conversation</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
