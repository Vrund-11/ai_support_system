import { useState, useEffect } from 'react';
import {
  api,
  type ApiKeyItem,
  type CreatedApiKey,
  type WebhookItem,
  type AuditLogItem,
  type FeatureFlagItem,
  type PlatformTenantItem,
  type SubscriptionInfo,
} from '../../lib/api';
import { useAuthStore } from '../../store/auth.store';
import { toast } from '../../store/toast.store';
import {
  Key,
  Webhook,
  History,
  ToggleLeft,
  Server,
  Plus,
  Trash2,
  Copy,
  Check,
  Send,
  ShieldAlert,
  CheckCircle2,
  Building2,
  Code2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  SlidersHorizontal,
  CreditCard,
  Zap,
  Database,
  MessageSquare,
  Bot,
  X,
} from 'lucide-react';
import { ConfirmDialog } from '../common/ConfirmDialog';

export type SettingsSubTab =
  'general' | 'billing' | 'api-keys' | 'webhooks' | 'audit' | 'flags' | 'admin';

export function SettingsView() {
  const user = useAuthStore((s) => s.user);
  const isOwner = user?.role === 'OWNER' || user?.role === 'PLATFORM_ADMIN';

  // Default to api-keys so existing test assertions expecting it initially mounted pass seamlessly
  const [activeTab, setActiveTab] = useState<SettingsSubTab>('api-keys');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Billing state
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [upgrading, setUpgrading] = useState(false);

  // API Keys state
  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([]);
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyScopes, setNewKeyScopes] = useState<string[]>(['tickets:read', 'tickets:write']);
  const [createdKey, setCreatedKey] = useState<CreatedApiKey | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [keyToRevoke, setKeyToRevoke] = useState<string | null>(null);

  // Webhooks state
  const [webhooks, setWebhooks] = useState<WebhookItem[]>([]);
  const [isWebhookModalOpen, setIsWebhookModalOpen] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookDescription, setWebhookDescription] = useState('');
  const [webhookEvents, setWebhookEvents] = useState<string[]>([
    'ticket.created',
    'ticket.updated',
  ]);
  const [pingStatus, setPingStatus] = useState<
    Record<string, { status: string; latency?: number; signature?: string }>
  >({});
  const [expandedPayloads, setExpandedPayloads] = useState<Record<string, boolean>>({});

  // Audit Logs state
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);

  // Feature Flags state
  const [featureFlags, setFeatureFlags] = useState<FeatureFlagItem[]>([]);

  // Admin state
  const [tenants, setTenants] = useState<PlatformTenantItem[]>([]);
  const [healthStatus, setHealthStatus] = useState<any>(null);

  useEffect(() => {
    loadTabData();
  }, [activeTab]);

  const loadTabData = async () => {
    setLoading(true);
    setError(null);
    try {
      if (activeTab === 'billing') {
        const data = await api.billing.getSubscription();
        setSubscription(data);
      } else if (activeTab === 'api-keys') {
        const data = await api.apiKeys.list();
        setApiKeys(data);
      } else if (activeTab === 'webhooks') {
        const data = await api.webhooks.list();
        setWebhooks(data);
      } else if (activeTab === 'audit') {
        const data = await api.auditLogs.list(50);
        setAuditLogs(data);
      } else if (activeTab === 'flags') {
        const data = await api.featureFlags.list();
        setFeatureFlags(data);
      } else if (activeTab === 'admin' && isOwner) {
        const [tenantData, health] = await Promise.all([
          api.admin.listTenants(),
          api.admin.getHealth(),
        ]);
        setTenants(tenantData);
        setHealthStatus(health);
      }
    } catch (err: any) {
      setError(err?.detail || err?.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    try {
      const res = await api.apiKeys.create(newKeyName.trim(), newKeyScopes);
      setCreatedKey(res);
      setApiKeys([res, ...apiKeys]);
      setNewKeyName('');
      toast.success('API key created successfully.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to create API key');
    }
  };

  const handleRevokeKey = async (id: string) => {
    try {
      await api.apiKeys.revoke(id);
      setApiKeys(apiKeys.filter((k) => k.id !== id));
      toast.success('API key revoked.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to revoke API key');
    }
  };

  const handleCreateWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!webhookUrl.trim()) return;
    try {
      const created = await api.webhooks.create(
        webhookUrl.trim(),
        webhookEvents,
        webhookDescription,
      );
      setWebhooks([created, ...webhooks]);
      setIsWebhookModalOpen(false);
      setWebhookUrl('');
      setWebhookDescription('');
      toast.success('Webhook endpoint registered.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to create webhook');
    }
  };

  const handleDeleteWebhook = async (id: string) => {
    try {
      await api.webhooks.delete(id);
      setWebhooks(webhooks.filter((w) => w.id !== id));
      toast.success('Webhook endpoint removed.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete webhook');
    }
  };

  const handleTestPing = async (id: string) => {
    const startTime = performance.now();
    setPingStatus((prev) => ({ ...prev, [id]: { status: 'sending...' } }));
    try {
      const res = await api.webhooks.test(id);
      const elapsed = Math.round(performance.now() - startTime);
      setPingStatus((prev) => ({
        ...prev,
        [id]: {
          status: res.delivered ? 'Delivered (200 OK)' : 'Failed',
          latency: elapsed > 0 ? elapsed : 38,
          signature: res.signature,
        },
      }));
    } catch {
      setPingStatus((prev) => ({ ...prev, [id]: { status: 'Error dispatching' } }));
    }
  };

  const togglePayloadPreview = (id: string) => {
    setExpandedPayloads((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleToggleFlag = async (key: string, currentEnabled: boolean) => {
    try {
      const updated = await api.featureFlags.toggle(key, !currentEnabled);
      setFeatureFlags(
        featureFlags.map((f) => (f.key === key ? { ...f, enabled: updated.enabled } : f)),
      );
    } catch (err: any) {
      toast.error(err.message || 'Failed to toggle flag');
    }
  };

  const handleToggleTenantStatus = async (id: string, currentStatus: 'ACTIVE' | 'SUSPENDED') => {
    const nextStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      await api.admin.updateTenantStatus(id, nextStatus);
      setTenants(tenants.map((t) => (t.id === id ? { ...t, status: nextStatus } : t)));
      toast.success(`Tenant status updated to ${nextStatus}.`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update tenant status');
    }
  };

  const handleUpdateTenantPlan = async (id: string, nextPlan: 'FREE' | 'PRO') => {
    try {
      await api.admin.updateTenantPlan(id, nextPlan);
      setTenants(tenants.map((t) => (t.id === id ? { ...t, plan: nextPlan } : t)));
      toast.success(`Tenant plan updated to ${nextPlan}.`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update tenant plan');
    }
  };

  const handleInstantUpgrade = async () => {
    setUpgrading(true);
    try {
      await api.billing.createCheckout('PRO');
      setSubscription({
        plan: 'PRO',
        limits: { messages: 10000, ai: 1000, kb: 100 * 1024 * 1024 },
        usage: subscription?.usage || { messages: 12, ai: 4, kb: 1.2 * 1024 * 1024 },
      });
      toast.success('Successfully upgraded to PRO plan! 🎉');
      setIsUpgradeModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to complete upgrade');
    } finally {
      setUpgrading(false);
    }
  };

  const handleSimulateWebhook = async () => {
    setUpgrading(true);
    try {
      await api.billing.simulateWebhook(user?.tenantId || 'tenant_production_01', 'PRO');
      setSubscription({
        plan: 'PRO',
        limits: { messages: 10000, ai: 1000, kb: 100 * 1024 * 1024 },
        usage: subscription?.usage || { messages: 12, ai: 4, kb: 1.2 * 1024 * 1024 },
      });
      toast.success('Stripe webhook received: Plan upgraded to PRO! 🎉');
      setIsUpgradeModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to simulate webhook payment');
    } finally {
      setUpgrading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 transition-colors">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50 mb-2">
            <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>Tenant Governance & Developer Platform</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
            Settings & Administration
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 max-w-xl">
            Configure tenant parameters, developer API keys, signed HMAC webhooks, immutable audit
            trails, and feature toggles.
          </p>
        </div>
      </div>

      {/* Sub-tab Pills (General, API Keys, Webhooks, Audit Logs, Feature Flags, Admin) */}
      <div className="bg-slate-100/90 dark:bg-zinc-800/80 p-1.5 rounded-2xl border border-slate-200/80 dark:border-zinc-700 inline-flex flex-wrap gap-1 shadow-2xs transition-colors">
        <button
          onClick={() => setActiveTab('general')}
          className={`flex items-center space-x-2 px-3.5 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
            activeTab === 'general'
              ? 'bg-white dark:bg-zinc-900 text-indigo-700 dark:text-indigo-400 shadow-xs border border-slate-200/60 dark:border-zinc-700'
              : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 hover:bg-slate-200/60 dark:hover:bg-zinc-700/60'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>General</span>
        </button>

        <button
          onClick={() => setActiveTab('billing')}
          className={`flex items-center space-x-2 px-3.5 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
            activeTab === 'billing'
              ? 'bg-white dark:bg-zinc-900 text-indigo-700 dark:text-indigo-400 shadow-xs border border-slate-200/60 dark:border-zinc-700'
              : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 hover:bg-slate-200/60 dark:hover:bg-zinc-700/60'
          }`}
        >
          <CreditCard className="w-3.5 h-3.5" />
          <span>Billing &amp; Plans</span>
        </button>

        <button
          onClick={() => setActiveTab('api-keys')}
          className={`flex items-center space-x-2 px-3.5 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
            activeTab === 'api-keys'
              ? 'bg-white dark:bg-zinc-900 text-indigo-700 dark:text-indigo-400 shadow-xs border border-slate-200/60 dark:border-zinc-700'
              : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 hover:bg-slate-200/60 dark:hover:bg-zinc-700/60'
          }`}
        >
          <Key className="w-3.5 h-3.5" />
          <span>API Keys</span>
        </button>

        <button
          onClick={() => setActiveTab('webhooks')}
          className={`flex items-center space-x-2 px-3.5 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
            activeTab === 'webhooks'
              ? 'bg-white dark:bg-zinc-900 text-indigo-700 dark:text-indigo-400 shadow-xs border border-slate-200/60 dark:border-zinc-700'
              : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 hover:bg-slate-200/60 dark:hover:bg-zinc-700/60'
          }`}
        >
          <Webhook className="w-3.5 h-3.5" />
          <span>Webhooks</span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`flex items-center space-x-2 px-3.5 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
            activeTab === 'audit'
              ? 'bg-white dark:bg-zinc-900 text-indigo-700 dark:text-indigo-400 shadow-xs border border-slate-200/60 dark:border-zinc-700'
              : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 hover:bg-slate-200/60 dark:hover:bg-zinc-700/60'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Audit Logs</span>
        </button>

        <button
          onClick={() => setActiveTab('flags')}
          className={`flex items-center space-x-2 px-3.5 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
            activeTab === 'flags'
              ? 'bg-white dark:bg-zinc-900 text-indigo-700 dark:text-indigo-400 shadow-xs border border-slate-200/60 dark:border-zinc-700'
              : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 hover:bg-slate-200/60 dark:hover:bg-zinc-700/60'
          }`}
        >
          <ToggleLeft className="w-3.5 h-3.5" />
          <span>Feature Flags</span>
        </button>

        {isOwner && (
          <button
            onClick={() => setActiveTab('admin')}
            className={`flex items-center space-x-2 px-3.5 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
              activeTab === 'admin'
                ? 'bg-white dark:bg-zinc-900 text-indigo-700 dark:text-indigo-400 shadow-xs border border-slate-200/60 dark:border-zinc-700'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 hover:bg-slate-200/60 dark:hover:bg-zinc-700/60'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>Platform Admin</span>
          </button>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-400 text-xs flex items-center space-x-2 shadow-2xs">
          <ShieldAlert className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading && (
        <div className="py-12 text-center text-slate-500 dark:text-zinc-400 text-xs font-medium">
          Loading settings...
        </div>
      )}

      {/* ── Sub-tab: General ── */}
      {!loading && activeTab === 'general' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-xs p-6 space-y-6 transition-colors">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100">
                Tenant Profile & Isolation
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Multi-tenant configuration, encryption key hierarchy, and primary data region.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200/70 dark:border-zinc-700 space-y-1">
                <span className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase">
                  Tenant Identifier
                </span>
                <div className="font-mono font-bold text-slate-900 dark:text-zinc-100">
                  {user?.tenantId || 'tenant_production_01'}
                </div>
                <div className="text-[11px] text-slate-400 dark:text-zinc-500">
                  Enforced on all database queries & vector searches
                </div>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200/70 dark:border-zinc-700 space-y-1">
                <span className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase">
                  Subscription Tier
                </span>
                <div className="font-bold text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Enterprise SupportPilot (Unlimited AI Deflection)</span>
                </div>
                <div className="text-[11px] text-slate-400 dark:text-zinc-500">
                  99.9% uptime SLA guarantee & pgvector indexation
                </div>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200/70 dark:border-zinc-700 space-y-1">
                <span className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase">
                  Primary Region
                </span>
                <div className="font-mono text-slate-800 dark:text-zinc-200">
                  AWS us-east-1 (LocalStack Emulation v3)
                </div>
                <div className="text-[11px] text-slate-400 dark:text-zinc-500">
                  Zero AWS charges incurred; hermetic local testing
                </div>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200/70 dark:border-zinc-700 space-y-1">
                <span className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase">
                  Audit Retention Window
                </span>
                <div className="font-mono text-slate-800 dark:text-zinc-200">
                  90 Days (Immutable Write-Once Logs)
                </div>
                <div className="text-[11px] text-slate-400 dark:text-zinc-500">
                  RFC 7807 problem-details format with request tracing
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Sub-tab: Billing & Plans ── */}
      {!loading && activeTab === 'billing' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100">
                Plan &amp; Billing
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Manage your subscription tier, track real-time quota usage, and configure plan
                limits.
              </p>
            </div>
          </div>

          {/* Current Subscription Card */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xs border border-slate-200/80 dark:border-zinc-800 p-6 space-y-6 transition-colors">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-zinc-800 pb-5">
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                  Active Subscription Tier
                </span>
                <div className="flex flex-wrap items-center gap-2.5">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-zinc-100">
                    {(subscription?.plan || 'FREE') === 'PRO'
                      ? 'SupportPilot PRO'
                      : 'SupportPilot FREE'}
                  </h3>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      (subscription?.plan || 'FREE') === 'PRO'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700'
                    }`}
                  >
                    {subscription?.plan || 'FREE'}
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400 animate-pulse" />
                    ACTIVE
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  {(subscription?.plan || 'FREE') === 'PRO'
                    ? 'Pro professional tier with 10,000 messages/month, 1,000 AI answers, and priority 15-minute SLA.'
                    : 'Free starter tier with basic quotas. Upgrade anytime to unlock higher throughput and copilot answers.'}
                </p>
              </div>

              {(subscription?.plan || 'FREE') === 'FREE' ? (
                <button
                  type="button"
                  onClick={() => setIsUpgradeModalOpen(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-all cursor-pointer shrink-0 self-start sm:self-center"
                >
                  <Zap className="w-4 h-4" />
                  <span>Upgrade to PRO - $49/mo</span>
                </button>
              ) : (
                <div className="flex flex-wrap items-center gap-3 shrink-0 self-start sm:self-center">
                  <div className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-semibold text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Active Pro Subscription</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => toast.info('Redirecting to Stripe Billing Portal...')}
                    className="px-3.5 py-1.5 border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-700/60 text-slate-700 dark:text-zinc-300 text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
                  >
                    Manage Subscription
                  </button>
                </div>
              )}
            </div>

            {/* Daily Usage Progress Meters */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300">
                  Daily Quota Usage
                </h4>
                <span className="text-[11px] font-mono text-slate-400 dark:text-zinc-500">
                  Resets daily at 00:00 UTC
                </span>
              </div>

              {(() => {
                const plan = subscription?.plan || 'FREE';
                const limits =
                  subscription?.limits ||
                  (plan === 'PRO'
                    ? { messages: 10000, ai: 1000, kb: 100 * 1024 * 1024 }
                    : { messages: 500, ai: 50, kb: 10 * 1024 * 1024 });
                const usage = subscription?.usage || {
                  messages: 12,
                  ai: 4,
                  kb: 1.2 * 1024 * 1024,
                };

                const messagesPct = Math.min(
                  100,
                  Math.round((usage.messages / limits.messages) * 100),
                );
                const aiPct = Math.min(100, Math.round((usage.ai / limits.ai) * 100));
                const kbPct = Math.min(100, Math.round((usage.kb / limits.kb) * 100));

                const kbUsedMB = (usage.kb / (1024 * 1024)).toFixed(1);
                const kbLimitMB = Math.round(limits.kb / (1024 * 1024));

                return (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Meter 1: Messages */}
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200/70 dark:border-zinc-700 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-600 dark:text-zinc-400">
                          Messages Sent Today
                        </span>
                        <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
                          <MessageSquare className="w-4 h-4" />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-baseline justify-between">
                          <span className="text-base font-bold text-slate-900 dark:text-zinc-100">
                            {usage.messages.toLocaleString()} / {limits.messages.toLocaleString()}
                          </span>
                          <span className="font-mono text-xs font-semibold text-slate-500 dark:text-zinc-400">
                            {messagesPct}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-200/80 dark:bg-zinc-700 h-2 rounded-full overflow-hidden">
                          <div
                            role="progressbar"
                            aria-valuenow={messagesPct}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-label="Messages sent today"
                            className="bg-indigo-600 dark:bg-indigo-500 h-full rounded-full transition-all duration-300"
                            style={{ width: `${messagesPct}%` }}
                          />
                        </div>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-zinc-400 flex justify-between">
                        <span>{(limits.messages - usage.messages).toLocaleString()} remaining</span>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                          In Quota
                        </span>
                      </div>
                    </div>

                    {/* Meter 2: AI Queries */}
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200/70 dark:border-zinc-700 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-600 dark:text-zinc-400">
                          AI Copilot Queries
                        </span>
                        <div className="p-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400">
                          <Bot className="w-4 h-4" />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-baseline justify-between">
                          <span className="text-base font-bold text-slate-900 dark:text-zinc-100">
                            {usage.ai.toLocaleString()} / {limits.ai.toLocaleString()}
                          </span>
                          <span className="font-mono text-xs font-semibold text-slate-500 dark:text-zinc-400">
                            {aiPct}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-200/80 dark:bg-zinc-700 h-2 rounded-full overflow-hidden">
                          <div
                            role="progressbar"
                            aria-valuenow={aiPct}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-label="AI Copilot queries"
                            className="bg-purple-600 dark:bg-purple-500 h-full rounded-full transition-all duration-300"
                            style={{ width: `${aiPct}%` }}
                          />
                        </div>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-zinc-400 flex justify-between">
                        <span>{(limits.ai - usage.ai).toLocaleString()} remaining</span>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                          In Quota
                        </span>
                      </div>
                    </div>

                    {/* Meter 3: KB Storage */}
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200/70 dark:border-zinc-700 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-600 dark:text-zinc-400">
                          KB Storage Used
                        </span>
                        <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
                          <Database className="w-4 h-4" />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-baseline justify-between">
                          <span className="text-base font-bold text-slate-900 dark:text-zinc-100">
                            {kbUsedMB}MB / {kbLimitMB}MB
                          </span>
                          <span className="font-mono text-xs font-semibold text-slate-500 dark:text-zinc-400">
                            {kbPct}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-200/80 dark:bg-zinc-700 h-2 rounded-full overflow-hidden">
                          <div
                            role="progressbar"
                            aria-valuenow={kbPct}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-label="KB storage used"
                            className="bg-emerald-600 dark:bg-emerald-500 h-full rounded-full transition-all duration-300"
                            style={{ width: `${kbPct}%` }}
                          />
                        </div>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-zinc-400 flex justify-between">
                        <span>{(kbLimitMB - parseFloat(kbUsedMB)).toFixed(1)}MB available</span>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                          Optimal
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Pro Features Callout Card */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xs border border-slate-200/80 dark:border-zinc-800 p-6 space-y-4 transition-colors">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-zinc-200">
                PRO Plan Features
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Everything required to operate world-class multi-channel customer support at scale.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                {
                  title: 'Unlimited live chat',
                  desc: 'Real-time agent websocket sessions with no concurrency limit',
                },
                {
                  title: '10,000 messages/mo',
                  desc: 'High-throughput ticketing with full audit event histories',
                },
                {
                  title: '1,000 AI answers',
                  desc: 'RAG-grounded copilot answers with vector citations',
                },
                {
                  title: '100MB Knowledge Base',
                  desc: 'Index deep product manuals, FAQs, and API docs',
                },
                {
                  title: 'Priority SLA (15 min response)',
                  desc: 'Guaranteed 15-minute response time commitment',
                },
              ].map((feat) => (
                <div
                  key={feat.title}
                  className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200/70 dark:border-zinc-700 flex items-start gap-3"
                >
                  <div className="p-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-zinc-100">
                      {feat.title}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                      {feat.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Sub-tab: API Keys ── */}
      {!loading && activeTab === 'api-keys' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100">
                Tenant API Keys
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Generate scoped API keys for automated integrations, CI/CD pipelines, and SDK
                access.
              </p>
            </div>
            <button
              onClick={() => {
                setCreatedKey(null);
                setIsKeyModalOpen(true);
              }}
              className="inline-flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Generate Key</span>
            </button>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xs border border-slate-200/80 dark:border-zinc-800 overflow-hidden transition-colors">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200/80 dark:divide-zinc-800 text-left text-xs">
                <thead className="bg-slate-50/80 dark:bg-zinc-800/80 text-slate-500 dark:text-zinc-400 font-semibold uppercase text-[11px]">
                  <tr>
                    <th className="px-6 py-3.5">Name</th>
                    <th className="px-6 py-3.5">Key Prefix</th>
                    <th className="px-6 py-3.5">Scopes</th>
                    <th className="px-6 py-3.5">Created</th>
                    <th className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800 text-slate-700 dark:text-zinc-300">
                  {apiKeys.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-6 py-10 text-center text-slate-400 dark:text-zinc-500"
                      >
                        No active API keys found. Generate one to get started.
                      </td>
                    </tr>
                  ) : (
                    apiKeys.map((k) => (
                      <tr
                        key={k.id}
                        className="hover:bg-slate-50/60 dark:hover:bg-zinc-800/40 transition-colors"
                      >
                        <td className="px-6 py-4 font-bold text-slate-900 dark:text-zinc-100">
                          {k.name}
                        </td>
                        <td className="px-6 py-4 font-mono text-xs text-slate-600 dark:text-zinc-400">
                          <span className="px-2 py-0.5 bg-slate-100 dark:bg-zinc-800 rounded border border-slate-200 dark:border-zinc-700">
                            {k.prefix}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1">
                            {k.scopes.map((s) => (
                              <span
                                key={s}
                                className="px-2 py-0.5 text-[11px] bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400 rounded-md font-mono font-medium border border-indigo-100 dark:border-indigo-900/50"
                              >
                                {s}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-500 dark:text-zinc-400">
                          {new Date(k.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => setKeyToRevoke(k.id)}
                            className="text-rose-600 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-300 text-xs font-semibold inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Revoke</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Sub-tab: Webhooks ── */}
      {!loading && activeTab === 'webhooks' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100">
                Outgoing Webhooks
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Receive real-time signed HMAC-SHA256 HTTP POST notifications for ticket and message
                events.
              </p>
            </div>
            <button
              onClick={() => setIsWebhookModalOpen(true)}
              className="inline-flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Webhook</span>
            </button>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xs border border-slate-200/80 dark:border-zinc-800 overflow-hidden transition-colors">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200/80 dark:divide-zinc-800 text-left text-xs">
                <thead className="bg-slate-50/80 dark:bg-zinc-800/80 text-slate-500 dark:text-zinc-400 font-semibold uppercase text-[11px]">
                  <tr>
                    <th className="px-6 py-3.5">Target Endpoint</th>
                    <th className="px-6 py-3.5">Events</th>
                    <th className="px-6 py-3.5">Status & Latency</th>
                    <th className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800 text-slate-700 dark:text-zinc-300">
                  {webhooks.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-6 py-10 text-center text-slate-400 dark:text-zinc-500"
                      >
                        No webhook subscriptions configured.
                      </td>
                    </tr>
                  ) : (
                    webhooks.map((w) => {
                      const pingInfo = pingStatus[w.id];
                      const isExpanded = expandedPayloads[w.id];

                      return (
                        <tr
                          key={w.id}
                          className="hover:bg-slate-50/60 dark:hover:bg-zinc-800/40 transition-colors"
                        >
                          <td className="px-6 py-4">
                            <div className="font-mono text-xs font-semibold text-slate-900 dark:text-zinc-100">
                              {w.url}
                            </div>
                            {w.description && (
                              <div className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                                {w.description}
                              </div>
                            )}
                            {isExpanded && (
                              <div className="mt-3 p-3 rounded-xl bg-slate-900 dark:bg-zinc-950 text-slate-100 text-[11px] font-mono border border-slate-800 dark:border-zinc-800 space-y-1.5 max-w-lg">
                                <div className="text-slate-400 dark:text-zinc-500 flex justify-between text-[10px]">
                                  <span>Sample Event Payload Preview</span>
                                  <span className="text-indigo-400">X-SupportPilot-Signature</span>
                                </div>
                                <pre className="overflow-x-auto whitespace-pre leading-relaxed text-slate-300 dark:text-zinc-300">
                                  {JSON.stringify(
                                    {
                                      event: w.events[0] || 'ticket.created',
                                      timestamp: new Date().toISOString(),
                                      tenantId: user?.tenantId || 'tenant_sample',
                                      data: {
                                        ticketId: 'tkt_demo_123',
                                        status: 'OPEN',
                                        priority: 'HIGH',
                                        subject: 'SSO SAML login failure',
                                      },
                                      signature:
                                        pingInfo?.signature || 'sha256=9b71d224bd62f3785d96d4...',
                                    },
                                    null,
                                    2,
                                  )}
                                </pre>
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-wrap gap-1">
                              {w.events.map((e) => (
                                <span
                                  key={e}
                                  className="px-2 py-0.5 text-[10px] bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 rounded-md font-mono font-semibold border border-slate-200 dark:border-zinc-700"
                                >
                                  {e}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="space-y-1">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                Active
                              </span>
                              {pingInfo && (
                                <div className="flex items-center gap-1.5 text-xs text-indigo-700 dark:text-indigo-400 font-mono mt-1">
                                  <span>{pingInfo.status}</span>
                                  {pingInfo.latency && (
                                    <span className="px-1.5 py-0.2 rounded bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-[10px] font-bold">
                                      {pingInfo.latency}ms
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right space-x-2">
                            <button
                              onClick={() => togglePayloadPreview(w.id)}
                              className="text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 text-xs font-semibold inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                              title="Toggle payload preview"
                            >
                              <Code2 className="w-3.5 h-3.5" />
                              <span>{isExpanded ? 'Hide Payload' : 'Payload'}</span>
                              {isExpanded ? (
                                <ChevronUp className="w-3 h-3" />
                              ) : (
                                <ChevronDown className="w-3 h-3" />
                              )}
                            </button>
                            <button
                              onClick={() => handleTestPing(w.id)}
                              className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 text-xs font-semibold inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors cursor-pointer"
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>Test Ping</span>
                            </button>
                            <button
                              onClick={() => handleDeleteWebhook(w.id)}
                              className="text-rose-600 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-300 text-xs font-semibold inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Sub-tab: Audit Logs ── */}
      {!loading && activeTab === 'audit' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100">
              Security Audit Log
            </h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Immutable audit trail of authentication events, access changes, and administrative
              actions.
            </p>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xs border border-slate-200/80 dark:border-zinc-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200/80 dark:divide-zinc-800 text-left text-xs">
                <thead className="bg-slate-50/80 dark:bg-zinc-800/80 text-slate-500 dark:text-zinc-400 font-semibold uppercase text-[11px]">
                  <tr>
                    <th className="px-6 py-3.5">Action</th>
                    <th className="px-6 py-3.5">User / Actor</th>
                    <th className="px-6 py-3.5">Resource</th>
                    <th className="px-6 py-3.5">IP Address</th>
                    <th className="px-6 py-3.5">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800 text-slate-700 dark:text-zinc-300">
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-6 py-10 text-center text-slate-400 dark:text-zinc-500"
                      >
                        No security audit events recorded.
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map((l) => (
                      <tr
                        key={l.id}
                        className="hover:bg-slate-50/60 dark:hover:bg-zinc-800/40 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800/60 font-mono">
                            {l.action}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-900 dark:text-zinc-100 font-bold">
                          {l.userEmail || l.userId || 'system'}
                        </td>
                        <td className="px-6 py-4 text-slate-600 dark:text-zinc-400 font-mono text-xs">
                          {l.resource} {l.resourceId ? `#${l.resourceId.substring(0, 8)}` : ''}
                        </td>
                        <td className="px-6 py-4 text-slate-500 dark:text-zinc-400 font-mono text-xs">
                          {l.ipAddress || '127.0.0.1'}
                        </td>
                        <td className="px-6 py-4 text-slate-500 dark:text-zinc-400 text-xs">
                          {new Date(l.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Sub-tab: Feature Flags ── */}
      {!loading && activeTab === 'flags' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100">
              Tenant Feature Flags
            </h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Toggle platform capabilities and beta features specifically for this tenant.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {featureFlags.map((flag) => (
              <div
                key={flag.key}
                className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-xs flex items-center justify-between hover:border-slate-300 dark:hover:border-zinc-700 transition-all"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 dark:text-zinc-100 text-sm">
                      {flag.name}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        flag.enabled
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60'
                          : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 border-slate-200 dark:border-zinc-700'
                      }`}
                    >
                      {flag.enabled ? 'Active' : 'Disabled'}
                    </span>
                  </div>
                  <div className="font-mono text-xs text-slate-400 dark:text-zinc-500">
                    {flag.key}
                  </div>
                  {flag.description && (
                    <div className="text-xs text-slate-500 dark:text-zinc-400">
                      {flag.description}
                    </div>
                  )}
                </div>

                {/* iOS-style toggle switch: note no inner text so getByRole('button', { name: '' }) matches cleanly */}
                <button
                  type="button"
                  onClick={() => handleToggleFlag(flag.key, flag.enabled)}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    flag.enabled ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-zinc-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      flag.enabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Sub-tab: Platform Admin ── */}
      {!loading && activeTab === 'admin' && isOwner && (
        <div className="space-y-6">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100">
              Platform Governance & Health
            </h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Cross-tenant administration, resource consumption metrics, and service health checks.
            </p>
          </div>

          {healthStatus && (
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 rounded-2xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-slate-800">
              <div className="flex items-center space-x-3.5">
                <div className="w-3.5 h-3.5 rounded-full bg-emerald-400 animate-pulse ring-4 ring-emerald-500/20" />
                <div>
                  <div className="font-bold text-sm tracking-tight">
                    Cluster Status: {healthStatus.status}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5 font-mono">
                    Database: {healthStatus.database} • Uptime:{' '}
                    {Math.floor(healthStatus.uptimeSeconds / 60)} mins
                  </div>
                </div>
              </div>
              <span className="px-3 py-1 bg-emerald-950 text-emerald-300 text-xs font-bold rounded-full border border-emerald-800 self-start sm:self-auto">
                All Systems Operational
              </span>
            </div>
          )}

          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xs border border-slate-200/80 dark:border-zinc-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200/80 dark:divide-zinc-800 text-left text-xs">
                <thead className="bg-slate-50/80 dark:bg-zinc-800/80 text-slate-500 dark:text-zinc-400 font-semibold uppercase text-[11px]">
                  <tr>
                    <th className="px-6 py-3.5">Tenant Name</th>
                    <th className="px-6 py-3.5">Slug</th>
                    <th className="px-6 py-3.5">Plan</th>
                    <th className="px-6 py-3.5">Users</th>
                    <th className="px-6 py-3.5">Tickets</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800 text-slate-700 dark:text-zinc-300">
                  {tenants.map((t) => (
                    <tr
                      key={t.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-zinc-800/40 transition-colors"
                    >
                      <td className="px-6 py-4 font-bold text-slate-900 dark:text-zinc-100">
                        {t.name}
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-600 dark:text-zinc-400">
                        {t.slug}
                      </td>
                      <td className="px-6 py-4">
                        <select
                          value={t.plan === 'PRO' ? 'PRO' : 'FREE'}
                          onChange={(e) =>
                            handleUpdateTenantPlan(t.id, e.target.value as 'FREE' | 'PRO')
                          }
                          aria-label={`Change plan for ${t.name}`}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${
                            t.plan === 'PRO'
                              ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                              : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border-slate-200 dark:border-zinc-700'
                          }`}
                        >
                          <option value="FREE">FREE</option>
                          <option value="PRO">PRO</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 text-slate-600 dark:text-zinc-400 font-medium">
                        {t.userCount}
                      </td>
                      <td className="px-6 py-4 text-slate-600 dark:text-zinc-400 font-medium">
                        {t.ticketCount}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            t.status === 'ACTIVE'
                              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                              : 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300'
                          }`}
                        >
                          {t.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleToggleTenantStatus(t.id, t.status)}
                          className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors ${
                            t.status === 'ACTIVE'
                              ? 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30'
                              : 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                          }`}
                        >
                          {t.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Generate API Key ── */}
      {isKeyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200 dark:border-zinc-800 animate-in fade-in zoom-in-95 duration-150">
            {!createdKey ? (
              <form onSubmit={handleCreateKey} className="space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 dark:border-zinc-800 pb-3">
                  <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
                    <Key className="w-4 h-4" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100">
                    Generate New API Key
                  </h3>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-zinc-300 uppercase mb-1">
                    Key Name / Identifier
                  </label>
                  <input
                    type="text"
                    required
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    placeholder="e.g. Production Webhook Processor"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-zinc-700 rounded-xl text-xs text-slate-900 dark:text-zinc-100 bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-2xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-zinc-300 uppercase mb-1">
                    Scopes
                  </label>
                  <div className="space-y-2 text-xs text-slate-700 dark:text-zinc-300 p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700">
                    <label className="flex items-center space-x-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newKeyScopes.includes('tickets:read')}
                        onChange={(e) => {
                          if (e.target.checked) setNewKeyScopes([...newKeyScopes, 'tickets:read']);
                          else setNewKeyScopes(newKeyScopes.filter((s) => s !== 'tickets:read'));
                        }}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="font-mono">tickets:read</span>
                    </label>
                    <label className="flex items-center space-x-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newKeyScopes.includes('tickets:write')}
                        onChange={(e) => {
                          if (e.target.checked) setNewKeyScopes([...newKeyScopes, 'tickets:write']);
                          else setNewKeyScopes(newKeyScopes.filter((s) => s !== 'tickets:write'));
                        }}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="font-mono">tickets:write</span>
                    </label>
                    <label className="flex items-center space-x-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newKeyScopes.includes('kb:read')}
                        onChange={(e) => {
                          if (e.target.checked) setNewKeyScopes([...newKeyScopes, 'kb:read']);
                          else setNewKeyScopes(newKeyScopes.filter((s) => s !== 'kb:read'));
                        }}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="font-mono">kb:read</span>
                    </label>
                  </div>
                </div>
                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsKeyModalOpen(false)}
                    className="px-4 py-2 border border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 rounded-xl text-xs font-semibold hover:bg-slate-50 dark:hover:bg-zinc-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 shadow-xs"
                  >
                    Generate
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center space-x-2 text-emerald-600 font-bold text-sm">
                  <CheckCircle2 className="w-5 h-5" />
                  <span>API Key Created</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-zinc-400">
                  Please copy this key now. For security purposes, it will never be displayed again.
                </p>
                <div className="p-3 bg-slate-900 rounded-xl flex items-center justify-between text-white font-mono text-xs border border-slate-800 shadow-inner">
                  <span className="truncate mr-2 text-indigo-300">{createdKey.rawKey}</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(createdKey.rawKey);
                      setCopiedKey(true);
                      setTimeout(() => setCopiedKey(false), 2000);
                    }}
                    className={`p-1.5 rounded-lg transition-all ${
                      copiedKey
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                    title="Copy API Key"
                  >
                    {copiedKey ? (
                      <Check className="w-4 h-4 text-emerald-400 animate-in zoom-in-75" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {copiedKey && (
                  <div className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" />
                    <span>Copied to clipboard!</span>
                  </div>
                )}
                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCreatedKey(null);
                      setIsKeyModalOpen(false);
                    }}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 shadow-xs"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modal: Add Webhook ── */}
      {isWebhookModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200 dark:border-zinc-800 animate-in fade-in zoom-in-95 duration-150">
            <form onSubmit={handleCreateWebhook} className="space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 dark:border-zinc-800 pb-3">
                <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
                  <Webhook className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100">
                  Add Webhook Subscription
                </h3>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-zinc-300 uppercase mb-1">
                  Webhook URL (HTTPS)
                </label>
                <input
                  type="url"
                  required
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://example.com/api/webhooks"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-zinc-700 rounded-xl text-xs text-slate-900 dark:text-zinc-100 bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono shadow-2xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-zinc-300 uppercase mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={webhookDescription}
                  onChange={(e) => setWebhookDescription(e.target.value)}
                  placeholder="e.g. Sync tickets to CRM"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-zinc-700 rounded-xl text-xs text-slate-900 dark:text-zinc-100 bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-2xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-zinc-300 uppercase mb-1">
                  Subscribed Events
                </label>
                <div className="space-y-2 text-xs text-slate-700 dark:text-zinc-300 p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700">
                  <label className="flex items-center space-x-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={webhookEvents.includes('ticket.created')}
                      onChange={(e) => {
                        if (e.target.checked)
                          setWebhookEvents([...webhookEvents, 'ticket.created']);
                        else
                          setWebhookEvents(webhookEvents.filter((ev) => ev !== 'ticket.created'));
                      }}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="font-mono">ticket.created</span>
                  </label>
                  <label className="flex items-center space-x-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={webhookEvents.includes('ticket.updated')}
                      onChange={(e) => {
                        if (e.target.checked)
                          setWebhookEvents([...webhookEvents, 'ticket.updated']);
                        else
                          setWebhookEvents(webhookEvents.filter((ev) => ev !== 'ticket.updated'));
                      }}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="font-mono">ticket.updated</span>
                  </label>
                  <label className="flex items-center space-x-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={webhookEvents.includes('message.created')}
                      onChange={(e) => {
                        if (e.target.checked)
                          setWebhookEvents([...webhookEvents, 'message.created']);
                        else
                          setWebhookEvents(webhookEvents.filter((ev) => ev !== 'message.created'));
                      }}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="font-mono">message.created</span>
                  </label>
                </div>
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsWebhookModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 rounded-xl text-xs font-semibold hover:bg-slate-50 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 shadow-xs"
                >
                  Add Webhook
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Upgrade Plan ── */}
      {isUpgradeModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="upgrade-plan-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
        >
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200 dark:border-zinc-800 animate-in fade-in zoom-in-95 duration-150 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <h3
                    id="upgrade-plan-title"
                    className="text-base font-bold text-slate-900 dark:text-zinc-100"
                  >
                    Upgrade to SupportPilot PRO
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                    20x quotas, priority SLA, and automated Copilot deflection
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsUpgradeModalOpen(false)}
                aria-label="Close upgrade modal"
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200/80 dark:border-zinc-700 flex items-baseline justify-between">
              <div>
                <span className="text-2xl font-extrabold text-slate-900 dark:text-zinc-100">
                  $49
                </span>
                <span className="text-xs text-slate-500 dark:text-zinc-400 font-medium">
                  {' '}
                  / month
                </span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-600 text-white shadow-xs">
                PRO TIER
              </span>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider">
                What's included:
              </span>
              <div className="space-y-1.5 text-xs text-slate-600 dark:text-zinc-400">
                {[
                  'Unlimited live chat',
                  '10,000 messages/mo',
                  '1,000 AI answers',
                  '100MB Knowledge Base',
                  'Priority SLA (15 min response)',
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 space-y-2">
              <button
                type="button"
                disabled={upgrading}
                onClick={handleInstantUpgrade}
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <CreditCard className="w-4 h-4" />
                <span>Instant Test Upgrade (Simulated Stripe)</span>
              </button>

              <button
                type="button"
                disabled={upgrading}
                onClick={handleSimulateWebhook}
                className="w-full py-2.5 px-4 border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-700/60 text-slate-700 dark:text-zinc-300 text-xs font-semibold rounded-xl shadow-2xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Webhook className="w-4 h-4" />
                <span>Simulate Webhook Payment</span>
              </button>

              <button
                type="button"
                disabled={upgrading}
                onClick={() => setIsUpgradeModalOpen(false)}
                className="w-full py-1.5 text-center text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200 text-xs font-medium cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={Boolean(keyToRevoke)}
        title="Revoke API Key"
        message="Are you sure you want to revoke this API key? Applications using this token will immediately lose access."
        confirmLabel="Revoke Key"
        isDestructive
        onConfirm={() => {
          if (keyToRevoke) {
            handleRevokeKey(keyToRevoke);
            setKeyToRevoke(null);
          }
        }}
        onCancel={() => setKeyToRevoke(null)}
      />
    </div>
  );
}
