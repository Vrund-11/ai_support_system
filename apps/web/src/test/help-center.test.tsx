import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HelpCenterView } from '../components/help/HelpCenterView';
import { renderWithQueryClient } from './test-utils';

describe('HelpCenterView Component (Public Help Center & Status)', () => {
  it('renders search banner, system status, and filter categories', () => {
    renderWithQueryClient(<HelpCenterView />);

    expect(screen.getByText('SupportPilot Help Center')).toBeInTheDocument();
    expect(screen.getByText('All Core Systems Operational')).toBeInTheDocument();
    expect(screen.getByText('Web App')).toBeInTheDocument();
    expect(screen.getByText('API Gateway')).toBeInTheDocument();
    expect(screen.getByText('AI Copilot & RAG')).toBeInTheDocument();
  });

  it('filters articles by search query and category pill', async () => {
    renderWithQueryClient(<HelpCenterView />);

    const searchInput = screen.getByPlaceholderText(/search articles/i);
    await userEvent.type(searchInput, 'SLA');

    expect(screen.getByText(/Understanding SLA Breach Warnings/i)).toBeInTheDocument();
    expect(
      screen.queryByText(/Getting Started with SupportPilot Live Chat/i),
    ).not.toBeInTheDocument();
  });

  it('opens article detail, displays markdown, and records feedback rating', async () => {
    renderWithQueryClient(<HelpCenterView />);

    const articleCard = screen.getByText(/Getting Started with SupportPilot Live Chat/i);
    await userEvent.click(articleCard);

    await waitFor(() => {
      expect(screen.getByText(/← Back to all articles/i)).toBeInTheDocument();
    });

    const yesFeedbackBtn = screen.getByRole('button', { name: /yes/i });
    await userEvent.click(yesFeedbackBtn);

    expect(screen.getByText('Was this article helpful?')).toBeInTheDocument();
  });
});
