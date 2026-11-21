import React, { useState, useEffect } from 'react';
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
  const [mobilePane, setMobilePane] = useState<'queue' | 'chat' | 'copilot'>('chat');
  const [selectedConvId, setSelectedConvId] = useState<string>('conv-001');
  const [composerText, setComposerText] = useState('');
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaries, setSummaries] = useState<Record<string, SummarizeResult>>({});

  useEffect(() => {
    let mounted = true;
    api.tickets
      .list({ limit: 10 })
      .then((res) => {
        if (!mounted || !res.data || res.data.length === 0) return;
        const liveItems: ConversationItem[] = res.data.map((t) => ({
          id: t.id,
          customerName: `Customer #${t.number}`,
          customerEmail: `customer-${t.number}@example.com`,
          state: (t.status === 'NEW'
            ? 'WAITING_AGENT'
            : 'AGENT_ACTIVE') as ConversationItem['state'],
          lastMessage: t.subject || t.description || 'Support inquiry',
          assignedTo: t.assigneeId,
          messages: [
            {
              id: `msg-${t.id}-1`,
              senderType: 'CUSTOMER',
              body: t.description || t.subject,
              createdAt: new Date(t.createdAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              }),
            },
          ],
        }));
        setConversations((prev) => {
          const ids = new Set(liveItems.map((l) => l.id));
          return [...liveItems, ...prev.filter((p) => !ids.has(p.id))];
        });
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

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
    <div className="h-[calc(100vh-8.5rem)] flex flex-col bg-surface rounded-xl border border-border shadow-sm overflow-hidden transition-colors">
      {/* View Header with Stitch Live Indicators & Token Styling */}
      <div className="px-space-md py-space-sm border-b border-border flex flex-wrap items-center justify-between gap-space-md bg-surface">
        <div className="flex items-center gap-space-sm">
          <div className="w-8 h-8 rounded-lg bg-primary text-on-primary flex items-center justify-center shadow-xs">
            <span className="material-symbols-outlined text-[18px]">forum</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-headline-sm text-body-md font-semibold text-text-primary tracking-tight">
                Live Agent Console
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-ticket-open-bg text-ticket-open-text font-code-mono text-[10px] font-semibold border border-ticket-open-text/20">
                <span className="w-1.5 h-1.5 rounded-full bg-ticket-open-text animate-pulse" />
                Live Feed
              </span>
            </div>
            <p className="font-body-sm text-[11px] text-text-secondary">
              Real-time omnichannel conversations &amp; AI copilot
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Mobile pane switcher (lg:hidden) */}
          <div className="flex lg:hidden rounded-lg bg-surface-subtle p-0.5 text-xs font-semibold gap-0.5 border border-border">
            <button
              type="button"
              onClick={() => setMobilePane('queue')}
              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                mobilePane === 'queue'
                  ? 'bg-primary text-on-primary shadow-xs'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Queue
            </button>
            <button
              type="button"
              onClick={() => setMobilePane('chat')}
              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                mobilePane === 'chat'
                  ? 'bg-primary text-on-primary shadow-xs'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Chat
            </button>
            <button
              type="button"
              onClick={() => setMobilePane('copilot')}
              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                mobilePane === 'copilot'
                  ? 'bg-primary text-on-primary shadow-xs'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              AI Panel
            </button>
          </div>

          {/* Queue filter tabs with animated pulse badges */}
          <div
            aria-label="Queue filter"
            className="inline-flex rounded-xl bg-surface-subtle p-1 text-xs font-semibold gap-1 border border-border"
          >
            <button
              type="button"
              aria-pressed={activeQueue === 'waiting'}
              onClick={() => setActiveQueue('waiting')}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all cursor-pointer ${
                activeQueue === 'waiting'
                  ? 'bg-primary text-on-primary shadow-xs'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {waitingCount > 0 && (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-priority-high opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-priority-high"></span>
                </span>
              )}
              <span>Waiting ({waitingCount})</span>
            </button>

            <button
              type="button"
              aria-pressed={activeQueue === 'mine'}
              onClick={() => setActiveQueue('mine')}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all cursor-pointer ${
                activeQueue === 'mine'
                  ? 'bg-primary text-on-primary shadow-xs'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <span>Mine ({mineCount})</span>
            </button>

            <button
              type="button"
              aria-pressed={activeQueue === 'all'}
              onClick={() => setActiveQueue('all')}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all cursor-pointer ${
                activeQueue === 'all'
                  ? 'bg-primary text-on-primary shadow-xs'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <span>All ({allCount})</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3-Pane Layout with Responsive Mobile Toggle */}
      <div className="flex-1 flex overflow-hidden">
        {/* Pane 1: Queue Conversation List */}
        <div
          className={`${mobilePane === 'queue' ? 'block' : 'hidden'} lg:block w-full lg:w-80 border-r border-border overflow-y-auto bg-surface-subtle/40`}
        >
          {filteredConversations.length === 0 ? (
            <div className="p-8 text-center text-text-secondary font-body-sm">
              No conversations in this queue.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredConversations.map((c) => {
                const isSelected = activeConv?.id === c.id;
                const isWaiting = c.state === 'WAITING_AGENT';

                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setSelectedConvId(c.id);
                      setMobilePane('chat');
                    }}
                    className={`w-full text-left p-space-sm hover:bg-surface-subtle transition-all cursor-pointer relative ${
                      isSelected
                        ? 'bg-primary-fixed/30 border-l-4 border-primary'
                        : 'border-l-4 border-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-text-primary text-body-md truncate max-w-[140px]">
                        {c.customerName}
                      </span>
                      {isWaiting ? (
                        <span className="inline-flex items-center gap-1 text-code-mono font-bold text-ticket-pending-text bg-ticket-pending-bg px-2 py-0.5 rounded-full border border-ticket-pending-text/20">
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-priority-high opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-priority-high"></span>
                          </span>
                          WAITING
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-code-mono font-bold text-ticket-open-text bg-ticket-open-bg px-2 py-0.5 rounded-full border border-ticket-open-text/20">
                          <span className="material-symbols-outlined text-[13px]">
                            check_circle
                          </span>
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between font-body-sm text-text-secondary truncate mb-1">
                      <span className="truncate">{c.customerEmail}</span>
                      <span className="shrink-0 px-1.5 py-0.5 rounded bg-ticket-new-bg text-ticket-new-text font-code-mono text-[10px] font-semibold">
                        Web Chat
                      </span>
                    </div>
                    <div className="font-body-sm text-on-surface-variant truncate font-normal">
                      {c.lastMessage}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Pane 2: Active Chat Conversation */}
        <div
          className={`${mobilePane === 'chat' ? 'flex' : 'hidden'} lg:flex flex-1 flex-col border-r border-border bg-surface`}
        >
          {activeConv ? (
            <>
              {/* Chat Thread Header */}
              <div className="px-space-md py-space-sm border-b border-border flex items-center justify-between bg-surface shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary-fixed text-primary flex items-center justify-center font-semibold text-body-sm">
                    {activeConv.customerName
                      .split(' ')
                      .map((n) => n[0])
                      .join('')}
                  </div>
                  <div>
                    <h2 className="font-headline-sm text-body-md font-semibold text-text-primary leading-tight">
                      {activeConv.customerName}
                    </h2>
                    <p className="font-code-mono text-body-sm text-text-secondary">
                      {activeConv.customerEmail}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-space-xs">
                  {activeConv.state === 'WAITING_AGENT' && (
                    <button
                      type="button"
                      onClick={handleTakeOver}
                      className="inline-flex items-center gap-1.5 bg-primary hover:bg-primary-container text-on-primary text-body-sm font-semibold px-3 py-1.5 rounded-xl shadow-xs transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">how_to_reg</span>
                      Take Over Chat
                    </button>
                  )}
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 bg-surface-subtle hover:bg-surface-container text-text-primary text-body-sm font-medium px-3 py-1.5 rounded-xl border border-border transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px] text-text-secondary">
                      swap_horiz
                    </span>
                    Transfer
                  </button>
                </div>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 p-space-md overflow-y-auto space-y-space-md bg-surface-subtle/30">
                {activeConv.messages.map((m) => {
                  if (m.senderType === 'SYSTEM') {
                    return (
                      <div key={m.id} className="text-center my-3">
                        <span className="font-code-mono text-body-sm text-on-surface-variant bg-surface-container px-3 py-1 rounded-full border border-border shadow-2xs font-medium">
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
                      <div className="flex items-center gap-1.5 font-body-sm text-text-secondary mb-1 px-1">
                        <span className="material-symbols-outlined text-[14px]">
                          {isCustomer ? 'person' : isAi ? 'smart_toy' : 'support_agent'}
                        </span>
                        <span className="font-medium text-text-primary">
                          {isCustomer
                            ? activeConv.customerName
                            : isAi
                              ? 'SupportPilot AI'
                              : 'Agent'}
                        </span>
                        <span>•</span>
                        <span className="font-code-mono text-text-secondary">{m.createdAt}</span>
                      </div>

                      <div
                        className={`max-w-md p-space-md rounded-2xl text-body-md leading-relaxed transition-all shadow-xs ${
                          isCustomer
                            ? 'bg-surface border border-border text-text-primary rounded-bl-xs'
                            : isAi
                              ? 'bg-surface-container-low border border-border text-on-surface rounded-bl-xs'
                              : 'bg-primary text-on-primary rounded-br-xs'
                        }`}
                      >
                        {m.body}

                        {/* Citations */}
                        {m.citations && m.citations.length > 0 && (
                          <div className="mt-2.5 pt-2 border-t border-border/60 flex flex-wrap gap-1.5">
                            {m.citations.map((c) => (
                              <span
                                key={c.chunkId}
                                className="inline-flex items-center gap-1 font-code-mono text-[11px] font-medium bg-surface text-primary px-2 py-0.5 rounded-lg border border-border shadow-2xs"
                              >
                                <span className="material-symbols-outlined text-[13px]">
                                  menu_book
                                </span>
                                <span>{c.title}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Typing indicator */}
                <div className="flex items-center gap-1.5 py-1 px-3 bg-surface border border-border rounded-full w-fit shadow-2xs">
                  <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                  <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                  <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce"></span>
                  <span className="font-code-mono text-[10px] text-text-secondary ml-1 font-medium">
                    AI Copilot listening
                  </span>
                </div>
              </div>

              {/* Message Composer */}
              <form
                onSubmit={handleSendMessage}
                className="p-space-sm bg-surface border-t border-border flex items-center gap-2"
              >
                <input
                  type="text"
                  value={composerText}
                  onChange={(e) => setComposerText(e.target.value)}
                  placeholder="Type reply to customer..."
                  aria-label="Chat composer"
                  className="flex-1 rounded-xl border border-border bg-surface-subtle p-2.5 font-body-md text-body-md text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                />
                <button
                  type="submit"
                  disabled={!composerText.trim()}
                  className="bg-primary hover:bg-primary-container disabled:opacity-40 text-on-primary p-2.5 rounded-xl transition-colors cursor-pointer shadow-xs min-w-[40px] min-h-[40px] flex items-center justify-center"
                >
                  <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
                    send
                  </span>
                </button>
              </form>
            </>
          ) : (
            <div className="p-12 text-center text-text-secondary font-body-md">
              Select a conversation from the queue
            </div>
          )}
        </div>

        {/* Pane 3: AI Copilot Card & Summarization Panel */}
        <div
          className={`${mobilePane === 'copilot' ? 'block' : 'hidden'} lg:block w-full lg:w-88 p-space-md bg-surface-subtle/50 border-t lg:border-t-0 lg:border-l border-border overflow-y-auto space-y-space-md`}
        >
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[18px]">
                auto_awesome
              </span>
              <h3 className="font-headline-sm text-body-sm font-bold uppercase tracking-wider text-text-primary">
                AI Suggestion Panel
              </h3>
            </div>
            <button
              type="button"
              onClick={handleGenerateSuggestion}
              disabled={isSuggesting}
              className="inline-flex items-center gap-1 font-code-mono text-body-sm text-primary hover:text-primary-container disabled:opacity-50 cursor-pointer"
              title="Generate new reply suggestion"
            >
              <span
                className={`material-symbols-outlined text-[16px] ${isSuggesting ? 'animate-spin' : ''}`}
              >
                refresh
              </span>
              <span>{isSuggesting ? 'Generating...' : 'Refresh'}</span>
            </button>
          </div>

          {activeConv?.aiSuggestion ? (
            <div className="bg-surface p-space-md rounded-xl border border-border shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-primary text-body-sm flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px]">bolt</span>
                  Recommended Reply
                </span>
                <span className="font-code-mono text-[10px] font-semibold text-ticket-open-text bg-ticket-open-bg px-2 py-0.5 rounded-full border border-ticket-open-text/20">
                  Grounding: Verified
                </span>
              </div>

              {/* Radial confidence score badge */}
              <div
                role="progressbar"
                aria-valuenow={Math.round(activeConv.aiSuggestion.confidence * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="AI confidence score"
                className="flex items-center gap-3 p-2 bg-surface-subtle rounded-lg border border-border"
              >
                <div className="relative w-10 h-10 flex items-center justify-center shrink-0">
                  <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="14" fill="none" stroke="#e2e8f0" strokeWidth="3" />
                    <circle
                      cx="18"
                      cy="18"
                      r="14"
                      fill="none"
                      stroke="#15803d"
                      strokeWidth="3"
                      strokeDasharray={88}
                      strokeDashoffset={88 - 88 * activeConv.aiSuggestion.confidence}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute font-code-mono text-[9px] font-bold text-ticket-open-text">
                    {Math.round(activeConv.aiSuggestion.confidence * 100)}%
                  </span>
                </div>
                <div>
                  <div className="font-headline-sm text-body-sm font-bold text-text-primary">
                    {Math.round(activeConv.aiSuggestion.confidence * 100)}% match
                  </div>
                  <div className="font-body-sm text-[11px] text-text-secondary flex items-center gap-1">
                    <span className="material-symbols-outlined text-ticket-open-text text-[14px]">
                      verified
                    </span>
                    <span>High confidence grounding</span>
                  </div>
                </div>
              </div>

              <p className="font-body-md text-body-md text-text-primary leading-relaxed bg-surface-subtle/70 p-2.5 rounded-lg border border-border">
                {activeConv.aiSuggestion.text}
              </p>

              {activeConv.aiSuggestion.citations.length > 0 && (
                <div className="space-y-1">
                  <span className="font-code-mono text-[10px] font-semibold text-text-secondary uppercase tracking-wider">
                    KB Citations:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {activeConv.aiSuggestion.citations.map((c) => (
                      <span
                        key={c.chunkId}
                        className="inline-flex items-center gap-1 font-code-mono text-[10px] font-medium bg-ticket-new-bg text-ticket-new-text px-2 py-0.5 rounded border border-ticket-new-text/20"
                      >
                        <span className="material-symbols-outlined text-[12px]">menu_book</span>
                        {c.title}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={handleInsertSuggestion}
                className="w-full inline-flex items-center justify-center gap-1.5 bg-primary text-on-primary text-body-sm font-semibold py-2 rounded-xl hover:bg-primary-container transition-colors cursor-pointer shadow-xs"
              >
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                <span>Insert into Reply</span>
              </button>
            </div>
          ) : (
            <div className="p-4 text-center bg-surface rounded-xl border border-border">
              <p className="font-body-sm text-text-secondary mb-2">No suggestion generated yet.</p>
              <button
                type="button"
                onClick={handleGenerateSuggestion}
                disabled={isSuggesting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-on-primary text-body-sm font-semibold rounded-xl hover:bg-primary-container transition-colors cursor-pointer shadow-xs"
              >
                <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
                <span>Generate Suggestion</span>
              </button>
            </div>
          )}

          {/* Conversation Summary Section */}
          <div className="bg-surface p-space-md rounded-xl border border-border shadow-xs space-y-3 font-body-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-semibold text-text-primary">
                <span className="material-symbols-outlined text-primary text-[18px]">
                  description
                </span>
                <span>Conversation Summary</span>
              </div>
              <button
                type="button"
                onClick={handleSummarize}
                disabled={isSummarizing}
                className="inline-flex items-center gap-1 font-code-mono text-[11px] font-semibold text-primary hover:text-primary-container disabled:opacity-50 cursor-pointer"
              >
                <span
                  className={`material-symbols-outlined text-[14px] ${isSummarizing ? 'animate-spin' : ''}`}
                >
                  {isSummarizing ? 'sync' : 'auto_awesome'}
                </span>
                <span>{isSummarizing ? 'Summarizing...' : 'Summarize'}</span>
              </button>
            </div>

            {(() => {
              const currentSummary = activeConv ? summaries[activeConv.id] : undefined;
              if (!currentSummary) {
                return (
                  <div>
                    <p className="text-text-secondary leading-relaxed mb-3">
                      Customer asked about SAML SSO certificate verification and escalated to human
                      agent.
                    </p>
                    <button
                      type="button"
                      onClick={handleSummarize}
                      disabled={isSummarizing}
                      className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 bg-surface-subtle hover:bg-surface-container text-text-primary font-medium rounded-xl border border-border transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-primary text-[16px]">
                        auto_awesome
                      </span>
                      <span>Summarize Conversation</span>
                    </button>
                  </div>
                );
              }

              return (
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <span className="font-code-mono text-[10px] uppercase font-bold text-text-secondary">
                      Sentiment:
                    </span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded font-code-mono text-[10px] font-bold ${
                        currentSummary.sentiment === 'URGENT'
                          ? 'bg-priority-urgent/10 text-priority-urgent border border-priority-urgent/30'
                          : currentSummary.sentiment === 'FRUSTRATED'
                            ? 'bg-priority-high/10 text-priority-high border border-priority-high/30'
                            : currentSummary.sentiment === 'POSITIVE'
                              ? 'bg-ticket-open-bg text-ticket-open-text border border-ticket-open-text/30'
                              : 'bg-surface-subtle text-text-secondary border border-border'
                      }`}
                    >
                      {currentSummary.sentiment}
                    </span>
                  </div>

                  <p className="text-text-primary leading-relaxed bg-surface-subtle p-2.5 rounded-lg border border-border">
                    {currentSummary.summary}
                  </p>

                  {currentSummary.keyPoints.length > 0 && (
                    <div>
                      <span className="font-code-mono text-[10px] font-semibold text-text-secondary uppercase">
                        Key Points:
                      </span>
                      <ul className="mt-1 space-y-1 list-disc list-inside text-text-primary">
                        {currentSummary.keyPoints.map((pt, i) => (
                          <li key={i}>{pt}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {currentSummary.recommendedAction && (
                    <div className="p-2.5 bg-primary-fixed/30 rounded-lg border border-primary/20 flex items-start gap-2">
                      <span className="material-symbols-outlined text-primary text-[18px] shrink-0 mt-0.5">
                        lightbulb
                      </span>
                      <div>
                        <span className="font-semibold text-text-primary block text-[11px]">
                          Recommended Action
                        </span>
                        <span className="text-on-surface-variant text-[11px]">
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
