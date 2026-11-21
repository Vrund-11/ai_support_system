import { useState } from 'react';
import type { WidgetConfig } from './types';
import { useWidgetSocket } from './useWidgetSocket';
import { WidgetBubble } from './components/WidgetBubble';
import { WidgetChat } from './components/WidgetChat';

export function WidgetApp({
  tenantId,
  gatewayUrl = 'http://localhost:4000',
  theme = {},
  isOffline = false,
}: WidgetConfig) {
  const [isOpen, setIsOpen] = useState(false);

  // Generate or read stable visitor conversationId
  const [conversationId, setConversationId] = useState<string>(() => {
    let conv = localStorage.getItem(`supportpilot_conv_${tenantId}`);
    if (!conv) {
      conv = 'conv_' + Math.random().toString(36).substring(2, 12);
      localStorage.setItem(`supportpilot_conv_${tenantId}`, conv);
    }
    return conv;
  });

  const handleResetConversation = () => {
    localStorage.removeItem(`supportpilot_conv_${tenantId}`);
    const nextConv = 'conv_' + Math.random().toString(36).substring(2, 12);
    localStorage.setItem(`supportpilot_conv_${tenantId}`, nextConv);
    setConversationId(nextConv);
  };

  const { messages, isConnected, isTyping, sendMessage, notifyTyping } = useWidgetSocket({
    tenantId,
    gatewayUrl,
    conversationId,
  });

  return (
    <div className="supportpilot-widget-container font-sans">
      <WidgetBubble
        isOpen={isOpen}
        onToggle={() => setIsOpen((prev) => !prev)}
        primaryColor={theme.primaryColor}
        unreadCount={isOpen ? 0 : messages.length > 0 ? 1 : 0}
      />

      {isOpen && (
        <WidgetChat
          messages={messages}
          isConnected={isConnected}
          isTyping={isTyping}
          onSendMessage={sendMessage}
          onNotifyTyping={notifyTyping}
          onClose={() => setIsOpen(false)}
          onReset={handleResetConversation}
          theme={theme}
          tenantId={tenantId}
          gatewayUrl={gatewayUrl}
          isOffline={isOffline}
        />
      )}
    </div>
  );
}
