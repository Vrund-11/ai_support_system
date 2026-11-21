import { useState } from 'react';
import { PublicTicketTracker } from './PublicTicketTracker';

interface HelpArticle {
  id: string;
  category: 'getting-started' | 'billing' | 'api' | 'troubleshooting';
  title: string;
  excerpt: string;
  content: string;
  readTime: string;
}

const ARTICLES: HelpArticle[] = [
  {
    id: 'art-1',
    category: 'getting-started',
    title: 'Getting Started with SupportPilot Live Chat',
    excerpt:
      'Learn how to embed the SupportPilot chat widget on your web application in under 2 minutes.',
    readTime: '4 min read',
    content: `SupportPilot includes an embeddable chat widget script that connects your visitors to real-time AI deflection and seamless human agent escalation.

### Quick Embed
Include the script before the closing \`</body>\` tag:
\`\`\`html
<script src="https://support.pilot.io/widget/embed.js" data-tenant="your-tenant-id"></script>
\`\`\`
The widget initializes automatically with your brand colors and business hours.`,
  },
  {
    id: 'art-2',
    category: 'getting-started',
    title: 'Understanding SLA Breach Warnings & Business Hours',
    excerpt:
      'How SupportPilot calculates First Response and Resolution deadlines excluding nights and weekends.',
    readTime: '6 min read',
    content: `SupportPilot computes SLAs strictly within configured business hours:
- **Low**: 8h first response, 24h resolution
- **Medium**: 4h first response, 12h resolution
- **High**: 1h first response, 4h resolution
- **Urgent**: 15m first response, 1h resolution

BullMQ workers schedule 75% early warnings and 100% breach notifications. Once a ticket is marked RESOLVED or CLOSED, active SLA timers automatically terminate.`,
  },
  {
    id: 'art-3',
    category: 'billing',
    title: 'Subscription Tiers & Ticket Quotas',
    excerpt:
      'Details on Starter, Growth, and Enterprise plans, seat licenses, and AI token limits.',
    readTime: '5 min read',
    content: `Each tenant account includes:
- **Starter**: 3 agent seats, 500 tickets/month, standard RAG deflection.
- **Growth**: 10 agent seats, 5,000 tickets/month, custom SLA timers and webhook integrations.
- **Enterprise**: Unlimited seats, dedicated pgvector index, custom LLM fine-tuning, 99.99% uptime SLA.`,
  },
  {
    id: 'art-4',
    category: 'api',
    title: 'Authenticating with Tenant API Keys & Webhooks',
    excerpt:
      'How to sign requests with SHA-256 API keys and verify incoming HMAC-SHA256 webhook signatures.',
    readTime: '7 min read',
    content: `### API Key Authentication
Pass your scoped API key in the \`Authorization\` or \`X-API-Key\` header:
\`\`\`bash
curl -H "X-API-Key: sp_live_..." https://api.supportpilot.io/api/v1/tickets
\`\`\`

### Webhook Verification
Every outgoing webhook includes:
\`\`\`
x-supportpilot-signature: sha256=<hmac_sha256_hex>
x-supportpilot-timestamp: <unix_seconds>
\`\`\`
Verify using your secret generated in Settings -> Webhooks.`,
  },
  {
    id: 'art-5',
    category: 'troubleshooting',
    title: 'Troubleshooting Real-Time WebSocket Connections',
    excerpt: 'Resolve Socket.IO connection drops, sequence replay, and firewall proxy issues.',
    readTime: '5 min read',
    content: `SupportPilot uses Socket.IO with WebSocket transport and HTTP long-polling fallback.
If your connection drops:
1. SupportPilot automatically reconnects using exponential backoff.
2. The server replays any missed messages using Redis \`seq:{convId}\` tracking.
3. Ensure outbound WebSocket traffic is permitted on ports 80/443.`,
  },
];

