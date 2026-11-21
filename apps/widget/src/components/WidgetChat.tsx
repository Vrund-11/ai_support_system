import { useState, useRef, useEffect } from 'react';
import { Send, X, Bot, User, Shield, Sparkles, BookOpen, Paperclip, RotateCcw } from 'lucide-react';
import type { WidgetMessage, WidgetTheme } from '../types';
import { OfflineForm } from './OfflineForm';
import { CsatSurveyModal } from './CsatSurveyModal';

interface WidgetChatProps {
  messages: WidgetMessage[];
  isConnected: boolean;
  isTyping: boolean;
  onSendMessage: (text: string) => void;
  onNotifyTyping: () => void;
  onClose: () => void;
  onReset?: () => void;
  theme?: WidgetTheme;
  tenantId: string;
  gatewayUrl?: string;
  isOffline?: boolean;
}

export function WidgetChat({
  messages,
  isConnected,
  isTyping,
  onSendMessage,
  onNotifyTyping,
  onClose,
  onReset,
  theme = {},
  tenantId,
  gatewayUrl,
  isOffline = false,
}: WidgetChatProps) {
  const [inputText, setInputText] = useState('');
  const [activeTab, setActiveTab] = useState<'chat' | 'offline'>(isOffline ? 'offline' : 'chat');
  const [isCsatOpen, setIsCsatOpen] = useState(false);
  const [hasRated, setHasRated] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const primaryColor = theme.primaryColor || '#4f46e5';
  const title = theme.title || 'SupportPilot';
  const greeting = theme.greeting || 'Hi! How can we help you today?';

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    onNotifyTyping();
  };

  return (
    <div
      className="fixed bottom-24 right-6 w-[390px] max-w-[calc(100vw-3rem)] h-[580px] max-h-[calc(100vh-8rem)] bg-white rounded-2xl shadow-[0_24px_60px_-12px_rgba(15,23,42,0.28),0_8px_24px_-4px_rgba(15,23,42,0.12)] border border-slate-200/80 flex flex-col overflow-hidden z-50 animate-in fade-in slide-in-from-bottom-4 duration-200"
      data-testid="widget-chat-window"
    >
      {/* Header */}
      <div
        style={{ backgroundColor: primaryColor }}
        className="px-4 py-3.5 text-white flex items-center justify-between shadow-sm shrink-0"
      >
        <div className="flex items-center space-x-2.5">
          <div className="relative">
            <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur-xs border border-white/20 flex items-center justify-center shadow-inner">
              {theme.logoUrl ? (
                <img src={theme.logoUrl} alt="Logo" className="w-5 h-5 rounded-lg object-contain" />
              ) : (
                <Shield className="w-4 h-4 text-white" />
              )}
            </div>
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 border-2 border-white rounded-full ${
                isConnected ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'
              }`}
            />
          </div>
          <div>
            <div className="font-bold text-sm leading-tight tracking-tight">{title}</div>
            <div className="flex items-center space-x-1.5 text-[11px] text-white/85">
              <span>{isConnected ? 'Online & AI Assistant' : 'Connecting...'}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-1">
          {onReset && (
            <button
              type="button"
              onClick={onReset}
              className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              title="Start New Conversation"
              aria-label="Start new conversation"
              data-testid="widget-reset-button"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => {
              if (messages.length > 2 && !hasRated) {
                setIsCsatOpen(true);
              } else {
                onClose();
              }
            }}
            className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close chat"
            data-testid="widget-close-button"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Mode toggle bar */}
      <div className="flex border-b border-slate-100 bg-slate-50/80 text-xs font-medium text-slate-500 shrink-0">
        <button
          type="button"
          onClick={() => setActiveTab('chat')}
          className={`flex-1 py-2 text-center transition-colors cursor-pointer ${
            activeTab === 'chat'
              ? 'bg-white font-semibold text-slate-900 border-b-2'
              : 'hover:text-slate-800'
          }`}
          style={activeTab === 'chat' ? { borderColor: primaryColor } : {}}
          data-testid="tab-chat"
        >
          Live Chat
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('offline')}
          className={`flex-1 py-2 text-center transition-colors cursor-pointer ${
            activeTab === 'offline'
              ? 'bg-white font-semibold text-slate-900 border-b-2'
              : 'hover:text-slate-800'
          }`}
          style={activeTab === 'offline' ? { borderColor: primaryColor } : {}}
          data-testid="tab-offline"
        >
          Leave Message
        </button>
      </div>

      {/* Body */}
      {activeTab === 'offline' ? (
        <div className="flex-1 overflow-y-auto">
          <OfflineForm tenantId={tenantId} gatewayUrl={gatewayUrl} primaryColor={primaryColor} />
        </div>
      ) : (
        <>
          {/* Messages list */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3" data-testid="widget-messages-list">
            {/* Greeting */}
            <div className="flex items-start space-x-2 text-xs">
              <div className="w-7 h-7 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 mt-0.5 border border-indigo-100">
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-slate-100 text-slate-800 p-3 rounded-2xl rounded-tl-sm max-w-[82%] leading-relaxed shadow-xs">
                {greeting}
              </div>
            </div>

            {/* Quick Topic Shortcut Pills (from Stitch Widget Design) */}
            <div className="flex flex-wrap gap-1.5 pl-9">
              {['Billing Question', 'API Setup', 'Speak to Agent'].map((topic) => (
                <button
                  key={topic}
                  type="button"
                  onClick={() => onSendMessage(topic)}
                  className="text-[11px] font-medium bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 px-3 py-1 rounded-full border border-slate-200/80 transition-all cursor-pointer shadow-2xs"
                >
                  {topic}
                </button>
              ))}
            </div>

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex items-start space-x-2 text-xs ${
                  msg.senderType === 'CUSTOMER' ? 'flex-row-reverse space-x-reverse' : ''
                }`}
                data-testid={`widget-message-${msg.id}`}
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 shadow-2xs ${
                    msg.senderType === 'CUSTOMER'
                      ? 'bg-slate-200 text-slate-700'
                      : msg.senderType === 'AI'
                        ? 'bg-purple-100 text-purple-700 border border-purple-200'
                        : 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                  }`}
                >
                  {msg.senderType === 'CUSTOMER' ? (
                    <User className="w-3.5 h-3.5" />
                  ) : msg.senderType === 'AI' ? (
                    <Sparkles className="w-3.5 h-3.5" />
                  ) : (
                    <Shield className="w-3.5 h-3.5" />
                  )}
                </div>

                <div
                  className={`p-3 rounded-2xl max-w-[82%] leading-relaxed shadow-xs ${
                    msg.senderType === 'CUSTOMER'
                      ? 'bg-indigo-600 text-white rounded-tr-sm'
                      : msg.senderType === 'AI'
                        ? 'bg-purple-50/90 border border-purple-200 text-slate-800 rounded-tl-sm'
                        : 'bg-slate-100 text-slate-800 rounded-tl-sm'
                  }`}
                >
                  <div>{msg.body}</div>

                  {/* Citations chips */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="mt-2 pt-1.5 border-t border-purple-200/50 flex flex-wrap gap-1">
                      {msg.citations.map((c) => (
                        <span
                          key={c.chunkId || (c as any).chunk_id || c.title}
                          className="inline-flex items-center space-x-1 bg-white/90 text-purple-900 text-[10px] px-2 py-0.5 rounded-full border border-purple-200 font-medium"
                        >
                          <BookOpen className="w-2.5 h-2.5 text-purple-600" />
                          <span>{c.title}</span>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Attachment chips */}
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="mt-2 pt-1.5 border-t border-slate-200/50 flex flex-wrap gap-1">
                      {msg.attachments.map((a) => (
                        <span
                          key={a.key}
                          className="inline-flex items-center space-x-1 bg-white/90 text-slate-800 text-[10px] px-2 py-0.5 rounded-full border border-slate-200 font-medium"
                        >
                          <Paperclip className="w-2.5 h-2.5 text-slate-500" />
                          <span className="truncate max-w-[120px]">{a.name}</span>
                        </span>
                      ))}
                    </div>
                  )}

                  <div
                    className={`text-[9px] mt-1 text-right font-mono ${
                      msg.senderType === 'CUSTOMER' ? 'text-indigo-200' : 'text-slate-400'
                    }`}
                  >
                    {msg.pending ? 'Sending...' : `#${msg.seq}`}
                  </div>
                </div>
              </div>
            ))}

            {isTyping && (
              <div
                className="flex items-center space-x-2 text-xs text-slate-400 italic"
                data-testid="widget-typing-indicator"
              >
                <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200">
                  <Bot className="w-3.5 h-3.5 text-slate-400" />
                </div>
                <span>Support is typing...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Composer */}
          <div className="border-t border-slate-100 bg-white shrink-0">
            <form onSubmit={handleSend} className="p-3 flex items-center space-x-2">
              <input
                type="text"
                value={inputText}
                onChange={handleInputChange}
                placeholder="Ask a question or type a message..."
                className="flex-1 text-xs px-4 py-2.5 border border-slate-300 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-2xs"
                data-testid="widget-composer-input"
              />
              <button
                type="submit"
                disabled={!inputText.trim()}
                style={{ backgroundColor: primaryColor }}
                className="w-9 h-9 rounded-full text-white flex items-center justify-center cursor-pointer disabled:opacity-40 transition-opacity shrink-0 shadow-xs active:scale-95"
                data-testid="widget-send-button"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
            <div className="pb-2 text-center text-[10px] text-slate-400 font-medium">
              Powered by <span className="font-semibold text-slate-700">SupportPilot</span> AI
            </div>
          </div>
        </>
      )}

      <CsatSurveyModal
        isOpen={isCsatOpen}
        onClose={() => {
          setIsCsatOpen(false);
          onClose();
        }}
        onSubmitRating={(_rating) => {
          setHasRated(true);
        }}
      />
    </div>
  );
}
