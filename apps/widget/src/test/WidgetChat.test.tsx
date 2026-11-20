import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WidgetChat } from '../components/WidgetChat';
import type { WidgetMessage } from '../types';

describe('WidgetChat', () => {
  const mockMessages: WidgetMessage[] = [
    {
      id: 'msg_1',
      seq: 1,
      body: 'Can I reset my API key?',
      senderType: 'CUSTOMER',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'msg_2',
      seq: 2,
      body: 'Yes, navigate to Settings > API Keys and click Generate New.',
      senderType: 'AI',
      createdAt: new Date().toISOString(),
      citations: [
        {
          chunkId: 'chunk_1',
          docId: 'doc_api_guide',
          title: 'API Authentication Guide',
        },
      ],
    },
  ];

  it('renders chat window with title, messages, and citation chips', () => {
    render(
      <WidgetChat
        messages={mockMessages}
        isConnected={true}
        isTyping={false}
        onSendMessage={vi.fn()}
        onNotifyTyping={vi.fn()}
        onClose={vi.fn()}
        theme={{ title: 'Acme Support Desk', primaryColor: '#059669' }}
        tenantId="tenant_123"
      />,
    );

    expect(screen.getByTestId('widget-chat-window')).toBeInTheDocument();
    expect(screen.getByText('Acme Support Desk')).toBeInTheDocument();
    expect(screen.getByText('Can I reset my API key?')).toBeInTheDocument();
    expect(
      screen.getByText('Yes, navigate to Settings > API Keys and click Generate New.'),
    ).toBeInTheDocument();
    expect(screen.getByText('API Authentication Guide')).toBeInTheDocument();
  });

  it('renders typing indicator when isTyping is true', () => {
    render(
      <WidgetChat
        messages={[]}
        isConnected={true}
        isTyping={true}
        onSendMessage={vi.fn()}
        onNotifyTyping={vi.fn()}
        onClose={vi.fn()}
        tenantId="tenant_123"
      />,
    );

    expect(screen.getByTestId('widget-typing-indicator')).toBeInTheDocument();
    expect(screen.getByText('Support is typing...')).toBeInTheDocument();
  });

  it('submits typed message and notifies typing on input change', () => {
    const onSendMessage = vi.fn();
    const onNotifyTyping = vi.fn();

    render(
      <WidgetChat
        messages={[]}
        isConnected={true}
        isTyping={false}
        onSendMessage={onSendMessage}
        onNotifyTyping={onNotifyTyping}
        onClose={vi.fn()}
        tenantId="tenant_123"
      />,
    );

    const input = screen.getByTestId('widget-composer-input');
    fireEvent.change(input, { target: { value: 'How do I add team members?' } });

    expect(onNotifyTyping).toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('widget-send-button'));

    expect(onSendMessage).toHaveBeenCalledWith('How do I add team members?');
    expect(input).toHaveValue('');
  });

  it('switches between Live Chat and Offline tabs', () => {
    render(
      <WidgetChat
        messages={[]}
        isConnected={true}
        isTyping={false}
        onSendMessage={vi.fn()}
        onNotifyTyping={vi.fn()}
        onClose={vi.fn()}
        tenantId="tenant_123"
      />,
    );

    expect(screen.getByTestId('widget-messages-list')).toBeInTheDocument();

    // Click offline tab
    fireEvent.click(screen.getByTestId('tab-offline'));

    expect(screen.getByTestId('offline-form')).toBeInTheDocument();
    expect(screen.queryByTestId('widget-messages-list')).not.toBeInTheDocument();
  });
});