export function HelpCenterView() {
  const [mode, setMode] = useState<'articles' | 'tracker'>('articles');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedArticle, setSelectedArticle] = useState<HelpArticle | null>(null);
  const [feedback, setFeedback] = useState<Record<string, 'helpful' | 'not-helpful'>>({});

  const filtered = ARTICLES.filter((art) => {
    if (selectedCategory !== 'all' && art.category !== selectedCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return art.title.toLowerCase().includes(q) || art.content.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-space-lg">
      {/* Hero Banner Section with Stitch Gradient & Search */}
      <div className="relative overflow-hidden rounded-2xl bg-neutral text-on-primary p-8 sm:p-12 shadow-sm border border-border">
        <div className="relative max-w-3xl mx-auto text-center space-y-4">
          {/* Operational Status Pill */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-ticket-open-bg text-ticket-open-text font-body-sm text-body-sm font-medium border border-ticket-open-text/20 shadow-xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-ticket-open-text opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-ticket-open-text" />
            </span>
            <span>All systems operational • 99.98% SLA</span>
          </div>

          <h1 className="font-display-hero text-display-hero font-bold tracking-tight text-on-primary">
            SupportPilot Help Center
          </h1>
          <p className="font-body-lg text-body-lg text-surface-subtle max-w-2xl mx-auto leading-relaxed">
            Search our knowledge base for guides, API specifications, and troubleshooting
            documentation.
          </p>

          {/* Search Box */}
          <div className="mt-6 max-w-2xl mx-auto relative group">
            <div className="relative flex items-center bg-surface rounded-xl shadow-md border border-border">
              <span className="material-symbols-outlined ml-4 text-text-secondary text-[20px] shrink-0">
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search articles, documentation, guides, API parameters..."
                className="w-full py-3.5 px-3 bg-transparent text-text-primary placeholder:text-text-secondary font-body-md text-body-md focus:outline-none"
              />
              <div className="flex items-center gap-1.5 pr-4">
                <span className="hidden sm:inline-block px-2 py-0.5 rounded bg-surface-subtle text-text-secondary font-code-mono text-[11px] font-semibold border border-border shadow-xs">
                  ⌘K
                </span>
              </div>
            </div>

            {/* Popular Search Suggestions */}
            <div className="flex flex-wrap items-center justify-center gap-1.5 mt-3 font-body-sm text-body-sm text-text-secondary">
              <span className="font-medium text-surface-subtle">Popular:</span>
              {[
                'SLA Breach Warnings',
                'Webhook verification',
                'Live Chat widget',
                'Subscription tiers',
              ].map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => setSearchQuery(term.split(' ')[0] || '')}
                  className="px-2.5 py-0.5 rounded-full bg-white/10 hover:bg-white/20 text-surface font-body-sm text-[11px] transition-colors cursor-pointer"
                >
                  {term}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* System Status Indicators & Live Telemetry Strip */}
      <div className="bg-surface rounded-xl border border-border shadow-xs p-space-md flex flex-col md:flex-row md:items-center justify-between gap-space-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-ticket-open-bg text-ticket-open-text flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[24px]">verified</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-headline-sm text-headline-sm font-bold text-text-primary">
                All Core Systems Operational
              </span>
              <span className="px-2 py-0.5 rounded-full font-code-mono text-[10px] font-semibold bg-ticket-open-bg text-ticket-open-text border border-ticket-open-text/20">
                24ms latency
              </span>
            </div>
            <p className="font-body-sm text-body-sm text-text-secondary">
              Live operational telemetry across global edge points
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 font-body-sm text-body-sm font-medium text-text-secondary pt-2 md:pt-0 border-t md:border-t-0 border-border">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-ticket-open-text" />
            <span>Web App</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-ticket-open-text" />
            <span>API Gateway</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-ticket-open-text" />
            <span>Real-Time Socket.IO</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-ticket-open-text" />
            <span>AI Copilot &amp; RAG</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-ticket-open-text" />
            <span>S3 Storage (MinIO)</span>
          </span>
        </div>
      </div>

      {/* Mode / Category Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: 'all', label: 'All Articles', icon: 'auto_stories' },
            { id: 'getting-started', label: 'Getting Started', icon: 'rocket_launch' },
            { id: 'billing', label: 'Billing & Plans', icon: 'credit_card' },
            { id: 'api', label: 'API & Webhooks', icon: 'hub' },
            { id: 'troubleshooting', label: 'Troubleshooting', icon: 'build' },
          ].map((cat) => {
            const isActive = mode === 'articles' && selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => {
                  setMode('articles');
                  setSelectedCategory(cat.id);
                  setSelectedArticle(null);
                }}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl font-body-sm text-body-sm font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-primary text-on-primary shadow-xs'
                    : 'bg-surface text-text-secondary border border-border hover:bg-surface-subtle hover:text-text-primary'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                  {cat.icon}
                </span>
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => {
            setMode(mode === 'tracker' ? 'articles' : 'tracker');
            setSelectedArticle(null);
          }}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-headline-sm text-headline-sm font-semibold transition-all cursor-pointer ${
            mode === 'tracker'
              ? 'bg-primary text-on-primary shadow-xs'
              : 'bg-surface text-primary border border-border hover:bg-primary-fixed'
          }`}
          data-testid="toggle-ticket-tracker"
        >
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
            confirmation_number
          </span>
          <span>{mode === 'tracker' ? 'Browse Knowledge Base' : 'Track Ticket Status'}</span>
        </button>
      </div>

      {mode === 'tracker' ? (
        <PublicTicketTracker onBack={() => setMode('articles')} />
      ) : selectedArticle ? (
        <div className="bg-surface rounded-xl border border-border shadow-xs p-space-lg space-y-space-md">
          <button
            onClick={() => setSelectedArticle(null)}
            className="font-headline-sm text-headline-sm font-semibold text-primary hover:text-primary-container inline-flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <span>← Back to all articles</span>
          </button>

          <div className="border-b border-border pb-5">
            <span className="px-2.5 py-0.5 rounded-full font-code-mono text-[11px] font-semibold bg-primary-fixed text-primary uppercase tracking-wider border border-primary/20">
              {selectedArticle.category.replace('-', ' ')}
            </span>
            <h2 className="font-headline-lg text-headline-lg font-bold text-text-primary mt-2.5 tracking-tight">
              {selectedArticle.title}
            </h2>
          </div>

          <div className="prose prose-sm max-w-none text-text-primary whitespace-pre-line leading-relaxed font-body-md text-body-md">
            {selectedArticle.content}
          </div>

          <div className="border-t border-border pt-5 flex items-center justify-between">
            <span className="font-body-sm text-body-sm font-medium text-text-secondary">
              Was this article helpful?
            </span>
            <div className="flex gap-2">
              <button
                onClick={() =>
                  setFeedback((prev) => ({ ...prev, [selectedArticle.id]: 'helpful' }))
                }
                className={`px-3 py-1.5 rounded-lg font-body-sm text-body-sm font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                  feedback[selectedArticle.id] === 'helpful'
                    ? 'bg-ticket-open-bg text-ticket-open-text border border-ticket-open-text/20'
                    : 'text-text-primary bg-surface-subtle hover:bg-surface-container border border-border'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                  thumb_up
                </span>
                <span>Yes</span>
              </button>
              <button
                onClick={() =>
                  setFeedback((prev) => ({ ...prev, [selectedArticle.id]: 'not-helpful' }))
                }
                className={`px-3 py-1.5 rounded-lg font-body-sm text-body-sm font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                  feedback[selectedArticle.id] === 'not-helpful'
                    ? 'bg-error-container text-on-error-container border border-error/20'
                    : 'text-text-primary bg-surface-subtle hover:bg-surface-container border border-border'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                  thumb_down
                </span>
                <span>No</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Bento Grid Articles Listing */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-space-md">
          {filtered.length === 0 ? (
            <div className="col-span-full py-16 text-center text-text-secondary bg-surface rounded-xl border border-border">
              <span className="material-symbols-outlined text-[36px] text-text-secondary mb-2">
                search
              </span>
              <p className="font-headline-sm text-headline-sm font-medium text-text-primary">
                No matching articles found
              </p>
              <p className="font-body-sm text-body-sm text-text-secondary mt-1">
                No matching articles found for "{searchQuery}". Try different keywords.
              </p>
            </div>
          ) : (
            filtered.map((art) => (
              <div
                key={art.id}
                onClick={() => setSelectedArticle(art)}
                className="bg-surface rounded-xl border border-border p-space-lg shadow-xs hover:shadow-md hover:border-primary/40 transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="px-2 py-0.5 rounded-full font-code-mono text-[10px] font-semibold bg-surface-subtle text-text-secondary uppercase tracking-wider border border-border">
                      {art.category.replace('-', ' ')}
                    </span>
                    <span className="font-code-mono text-[11px] text-text-secondary">
                      {art.readTime}
                    </span>
                  </div>
                  <h3 className="font-headline-sm text-headline-sm font-bold text-text-primary group-hover:text-primary transition-colors line-clamp-2">
                    {art.title}
                  </h3>
                  <p className="font-body-sm text-body-sm text-text-secondary mt-2 line-clamp-3 leading-relaxed">
                    {art.excerpt}
                  </p>
                </div>

                <div className="mt-5 pt-4 border-t border-border flex items-center justify-between font-headline-sm text-headline-sm text-primary font-semibold group-hover:translate-x-0.5 transition-transform">
                  <span>Read full guide</span>
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Secondary Support Banner */}
      <div className="rounded-xl bg-neutral text-on-primary p-space-lg flex flex-col md:flex-row items-center justify-between gap-space-md shadow-xs border border-border">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary-fixed text-primary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[26px]">support</span>
          </div>
          <div>
            <h3 className="font-headline-sm text-headline-sm font-bold text-on-primary">
              Can't find what you're looking for?
            </h3>
            <p className="font-body-sm text-body-sm text-surface-subtle mt-0.5">
              Our enterprise support engineers and automated copilot are available 24/7.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            type="button"
            onClick={() => {
              setMode('tracker');
              setSelectedArticle(null);
            }}
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-primary hover:bg-primary-container text-on-primary font-headline-sm text-headline-sm font-semibold shadow-xs transition-all cursor-pointer"
          >
            Track a Ticket
          </button>
        </div>
      </div>
    </div>
  );
}
