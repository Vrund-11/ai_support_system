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
  ExternalLink,
} from 'lucide-react';

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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Hero Banner */}
      <div className="text-center py-10 px-4 bg-gradient-to-r from-indigo-900 to-slate-900 rounded-2xl text-white shadow-md mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight">SupportPilot Help Center</h1>
        <p className="mt-2 text-indigo-200 text-sm max-w-xl mx-auto">
          Search our knowledge base for guides, API specifications, and troubleshooting
          documentation.
        </p>
        <div className="mt-6 max-w-xl mx-auto relative">
          <Search className="w-5 h-5 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search articles, guides, API parameters..."
            className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-white text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 shadow-sm"
          />
        </div>
      </div>

      {/* System Status Indicators */}
      <div className="mb-8 p-4 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-2">
          <CheckCircle className="w-5 h-5 text-emerald-500" />
          <span className="font-semibold text-slate-800 text-sm">All Core Systems Operational</span>
        </div>
        <div className="flex flex-wrap gap-4 text-xs font-medium text-slate-600">
          <span className="flex items-center space-x-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Web App</span>
          </span>
          <span className="flex items-center space-x-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>API Gateway</span>
          </span>
          <span className="flex items-center space-x-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Real-Time Socket.IO</span>
          </span>
          <span className="flex items-center space-x-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>AI Copilot & RAG</span>
          </span>
          <span className="flex items-center space-x-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>S3 Storage (MinIO)</span>
          </span>
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex flex-wrap gap-2 mb-6">
        {[
          { id: 'all', label: 'All Articles', icon: BookOpen },
          { id: 'getting-started', label: 'Getting Started', icon: LifeBuoy },
          { id: 'billing', label: 'Billing & Plans', icon: CreditCard },
          { id: 'api', label: 'API & Webhooks', icon: Code2 },
          { id: 'troubleshooting', label: 'Troubleshooting', icon: AlertCircle },
        ].map((cat) => {
          const Icon = cat.icon;
          return (
            <button
              key={cat.id}
              onClick={() => {
                setSelectedCategory(cat.id);
                setSelectedArticle(null);
              }}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                selectedCategory === cat.id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Article Detail Modal / View */}
      {selectedArticle ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-8">
          <button
            onClick={() => setSelectedArticle(null)}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 mb-4 inline-block"
          >
            ← Back to all articles
          </button>
          <div className="border-b border-slate-200 pb-4 mb-4">
            <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-indigo-50 text-indigo-700 uppercase">
              {selectedArticle.category.replace('-', ' ')}
            </span>
            <h2 className="text-xl font-bold text-slate-900 mt-2">{selectedArticle.title}</h2>
          </div>
          <div className="prose prose-sm max-w-none text-slate-700 whitespace-pre-line leading-relaxed mb-6 font-sans">
            {selectedArticle.content}
          </div>

          <div className="border-t border-slate-100 pt-4 flex items-center justify-between">
            <span className="text-xs text-slate-500">Was this article helpful?</span>
            <div className="flex space-x-2">
              <button
                onClick={() =>
                  setFeedback((prev) => ({ ...prev, [selectedArticle.id]: 'helpful' }))
                }
                className={`p-1.5 rounded-md text-xs inline-flex items-center space-x-1 transition-colors ${
                  feedback[selectedArticle.id] === 'helpful'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <ThumbsUp className="w-3.5 h-3.5" />
                <span>Yes</span>
              </button>
              <button
                onClick={() =>
                  setFeedback((prev) => ({ ...prev, [selectedArticle.id]: 'not-helpful' }))
                }
                className={`p-1.5 rounded-md text-xs inline-flex items-center space-x-1 transition-colors ${
                  feedback[selectedArticle.id] === 'not-helpful'
                    ? 'bg-red-100 text-red-800'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <ThumbsDown className="w-3.5 h-3.5" />
                <span>No</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Articles Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.length === 0 ? (
            <div className="col-span-full py-12 text-center text-slate-400 text-sm">
              No matching articles found for "{searchQuery}".
            </div>
          ) : (
            filtered.map((art) => (
              <div
                key={art.id}
                onClick={() => setSelectedArticle(art)}
                className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 uppercase font-mono">
                    {art.category.replace('-', ' ')}
                  </span>
                  <h3 className="font-semibold text-slate-900 text-sm mt-2 line-clamp-2">
                    {art.title}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-3 leading-relaxed">
                    {art.excerpt}
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-indigo-600 font-medium">
                  <span>Read full guide</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
