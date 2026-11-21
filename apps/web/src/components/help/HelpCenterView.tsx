import { useState } from 'react';
import {
  Search,
  BookOpen,
  LifeBuoy,
  CreditCard,
  Code2,
  AlertCircle,
  CheckCircle,
  ThumbsUp,
  ThumbsDown,
  ArrowRight,
  Ticket,
} from 'lucide-react';
import { PublicTicketTracker } from './PublicTicketTracker';

interface HelpArticle {
  id: string;
  category: 'getting-started' | 'billing' | 'api' | 'troubleshooting';
  title: string;
  excerpt: string;
  content: string;
}

const ARTICLES: HelpArticle[] = [
  {
    id: 'art-1',
    category: 'getting-started',
    title: 'Getting Started with SupportPilot Live Chat',
    excerpt:
      'Learn how to embed the SupportPilot chat widget on your web application in under 2 minutes.',
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Hero Banner Section with Architectural Glow */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-8 sm:p-12 shadow-xl border border-indigo-950/40">
        <div className="absolute -top-24 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative max-w-3xl mx-auto text-center space-y-4">
          {/* Operational Status Pill */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-medium shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span>All systems operational • 99.98% SLA</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            SupportPilot Help Center
          </h1>
          <p className="text-slate-300 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
            Search our knowledge base for guides, API specifications, and troubleshooting
            documentation.
          </p>

          {/* Search Box */}
          <div className="mt-6 max-w-2xl mx-auto relative group">
            <div className="relative flex items-center bg-white rounded-2xl shadow-lg border border-slate-200">
              <Search className="w-5 h-5 ml-4 text-slate-400 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search articles, documentation, guides, API parameters..."
                className="w-full py-3.5 px-3 bg-transparent text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none"
              />
              <div className="flex items-center gap-1.5 pr-4">
                <span className="hidden sm:inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-500 font-mono text-[11px] font-semibold border border-slate-200">
                  ⌘K
                </span>
              </div>
            </div>

            {/* Popular Search Suggestions */}
            <div className="flex flex-wrap items-center justify-center gap-1.5 mt-3 text-xs text-slate-400">
              <span className="font-medium text-slate-300">Popular:</span>
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
                  className="px-2.5 py-0.5 rounded-full bg-white/10 hover:bg-white/20 text-slate-200 text-[11px] transition-colors"
                >
                  {term}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* System Status Indicators & Live Telemetry Strip */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 dark:text-zinc-100 text-sm">
                All Core Systems Operational
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                24ms latency
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Live operational telemetry across global edge points
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-medium text-slate-600 dark:text-zinc-400 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-zinc-800">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Web App</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>API Gateway</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Real-Time Socket.IO</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>AI Copilot &amp; RAG</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>S3 Storage (MinIO)</span>
          </span>
        </div>
      </div>

      {/* Mode / Category Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: 'all', label: 'All Articles', icon: BookOpen },
            { id: 'getting-started', label: 'Getting Started', icon: LifeBuoy },
            { id: 'billing', label: 'Billing & Plans', icon: CreditCard },
            { id: 'api', label: 'API & Webhooks', icon: Code2 },
            { id: 'troubleshooting', label: 'Troubleshooting', icon: AlertCircle },
          ].map((cat) => {
            const Icon = cat.icon;
            const isActive = mode === 'articles' && selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => {
                  setMode('articles');
                  setSelectedCategory(cat.id);
                  setSelectedArticle(null);
                }}
                className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
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
          className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            mode === 'tracker'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800'
          }`}
          data-testid="toggle-ticket-tracker"
        >
          <Ticket className="w-3.5 h-3.5 text-indigo-500" />
          <span>{mode === 'tracker' ? 'Browse Knowledge Base' : 'Track Ticket Status'}</span>
        </button>
      </div>

      {mode === 'tracker' ? (
        <PublicTicketTracker onBack={() => setMode('articles')} />
      ) : selectedArticle ? (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-6 sm:p-8 space-y-6 transition-colors">
          <button
            onClick={() => setSelectedArticle(null)}
            className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <span>← Back to all articles</span>
          </button>

          <div className="border-b border-slate-100 dark:border-zinc-800 pb-5">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 uppercase tracking-wider font-mono border border-indigo-100 dark:border-indigo-900/40">
              {selectedArticle.category.replace('-', ' ')}
            </span>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-zinc-100 mt-2.5 tracking-tight">
              {selectedArticle.title}
            </h2>
          </div>

          <div className="prose prose-sm max-w-none text-slate-700 dark:text-zinc-300 whitespace-pre-line leading-relaxed font-sans">
            {selectedArticle.content}
          </div>

          <div className="border-t border-slate-100 dark:border-zinc-800 pt-5 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-600 dark:text-zinc-400">
              Was this article helpful?
            </span>
            <div className="flex space-x-2">
              <button
                onClick={() =>
                  setFeedback((prev) => ({ ...prev, [selectedArticle.id]: 'helpful' }))
                }
                className={`px-3 py-1.5 rounded-lg text-xs font-medium inline-flex items-center space-x-1.5 transition-colors cursor-pointer ${
                  feedback[selectedArticle.id] === 'helpful'
                    ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                    : 'text-slate-700 dark:text-zinc-300 bg-slate-50 dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700 border border-slate-200 dark:border-zinc-700'
                }`}
              >
                <ThumbsUp className="w-3.5 h-3.5" />
                <span>Yes</span>
              </button>
              <button
                onClick={() =>
                  setFeedback((prev) => ({ ...prev, [selectedArticle.id]: 'not-helpful' }))
                }
                className={`px-3 py-1.5 rounded-lg text-xs font-medium inline-flex items-center space-x-1.5 transition-colors cursor-pointer ${
                  feedback[selectedArticle.id] === 'not-helpful'
                    ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                    : 'text-slate-700 dark:text-zinc-300 bg-slate-50 dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700 border border-slate-200 dark:border-zinc-700'
                }`}
              >
                <ThumbsDown className="w-3.5 h-3.5" />
                <span>No</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Bento Grid Articles Listing */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.length === 0 ? (
            <div className="col-span-full py-16 text-center text-slate-400 dark:text-zinc-500 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 transition-colors">
              <Search className="w-8 h-8 mx-auto text-slate-300 dark:text-zinc-600 mb-2" />
              <p className="text-sm font-medium text-slate-600 dark:text-zinc-300">
                No matching articles found
              </p>
              <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1">
                No matching articles found for "{searchQuery}". Try different keywords.
              </p>
            </div>
          ) : (
            filtered.map((art) => (
              <div
                key={art.id}
                onClick={() => setSelectedArticle(art)}
                className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-6 shadow-sm hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-800 transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 uppercase font-mono tracking-wider border border-slate-200/60 dark:border-zinc-700/60">
                      {art.category.replace('-', ' ')}
                    </span>
                    <span className="text-[11px] text-slate-400 dark:text-zinc-500 font-mono">
                      Guide
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-900 dark:text-zinc-100 text-base group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-2">
                    {art.title}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-2 line-clamp-3 leading-relaxed">
                    {art.excerpt}
                  </p>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between text-xs text-indigo-600 dark:text-indigo-400 font-semibold group-hover:translate-x-0.5 transition-transform">
                  <span>Read full guide</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Secondary Support Banner */}
      <div className="rounded-2xl bg-slate-900 dark:bg-zinc-900 text-white p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-md border border-slate-800 dark:border-zinc-800 transition-colors">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
            <LifeBuoy className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Can't find what you're looking for?</h3>
            <p className="text-xs text-slate-300 dark:text-zinc-400 mt-0.5">
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
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
          >
            Track a Ticket
          </button>
          <button
            type="button"
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            Community Forums
          </button>
        </div>
      </div>
    </div>
  );
}
