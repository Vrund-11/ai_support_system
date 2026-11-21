import { useState } from 'react';
import {
  CreditCard,
  Lock,
  Loader2,
  CheckCircle2,
  ShieldAlert,
  X,
  ExternalLink,
  Check,
  Webhook,
} from 'lucide-react';
import { api, type SimulateChargeResponse } from '../../lib/api';

export interface StripeCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (result: { chargeId: string; plan: 'PRO' }) => void;
  tenantId?: string;
}

export function StripeCheckoutModal({
  isOpen,
  onClose,
  onSuccess,
  tenantId = 'tenant_production_01',
}: StripeCheckoutModalProps) {
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [cardholderName, setCardholderName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<SimulateChargeResponse | null>(null);

  if (!isOpen) return null;

  const formatCardNumber = (val: string) => {
    const digitsOnly = val.replace(/\D/g, '').slice(0, 16);
    const parts = digitsOnly.match(/.{1,4}/g);
    return parts ? parts.join(' ') : digitsOnly;
  };

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCardNumber(formatCardNumber(e.target.value));
    setError(null);
  };

  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/[^\d]/g, '').slice(0, 4);
    if (val.length >= 3) {
      val = `${val.slice(0, 2)}/${val.slice(2)}`;
    }
    setExpiry(val);
    setError(null);
  };

  const handleCvcChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 4);
    setCvc(val);
    setError(null);
  };

  const handleFillTestCard = () => {
    setCardNumber('4242 4242 4242 4242');
    setExpiry('12/28');
    setCvc('123');
    setCardholderName('Alex Morgan');
    setError(null);
  };

  const handleFillDeclineCard = () => {
    setCardNumber('4000 0000 0000 0002');
    setExpiry('12/28');
    setCvc('000');
    setCardholderName('Jane Doe');
    setError(null);
  };

  const handleInstantUpgrade = async () => {
    setIsProcessing(true);
    setError(null);
    try {
      const res = await api.billing.createCheckout('PRO');
      onSuccess({ chargeId: res.sessionId || `cs_${Date.now()}`, plan: 'PRO' });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Checkout creation failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNumber = cardNumber.replace(/\s+/g, '');
    if (!cleanNumber || cleanNumber.length < 15) {
      setError('Please enter a valid 16-digit card number.');
      return;
    }

    const [expMonth, expYear] = expiry.includes('/')
      ? expiry.split('/')
      : [expiry.slice(0, 2), expiry.slice(2)];

    if (!expMonth || !expYear) {
      setError('Please enter expiration in MM/YY format.');
      return;
    }

    if (!cvc || cvc.length < 3) {
      setError('Please enter a 3 or 4 digit CVC security code.');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const res = await api.billing.simulateCharge({
        cardNumber: cleanNumber,
        expMonth,
        expYear,
        cvc,
        plan: 'PRO',
      });
      setSuccessResult(res);
    } catch (err: any) {
      setError(err?.detail || err?.message || 'Your card was declined. Please try another card.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSimulateWebhook = async () => {
    setIsProcessing(true);
    setError(null);
    try {
      await api.billing.simulateWebhook(tenantId, 'PRO');
      onSuccess({ chargeId: `wh_${Date.now()}`, plan: 'PRO' });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Webhook simulation failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReturnToWorkspace = () => {
    if (successResult) {
      onSuccess({ chargeId: successResult.chargeId, plan: 'PRO' });
    }
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="stripe-checkout-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-200"
    >
      <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-slate-200/80 dark:border-zinc-800 max-w-3xl w-full overflow-hidden flex flex-col md:flex-row transition-colors">
        {/* Left Column: Order Summary */}
        <div className="md:w-5/12 bg-slate-50 dark:bg-zinc-950/70 p-6 md:p-8 flex flex-col justify-between border-b md:border-b-0 md:border-r border-slate-200/80 dark:border-zinc-800 space-y-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-indigo-600 dark:bg-indigo-500 text-white flex items-center justify-center font-black text-sm shadow-xs">
                SP
              </div>
              <span className="font-bold text-slate-800 dark:text-zinc-200 text-sm tracking-tight">
                SupportPilot
              </span>
            </div>

            <div>
              <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
                Subscribe to SupportPilot Pro
              </span>
              <h2
                id="stripe-checkout-title"
                className="text-2xl font-extrabold text-slate-900 dark:text-zinc-100 tracking-tight mt-0.5"
              >
                $49.00
                <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">
                  {' '}
                  / month
                </span>
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1">
                SupportPilot Pro Subscription ($49.00 billed monthly)
              </p>
            </div>

            <div className="pt-3 border-t border-slate-200/70 dark:border-zinc-800 space-y-2.5">
              <span className="text-[11px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
                Included in Pro
              </span>
              <ul className="space-y-2 text-xs text-slate-700 dark:text-zinc-300">
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <span>10,000 Messages/day</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <span>1,000 AI Copilot Queries/day</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <span>100MB Knowledge Base</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <span>15-minute Urgent SLA</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200/70 dark:border-zinc-800">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-900/60">
              <CreditCard className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Powered by Stripe Emulation</span>
            </div>
          </div>
        </div>

        {/* Right Column: Payment Form or Success Confirmation */}
        <div className="md:w-7/12 p-6 md:p-8 flex flex-col justify-between relative bg-white dark:bg-zinc-900">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          {successResult ? (
            <div className="py-4 text-center space-y-6 animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div className="space-y-1">
                <h3 className="text-xl font-bold text-slate-900 dark:text-zinc-100">
                  Payment Approved by Stripe (Test Mode)
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Your Pro workspace quotas and priority SLA are now active.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200/80 dark:border-zinc-700 text-left space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-zinc-400 font-medium">Charge ID</span>
                  <span className="font-mono font-semibold text-slate-800 dark:text-zinc-200">
                    {successResult.chargeId}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-zinc-400 font-medium">
                    Amount Billed
                  </span>
                  <span className="font-bold text-slate-900 dark:text-zinc-100">$49.00 USD</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-zinc-400 font-medium">
                    Next Billing Date
                  </span>
                  <span className="font-medium text-slate-800 dark:text-zinc-200">
                    {successResult.nextBillingDate}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-zinc-700">
                  <span className="text-slate-500 dark:text-zinc-400 font-medium">Receipt</span>
                  <a
                    href={successResult.receiptUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-600 dark:text-indigo-400 hover:underline font-semibold flex items-center gap-1"
                  >
                    <span>View Stripe Receipt</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              <button
                type="button"
                onClick={handleReturnToWorkspace}
                className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Return to Workspace
              </button>
            </div>
          ) : (
            <form onSubmit={handlePay} className="space-y-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100">
                  Pay with Card
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  Enter payment details to begin your monthly subscription.
                </p>
              </div>

              {/* Helper Quick-Fill Test Buttons */}
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-zinc-800/40 border border-slate-200/70 dark:border-zinc-700 space-y-2">
                <span className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block">
                  Simulated Stripe Test Cards
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleFillTestCard}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white dark:bg-zinc-800 text-indigo-700 dark:text-indigo-300 border border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-700 transition-colors cursor-pointer shadow-2xs"
                  >
                    Use 4242 Test Card
                  </button>
                  <button
                    type="button"
                    onClick={handleFillDeclineCard}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white dark:bg-zinc-800 text-rose-700 dark:text-rose-300 border border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-700 transition-colors cursor-pointer shadow-2xs"
                  >
                    Test Decline Card
                  </button>
                  <button
                    type="button"
                    onClick={handleInstantUpgrade}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-700 transition-colors cursor-pointer shadow-2xs inline-flex items-center gap-1"
                  >
                    <CreditCard className="w-3 h-3 text-slate-400" />
                    <span>Instant Test Upgrade (Simulated Stripe)</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSimulateWebhook}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-700 transition-colors cursor-pointer shadow-2xs inline-flex items-center gap-1"
                  >
                    <Webhook className="w-3 h-3 text-slate-400" />
                    <span>Simulate Webhook Payment</span>
                  </button>
                </div>
              </div>

              {/* Decline / Error Banner */}
              {error && (
                <div
                  role="alert"
                  className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2.5 animate-in fade-in"
                >
                  <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                  <span>{error}</span>
                </div>
              )}

              {/* Card Inputs */}
              <div className="space-y-3 text-xs">
                <div>
                  <label
                    htmlFor="stripe-cardholder-name"
                    className="block font-medium text-slate-700 dark:text-zinc-300 mb-1"
                  >
                    Name on card
                  </label>
                  <input
                    id="stripe-cardholder-name"
                    type="text"
                    value={cardholderName}
                    onChange={(e) => setCardholderName(e.target.value)}
                    placeholder="Jane Doe"
                    className="w-full px-3 py-2 bg-white dark:bg-zinc-800/80 border border-slate-300 dark:border-zinc-700 rounded-xl text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-xs transition-colors"
                  />
                </div>

                <div>
                  <label
                    htmlFor="stripe-card-number"
                    className="block font-medium text-slate-700 dark:text-zinc-300 mb-1"
                  >
                    Card number
                  </label>
                  <div className="relative">
                    <input
                      id="stripe-card-number"
                      type="text"
                      inputMode="numeric"
                      value={cardNumber}
                      onChange={handleCardNumberChange}
                      placeholder="1234 1234 1234 1234"
                      maxLength={19}
                      className="w-full pl-9 pr-3 py-2 bg-white dark:bg-zinc-800/80 border border-slate-300 dark:border-zinc-700 rounded-xl font-mono text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-xs tracking-wider transition-colors"
                    />
                    <CreditCard className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="stripe-card-expiry"
                      className="block font-medium text-slate-700 dark:text-zinc-300 mb-1"
                    >
                      Expiration
                    </label>
                    <input
                      id="stripe-card-expiry"
                      type="text"
                      inputMode="numeric"
                      value={expiry}
                      onChange={handleExpiryChange}
                      placeholder="MM / YY"
                      maxLength={5}
                      className="w-full px-3 py-2 bg-white dark:bg-zinc-800/80 border border-slate-300 dark:border-zinc-700 rounded-xl font-mono text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-xs tracking-wider transition-colors"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="stripe-card-cvc"
                      className="block font-medium text-slate-700 dark:text-zinc-300 mb-1"
                    >
                      CVC
                    </label>
                    <div className="relative">
                      <input
                        id="stripe-card-cvc"
                        type="text"
                        inputMode="numeric"
                        value={cvc}
                        onChange={handleCvcChange}
                        placeholder="CVC"
                        maxLength={4}
                        className="w-full pl-8 pr-3 py-2 bg-white dark:bg-zinc-800/80 border border-slate-300 dark:border-zinc-700 rounded-xl font-mono text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-xs tracking-wider transition-colors"
                      />
                      <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Pay Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Processing Payment...</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-3.5 h-3.5" />
                      <span>Pay $49.00</span>
                    </>
                  )}
                </button>
              </div>

              <div className="text-center">
                <p className="text-[10px] text-slate-400 dark:text-zinc-500">
                  Secured by end-to-end TLS 1.3 256-bit AES encryption.
                </p>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
