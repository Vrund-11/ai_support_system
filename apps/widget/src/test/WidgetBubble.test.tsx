import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WidgetBubble } from '../components/WidgetBubble';

describe('WidgetBubble', () => {
  it('renders closed bubble launcher with unread badge', () => {
    const onToggle = vi.fn();
    render(
      <WidgetBubble isOpen={false} onToggle={onToggle} primaryColor="#2563eb" unreadCount={3} />,
    );

    const button = screen.getByTestId('widget-bubble-button');
    expect(button).toBeInTheDocument();
    expect(button).toHaveStyle({ backgroundColor: '#2563eb' });

    const badge = screen.getByTestId('unread-badge');
    expect(badge).toHaveTextContent('3');

    fireEvent.click(button);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('renders close icon when widget is open', () => {
    render(<WidgetBubble isOpen={true} onToggle={vi.fn()} />);

    const button = screen.getByTestId('widget-bubble-button');
    expect(button).toHaveAttribute('aria-label', 'Close support chat');
    expect(screen.queryByTestId('unread-badge')).not.toBeInTheDocument();
  });
});
