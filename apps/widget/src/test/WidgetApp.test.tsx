import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WidgetApp } from '../WidgetApp';

// Mock socket.io-client to avoid actual network calls in unit tests
vi.mock('socket.io-client', () => ({
  io: () => ({
    on: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
  }),
}));

describe('WidgetApp', () => {
  it('renders closed bubble initially, opens chat window on click', () => {
    render(
      <WidgetApp
        tenantId="tenant_test_123"
        gatewayUrl="http://localhost:4000"
        theme={{ title: 'Help Center', primaryColor: '#2563eb' }}
      />,
    );

    expect(screen.getByTestId('widget-bubble-button')).toBeInTheDocument();
    expect(screen.queryByTestId('widget-chat-window')).not.toBeInTheDocument();

    // Open chat
    fireEvent.click(screen.getByTestId('widget-bubble-button'));

    expect(screen.getByTestId('widget-chat-window')).toBeInTheDocument();
    expect(screen.getByText('Help Center')).toBeInTheDocument();

    // Close chat
    fireEvent.click(screen.getByTestId('widget-close-button'));
    expect(screen.queryByTestId('widget-chat-window')).not.toBeInTheDocument();
  });
});
