import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { OfflineForm } from '../components/OfflineForm';

describe('OfflineForm', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders all required offline form fields', () => {
    render(<OfflineForm tenantId="tenant_123" />);

    expect(screen.getByTestId('offline-form')).toBeInTheDocument();
    expect(screen.getByTestId('offline-name-input')).toBeInTheDocument();
    expect(screen.getByTestId('offline-email-input')).toBeInTheDocument();
    expect(screen.getByTestId('offline-subject-input')).toBeInTheDocument();
    expect(screen.getByTestId('offline-message-input')).toBeInTheDocument();
    expect(screen.getByTestId('offline-submit-button')).toBeInTheDocument();
  });

  it('submits offline message and displays confirmation with ticket number', async () => {
    const onSuccess = vi.fn();

    // Mock fetch for ticket creation endpoint
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: { number: 4092 },
      }),
    } as Response);

    render(
      <OfflineForm
        tenantId="tenant_123"
        gatewayUrl="http://localhost:4000"
        onSuccess={onSuccess}
      />,
    );

    fireEvent.change(screen.getByTestId('offline-name-input'), {
      target: { value: 'Alice Visitor' },
    });
    fireEvent.change(screen.getByTestId('offline-email-input'), {
      target: { value: 'alice@client.com' },
    });
    fireEvent.change(screen.getByTestId('offline-subject-input'), {
      target: { value: 'Billing query after hours' },
    });
    fireEvent.change(screen.getByTestId('offline-message-input'), {
      target: { value: 'Need an invoice copy for accounting.' },
    });

    fireEvent.click(screen.getByTestId('offline-submit-button'));

    await waitFor(() => {
      expect(screen.getByTestId('offline-success-view')).toBeInTheDocument();
    });

    expect(screen.getByText('#4092')).toBeInTheDocument();
    expect(onSuccess).toHaveBeenCalledWith(4092);
  });
});
