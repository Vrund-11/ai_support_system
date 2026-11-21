import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StripeCheckoutModal } from '../components/settings/StripeCheckoutModal';
import { SettingsView } from '../components/settings/SettingsView';
import { api, ApiError } from '../lib/api';
import { renderWithQueryClient } from './test-utils';
import { useAuthStore } from '../store/auth.store';

describe('StripeCheckoutModal & Billing Simulation (STRIPE-FRONTEND)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useAuthStore.setState({
      user: {
        id: 'user-owner-001',
        tenantId: 'tenant-acme-111',
        email: 'owner@acme.com',
        name: 'Acme Owner',
        role: 'OWNER',
      },
      isAuthenticated: true,
      accessToken: 'test-token',
    });
  });

  describe('api.billing.simulateCharge client', () => {
    it('successfully processes valid charge payload with chargeId and next billing date', async () => {
      const result = await api.billing.simulateCharge({
        cardNumber: '4242 4242 4242 4242',
        expMonth: '12',
        expYear: '28',
        cvc: '123',
        plan: 'PRO',
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.chargeId).toMatch(/^ch_/);
      expect(result.receiptUrl).toContain('stripe.com');
      expect(result.plan).toBe('PRO');
      expect(result.nextBillingDate).toBeDefined();
    });

    it('rejects with 402 Card Declined when test decline card number is used', async () => {
      await expect(
        api.billing.simulateCharge({
          cardNumber: '4000 0000 0000 0002',
          expMonth: '12',
          expYear: '28',
          cvc: '000',
        }),
      ).rejects.toThrow(ApiError);

      try {
        await api.billing.simulateCharge({
          cardNumber: '4000 0000 0000 0002',
          expMonth: '12',
          expYear: '28',
          cvc: '000',
        });
      } catch (err: any) {
        expect(err.status).toBe(402);
        expect(err.message).toBe('Your card was declined. Please try another card.');
      }
    });
  });

  describe('StripeCheckoutModal UI component', () => {
    it('renders plan summary, pro features, and powered by stripe emulation badge', () => {
      renderWithQueryClient(
        <StripeCheckoutModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} />,
      );

      expect(screen.getByText('Subscribe to SupportPilot Pro')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /\$49\.00/i })).toBeInTheDocument();
      expect(screen.getByText('10,000 Messages/day')).toBeInTheDocument();
      expect(screen.getByText('1,000 AI Copilot Queries/day')).toBeInTheDocument();
      expect(screen.getByText('100MB Knowledge Base')).toBeInTheDocument();
      expect(screen.getByText('15-minute Urgent SLA')).toBeInTheDocument();
      expect(screen.getByText('Powered by Stripe Emulation')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /pay \$49\.00/i })).toBeInTheDocument();
    });

    it('auto-spaces card number every 4 digits up to 19 characters', async () => {
      renderWithQueryClient(
        <StripeCheckoutModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} />,
      );

      const cardInput = screen.getByPlaceholderText('1234 1234 1234 1234');
      await userEvent.type(cardInput, '4242424242424242');

      expect(cardInput).toHaveValue('4242 4242 4242 4242');
    });

    it('quick-fills 4242 test card when clicking helper button', async () => {
      renderWithQueryClient(
        <StripeCheckoutModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} />,
      );

      const fillBtn = screen.getByRole('button', { name: /use 4242 test card/i });
      await userEvent.click(fillBtn);

      const cardInput = screen.getByPlaceholderText('1234 1234 1234 1234');
      const expiryInput = screen.getByPlaceholderText('MM / YY');
      const cvcInput = screen.getByPlaceholderText('CVC');

      expect(cardInput).toHaveValue('4242 4242 4242 4242');
      expect(expiryInput).toHaveValue('12/28');
      expect(cvcInput).toHaveValue('123');
    });

    it('quick-fills test decline card and shows error banner on payment submission', async () => {
      const onSuccessSpy = vi.fn();
      renderWithQueryClient(
        <StripeCheckoutModal isOpen={true} onClose={vi.fn()} onSuccess={onSuccessSpy} />,
      );

      const declineBtn = screen.getByRole('button', { name: /test decline card/i });
      await userEvent.click(declineBtn);

      const cardInput = screen.getByPlaceholderText('1234 1234 1234 1234');
      expect(cardInput).toHaveValue('4000 0000 0000 0002');

      const payBtn = screen.getByRole('button', { name: /pay \$49\.00/i });
      await userEvent.click(payBtn);

      await waitFor(() => {
        expect(
          screen.getByText('Your card was declined. Please try another card.'),
        ).toBeInTheDocument();
      });

      expect(onSuccessSpy).not.toHaveBeenCalled();
    });

    it('completes successful charge, renders green checkmark and returns to workspace', async () => {
      const onSuccessSpy = vi.fn();
      const onCloseSpy = vi.fn();

      renderWithQueryClient(
        <StripeCheckoutModal isOpen={true} onClose={onCloseSpy} onSuccess={onSuccessSpy} />,
      );

      const fillBtn = screen.getByRole('button', { name: /use 4242 test card/i });
      await userEvent.click(fillBtn);

      const payBtn = screen.getByRole('button', { name: /pay \$49\.00/i });
      await userEvent.click(payBtn);

      await waitFor(() => {
        expect(screen.getByText('Payment Approved by Stripe (Test Mode)')).toBeInTheDocument();
      });

      expect(screen.getByText(/Amount Billed/i)).toBeInTheDocument();
      expect(screen.getByText('$49.00 USD')).toBeInTheDocument();
      expect(screen.getByText(/Next Billing Date/i)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /view stripe receipt/i })).toBeInTheDocument();

      const returnBtn = screen.getByRole('button', { name: /return to workspace/i });
      await userEvent.click(returnBtn);

      expect(onSuccessSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          plan: 'PRO',
          chargeId: expect.stringMatching(/^ch_/),
        }),
      );
      expect(onCloseSpy).toHaveBeenCalled();
    });

    it('does not render when isOpen is false', () => {
      renderWithQueryClient(
        <StripeCheckoutModal isOpen={false} onClose={vi.fn()} onSuccess={vi.fn()} />,
      );

      expect(screen.queryByText('Subscribe to SupportPilot Pro')).not.toBeInTheDocument();
    });
  });

  describe('SettingsView integration with Stripe Checkout', () => {
    it('opens StripeCheckoutModal on Upgrade to PRO and refreshes subscription on payment completion', async () => {
      vi.spyOn(api.apiKeys, 'list').mockResolvedValueOnce([]);
      vi.spyOn(api.billing, 'getSubscription').mockResolvedValue({
        plan: 'FREE',
        limits: { messages: 500, ai: 50, kb: 10 * 1024 * 1024 },
        usage: { messages: 12, ai: 4, kb: 1.2 * 1024 * 1024 },
      });

      renderWithQueryClient(<SettingsView />);

      const billingTab = screen.getByRole('button', { name: /billing & plans/i });
      await userEvent.click(billingTab);

      await waitFor(() => {
        expect(screen.getByText('SupportPilot FREE')).toBeInTheDocument();
      });

      const upgradeBtn = screen.getByRole('button', { name: /upgrade to pro/i });
      await userEvent.click(upgradeBtn);

      expect(screen.getByText('Subscribe to SupportPilot Pro')).toBeInTheDocument();

      // Click 4242 quick fill
      const testCardBtn = screen.getByRole('button', { name: /use 4242 test card/i });
      await userEvent.click(testCardBtn);

      // Click Pay
      const payBtn = screen.getByRole('button', { name: /pay \$49\.00/i });
      await userEvent.click(payBtn);

      await waitFor(() => {
        expect(screen.getByText('Payment Approved by Stripe (Test Mode)')).toBeInTheDocument();
      });

      const returnBtn = screen.getByRole('button', { name: /return to workspace/i });
      await userEvent.click(returnBtn);

      await waitFor(() => {
        expect(screen.getByText('Active Pro Subscription')).toBeInTheDocument();
      });
    });
  });
});
