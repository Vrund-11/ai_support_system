import { useState } from 'react';
import { Send, CheckCircle2, Loader2, Mail } from 'lucide-react';

interface OfflineFormProps {
  tenantId: string;
  gatewayUrl?: string;
  onSuccess?: (ticketNumber: number) => void;
  primaryColor?: string;
}

export function OfflineForm({
  tenantId,
  gatewayUrl = '',
  onSuccess,
  primaryColor = '#4f46e5',
}: OfflineFormProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedTicket, setSubmittedTicket] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const url = `${gatewayUrl}/api/v1/tickets/public`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          name,
          email,
          subject: subject || 'Offline message from website',
          description: `From: ${name} <${email}>\n\n${message}`,
          priority: 'MEDIUM',
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to submit message. Please try again.');
      }

      const body = (await res.json()) as { data?: { number: number } };
      const ticketNum = body.data?.number ?? 1001;
      setSubmittedTicket(ticketNum);
      onSuccess?.(ticketNum);
    } catch (err) {
      setError((err as Error).message || 'Failed to submit message. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submittedTicket !== null) {
    return (
      <div className="p-6 text-center space-y-3" data-testid="offline-success-view">
        <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <h3 className="font-bold text-slate-800 text-sm">Message Received!</h3>
        <p className="text-xs text-slate-500 leading-relaxed">
          Thanks for reaching out! Ticket{' '}
          <span className="font-mono font-bold text-slate-700">#{submittedTicket}</span> has been
          created. Our support team will reply to your email as soon as possible.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 space-y-3" data-testid="offline-form">
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 flex items-center space-x-2 text-xs text-slate-600">
        <Mail className="w-4 h-4 text-slate-400 shrink-0" />
        <span>We are currently offline. Leave a message and we will email you back!</span>
      </div>

      {error && <div className="text-xs text-rose-600">{error}</div>}

      <div>
        <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
          Your Name *
        </label>
        <input
          type="text"
          name="customerName"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Jane Doe"
          className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
          data-testid="offline-name-input"
        />
      </div>

      <div>
        <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
          Email Address *
        </label>
        <input
          type="email"
          name="customerEmail"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="jane@example.com"
          className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
          data-testid="offline-email-input"
        />
      </div>

      <div>
        <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
          Subject
        </label>
        <input
          type="text"
          name="subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="How can we help?"
          className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
          data-testid="offline-subject-input"
        />
      </div>

      <div>
        <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
          Message *
        </label>
        <textarea
          name="message"
          required
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type your message here..."
          className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
          data-testid="offline-message-input"
        />
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        style={{ backgroundColor: primaryColor }}
        className="w-full py-2 px-3 text-xs font-semibold text-white rounded-md flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
        data-testid="offline-submit-button"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Submitting...</span>
          </>
        ) : (
          <>
            <Send className="w-3.5 h-3.5" />
            <span>Send Message</span>
          </>
        )}
      </button>
    </form>
  );
}
