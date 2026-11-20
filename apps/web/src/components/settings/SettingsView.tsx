import { useState, useEffect } from 'react';
import {
  api,
  type ApiKeyItem,
  type CreatedApiKey,
  type WebhookItem,
  type AuditLogItem,
  type FeatureFlagItem,
  type PlatformTenantItem,
} from '../../lib/api';
import { useAuthStore } from '../../store/auth.store';
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
} from 'lucide-react';

export type SettingsSubTab = 'api-keys' | 'webhooks' | 'audit' | 'flags' | 'admin';

export function SettingsView() {
  const user = useAuthStore((s) => s.user);
  const isOwner = user?.role === 'OWNER' || user?.role === 'PLATFORM_ADMIN';

  const [activeTab, setActiveTab] = useState<SettingsSubTab>('api-keys');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // API Keys state
  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([]);
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyScopes, setNewKeyScopes] = useState<string[]>(['tickets:read', 'tickets:write']);
  const [createdKey, setCreatedKey] = useState<CreatedApiKey | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Webhooks state
  const [webhooks, setWebhooks] = useState<WebhookItem[]>([]);
  const [isWebhookModalOpen, setIsWebhookModalOpen] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookDescription, setWebhookDescription] = useState('');
  const [webhookEvents, setWebhookEvents] = useState<string[]>([
    'ticket.created',
    'ticket.updated',
  ]);
  const [pingStatus, setPingStatus] = useState<Record<string, string>>({});

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
      if (activeTab === 'api-keys') {
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
    } catch (err: any) {
      alert(err.message || 'Failed to create API key');
    }
  };

  const handleRevokeKey = async (id: string) => {
    if (!confirm('Are you sure you want to revoke this API key?')) return;
    try {
      await api.apiKeys.revoke(id);
      setApiKeys(apiKeys.filter((k) => k.id !== id));
    } catch (err: any) {
      alert(err.message || 'Failed to revoke API key');
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
    } catch (err: any) {
      alert(err.message || 'Failed to create webhook');
    }
  };

  const handleDeleteWebhook = async (id: string) => {
    if (!confirm('Delete this webhook endpoint?')) return;
    try {
      await api.webhooks.delete(id);
      setWebhooks(webhooks.filter((w) => w.id !== id));
    } catch (err: any) {
      alert(err.message || 'Failed to delete webhook');
    }
  };

  const handleTestPing = async (id: string) => {
    setPingStatus((prev) => ({ ...prev, [id]: 'sending...' }));
    try {
      const res = await api.webhooks.test(id);
      setPingStatus((prev) => ({
        ...prev,
        [id]: res.delivered ? 'Delivered (200 OK)' : 'Failed',
      }));
    } catch {
      setPingStatus((prev) => ({ ...prev, [id]: 'Error dispatching' }));
    }
  };

  const handleToggleFlag = async (key: string, currentEnabled: boolean) => {
    try {
      const updated = await api.featureFlags.toggle(key, !currentEnabled);
      setFeatureFlags(
        featureFlags.map((f) => (f.key === key ? { ...f, enabled: updated.enabled } : f)),
      );
    } catch (err: any) {
      alert(err.message || 'Failed to toggle flag');
    }
  };

  const handleToggleTenantStatus = async (id: string, currentStatus: 'ACTIVE' | 'SUSPENDED') => {
    const nextStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      await api.admin.updateTenantStatus(id, nextStatus);
      setTenants(tenants.map((t) => (t.id === id ? { ...t, status: nextStatus } : t)));
    } catch (err: any) {
      alert(err.message || 'Failed to update tenant status');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Settings & Administration</h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage API keys, webhooks, audit logs, feature flags, and tenant governance.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-slate-200 mb-6 pb-2">
        <button
          onClick={() => setActiveTab('api-keys')}
          className={`flex items-center space-x-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'api-keys'
              ? 'bg-indigo-50 text-indigo-700'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Key className="w-4 h-4" />
          <span>API Keys</span>
        </button>
        <button
          onClick={() => setActiveTab('webhooks')}
          className={`flex items-center space-x-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'webhooks'
              ? 'bg-indigo-50 text-indigo-700'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Webhook className="w-4 h-4" />
          <span>Webhooks</span>
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`flex items-center space-x-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'audit'
              ? 'bg-indigo-50 text-indigo-700'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Audit Logs</span>
        </button>
        <button
          onClick={() => setActiveTab('flags')}
          className={`flex items-center space-x-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'flags'
              ? 'bg-indigo-50 text-indigo-700'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <ToggleLeft className="w-4 h-4" />
          <span>Feature Flags</span>
        </button>
        {isOwner && (
          <button
            onClick={() => setActiveTab('admin')}
            className={`flex items-center space-x-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'admin'
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Server className="w-4 h-4" />
            <span>Platform Admin</span>
          </button>
        )}
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-center space-x-2">
          <ShieldAlert className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading && (
        <div className="py-12 text-center text-slate-500 text-sm">Loading settings...</div>
      )}

      {/* ── Sub-tab: API Keys ── */}
      {!loading && activeTab === 'api-keys' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Tenant API Keys</h2>
              <p className="text-sm text-slate-500">
                Generate scoped API keys for automated integrations and CLI scripts.
              </p>
            </div>
            <button
              onClick={() => {
                setCreatedKey(null);
                setIsKeyModalOpen(true);
              }}
              className="inline-flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Generate Key</span>
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                    Key Prefix
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                    Scopes
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                    Created
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm text-slate-700">
                {apiKeys.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                      No active API keys found. Generate one to get started.
                    </td>
                  </tr>
                ) : (
                  apiKeys.map((k) => (
                    <tr key={k.id} className="hover:bg-slate-50/50">
                      <td className="px-6 py-4 font-medium text-slate-900">{k.name}</td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-600 bg-slate-50 rounded">
                        {k.prefix}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {k.scopes.map((s) => (
                            <span
                              key={s}
                              className="px-2 py-0.5 text-xs bg-indigo-50 text-indigo-700 rounded-md font-mono"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-500">
                        {new Date(k.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleRevokeKey(k.id)}
                          className="text-red-600 hover:text-red-800 text-xs font-medium inline-flex items-center space-x-1"
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
      )}

      {/* ── Sub-tab: Webhooks ── */}
      {!loading && activeTab === 'webhooks' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Outgoing Webhooks</h2>
              <p className="text-sm text-slate-500">
                Receive real-time signed HMAC-SHA256 HTTP POST notifications for ticket and message
                events.
              </p>
            </div>
            <button
              onClick={() => setIsWebhookModalOpen(true)}
              className="inline-flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Add Webhook</span>
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                    Target Endpoint
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                    Events
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm text-slate-700">
                {webhooks.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-slate-400">
                      No webhook subscriptions configured.
                    </td>
                  </tr>
                ) : (
                  webhooks.map((w) => (
                    <tr key={w.id} className="hover:bg-slate-50/50">
                      <td className="px-6 py-4">
                        <div className="font-mono text-xs font-medium text-slate-900">{w.url}</div>
                        {w.description && (
                          <div className="text-xs text-slate-500 mt-0.5">{w.description}</div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {w.events.map((e) => (
                            <span
                              key={e}
                              className="px-2 py-0.5 text-xs bg-slate-100 text-slate-700 rounded-md font-mono"
                            >
                              {e}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800">
                          Active
                        </span>
                        {pingStatus[w.id] && (
                          <div className="text-xs text-indigo-600 font-mono mt-1">
                            {pingStatus[w.id]}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right space-x-3">
                        <button
                          onClick={() => handleTestPing(w.id)}
                          className="text-slate-600 hover:text-indigo-600 text-xs font-medium inline-flex items-center space-x-1"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Test Ping</span>
                        </button>
                        <button
                          onClick={() => handleDeleteWebhook(w.id)}
                          className="text-red-600 hover:text-red-800 text-xs font-medium inline-flex items-center space-x-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Sub-tab: Audit Logs ── */}
      {!loading && activeTab === 'audit' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Security Audit Log</h2>
            <p className="text-sm text-slate-500">
              Immutable audit trail of authentication events, access changes, and administrative
              actions.
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                    Action
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                    User / Actor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                    Resource
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                    IP Address
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                    Timestamp
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm text-slate-700">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                      No security audit events recorded.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-50/50">
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-800 font-mono">
                          {l.action}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-800 font-medium">
                        {l.userEmail || l.userId || 'system'}
                      </td>
                      <td className="px-6 py-4 text-slate-600 font-mono text-xs">
                        {l.resource} {l.resourceId ? `#${l.resourceId.substring(0, 8)}` : ''}
                      </td>
                      <td className="px-6 py-4 text-slate-500 font-mono text-xs">
                        {l.ipAddress || '127.0.0.1'}
                      </td>
                      <td className="px-6 py-4 text-slate-500 text-xs">
                        {new Date(l.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Sub-tab: Feature Flags ── */}
      {!loading && activeTab === 'flags' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Tenant Feature Flags</h2>
            <p className="text-sm text-slate-500">
              Toggle platform capabilities and beta features specifically for this tenant.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {featureFlags.map((flag) => (
              <div
                key={flag.key}
                className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between"
              >
                <div>
                  <div className="font-semibold text-slate-900 text-sm">{flag.name}</div>
                  <div className="font-mono text-xs text-slate-400 mt-0.5">{flag.key}</div>
                  {flag.description && (
                    <div className="text-xs text-slate-500 mt-1">{flag.description}</div>
                  )}
                </div>
                <button
                  onClick={() => handleToggleFlag(flag.key, flag.enabled)}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    flag.enabled ? 'bg-indigo-600' : 'bg-slate-200'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
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
            <h2 className="text-lg font-semibold text-slate-900">Platform Governance & Health</h2>
            <p className="text-sm text-slate-500">
              Cross-tenant administration, resource consumption metrics, and service health checks.
            </p>
          </div>

          {healthStatus && (
            <div className="bg-slate-900 text-white p-5 rounded-xl shadow-sm flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
                <div>
                  <div className="font-semibold text-sm">Cluster Status: {healthStatus.status}</div>
                  <div className="text-xs text-slate-400">
                    Database: {healthStatus.database} | Uptime:{' '}
                    {Math.floor(healthStatus.uptimeSeconds / 60)} mins
                  </div>
                </div>
              </div>
              <span className="px-3 py-1 bg-emerald-950 text-emerald-300 text-xs font-semibold rounded-full border border-emerald-800">
                Healthy
              </span>
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                    Tenant Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                    Slug
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                    Users
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                    Tickets
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm text-slate-700">
                {tenants.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/50">
                    <td className="px-6 py-4 font-medium text-slate-900">{t.name}</td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-600">{t.slug}</td>
                    <td className="px-6 py-4 text-slate-600">{t.userCount}</td>
                    <td className="px-6 py-4 text-slate-600">{t.ticketCount}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          t.status === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {t.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleToggleTenantStatus(t.id, t.status)}
                        className={`text-xs font-medium px-2 py-1 rounded transition-colors ${
                          t.status === 'ACTIVE'
                            ? 'text-red-600 hover:bg-red-50'
                            : 'text-emerald-600 hover:bg-emerald-50'
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
      )}

      {/* ── Modal: Generate API Key ── */}
      {isKeyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-slate-200">
            {!createdKey ? (
              <form onSubmit={handleCreateKey} className="space-y-4">
                <h3 className="text-lg font-bold text-slate-900">Generate New API Key</h3>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Key Name / Identifier
                  </label>
                  <input
                    type="text"
                    required
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    placeholder="e.g. Production Webhook Processor"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Scopes
                  </label>
                  <div className="space-y-2 text-sm text-slate-700">
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={newKeyScopes.includes('tickets:read')}
                        onChange={(e) => {
                          if (e.target.checked) setNewKeyScopes([...newKeyScopes, 'tickets:read']);
                          else setNewKeyScopes(newKeyScopes.filter((s) => s !== 'tickets:read'));
                        }}
                      />
                      <span>tickets:read</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={newKeyScopes.includes('tickets:write')}
                        onChange={(e) => {
                          if (e.target.checked) setNewKeyScopes([...newKeyScopes, 'tickets:write']);
                          else setNewKeyScopes(newKeyScopes.filter((s) => s !== 'tickets:write'));
                        }}
                      />
                      <span>tickets:write</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={newKeyScopes.includes('kb:read')}
                        onChange={(e) => {
                          if (e.target.checked) setNewKeyScopes([...newKeyScopes, 'kb:read']);
                          else setNewKeyScopes(newKeyScopes.filter((s) => s !== 'kb:read'));
                        }}
                      />
                      <span>kb:read</span>
                    </label>
                  </div>
                </div>
                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsKeyModalOpen(false)}
                    className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-sm"
                  >
                    Generate
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center space-x-2 text-emerald-600 font-bold">
                  <CheckCircle2 className="w-5 h-5" />
                  <span>API Key Created</span>
                </div>
                <p className="text-sm text-slate-600">
                  Please copy this key now. For security purposes, it will never be displayed again.
                </p>
                <div className="p-3 bg-slate-900 rounded-lg flex items-center justify-between text-white font-mono text-xs">
                  <span className="truncate mr-2">{createdKey.rawKey}</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(createdKey.rawKey);
                      setCopiedKey(true);
                      setTimeout(() => setCopiedKey(false), 2000);
                    }}
                    className="text-slate-400 hover:text-white"
                  >
                    {copiedKey ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => {
                      setCreatedKey(null);
                      setIsKeyModalOpen(false);
                    }}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
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
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-slate-200">
            <form onSubmit={handleCreateWebhook} className="space-y-4">
              <h3 className="text-lg font-bold text-slate-900">Add Webhook Subscription</h3>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Webhook URL (HTTPS)
                </label>
                <input
                  type="url"
                  required
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://example.com/api/webhooks"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={webhookDescription}
                  onChange={(e) => setWebhookDescription(e.target.value)}
                  placeholder="e.g. Sync tickets to CRM"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Subscribed Events
                </label>
                <div className="space-y-2 text-sm text-slate-700">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={webhookEvents.includes('ticket.created')}
                      onChange={(e) => {
                        if (e.target.checked)
                          setWebhookEvents([...webhookEvents, 'ticket.created']);
                        else
                          setWebhookEvents(webhookEvents.filter((ev) => ev !== 'ticket.created'));
                      }}
                    />
                    <span>ticket.created</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={webhookEvents.includes('ticket.updated')}
                      onChange={(e) => {
                        if (e.target.checked)
                          setWebhookEvents([...webhookEvents, 'ticket.updated']);
                        else
                          setWebhookEvents(webhookEvents.filter((ev) => ev !== 'ticket.updated'));
                      }}
                    />
                    <span>ticket.updated</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={webhookEvents.includes('message.created')}
                      onChange={(e) => {
                        if (e.target.checked)
                          setWebhookEvents([...webhookEvents, 'message.created']);
                        else
                          setWebhookEvents(webhookEvents.filter((ev) => ev !== 'message.created'));
                      }}
                    />
                    <span>message.created</span>
                  </label>
                </div>
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsWebhookModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-sm"
                >
                  Add Webhook
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
