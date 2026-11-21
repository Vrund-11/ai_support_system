import { useEffect, useState, useMemo } from 'react';
import {
  Search,
  Building2,
  CheckCircle2,
  XCircle,
  Sliders,
  X,
  Save,
  Power,
  Cpu,
  Layers,
  Database,
  Users,
  Zap,
} from 'lucide-react';
import {
  adminApi,
  type SuperAdminTenantItem,
  type TenantQuotas,
  type TenantFeatureFlags,
} from '../../lib/admin-api';

type TierFilter = 'ALL' | 'ENTERPRISE' | 'PRO' | 'FREE';
type StatusFilter = 'ALL' | 'ACTIVE' | 'SUSPENDED';

export function TenantsView() {
  const [tenants, setTenants] = useState<SuperAdminTenantItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState<TierFilter>('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

  // Drawer state
  const [selectedTenant, setSelectedTenant] = useState<SuperAdminTenantItem | null>(null);
  const [drawerQuotas, setDrawerQuotas] = useState<TenantQuotas>({
    maxSeats: 50,
    rateLimitPerMin: 600,
    aiTokensMonthly: 10000000,
    vectorStorageLimitMb: 1000,
  });
  const [drawerFlags, setDrawerFlags] = useState<TenantFeatureFlags>({
    ai_copilot: true,
    sla_automation: true,
    realtime_chat: true,
    biometrics_2fa: false,
  });
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    adminApi
      .getTenants()
      .then((data) => setTenants(data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  // Sync drawer when selectedTenant changes
  useEffect(() => {
    if (selectedTenant) {
      setDrawerQuotas({ ...selectedTenant.quotas });
      setDrawerFlags({ ...selectedTenant.features });
      setSaveSuccess(false);
    }
  }, [selectedTenant]);

  const filteredTenants = useMemo(() => {
    return tenants.filter((t) => {
      const q = search.toLowerCase().trim();
      const matchesSearch =
        !q ||
        t.name.toLowerCase().includes(q) ||
        t.slug.toLowerCase().includes(q) ||
        (t.primaryOwner?.email?.toLowerCase().includes(q) ?? false);

      const matchesTier = tierFilter === 'ALL' || t.plan === tierFilter;
      const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;

      return matchesSearch && matchesTier && matchesStatus;
    });
  }, [tenants, search, tierFilter, statusFilter]);

  const handleToggleStatus = async () => {
    if (!selectedTenant) return;
    const newStatus: 'ACTIVE' | 'SUSPENDED' =
      selectedTenant.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      await adminApi.updateTenantStatus(selectedTenant.id, newStatus);
      const updated: SuperAdminTenantItem = { ...selectedTenant, status: newStatus };
      setSelectedTenant(updated);
      setTenants((prev) => prev.map((t) => (t.id === selectedTenant.id ? updated : t)));
    } catch (err) {
      console.error('Failed to toggle status:', err);
    }
  };

  const handleSaveQuotas = async () => {
    if (!selectedTenant) return;
    try {
      await adminApi.updateTenantQuotas(selectedTenant.id, drawerQuotas);
      const updated: SuperAdminTenantItem = {
        ...selectedTenant,
        quotas: drawerQuotas,
        features: drawerFlags,
      };
      setSelectedTenant(updated);
      setTenants((prev) => prev.map((t) => (t.id === selectedTenant.id ? updated : t)));
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      console.error('Failed to save quotas:', err);
    }
  };

  return (
    <div className="space-y-6 relative">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>Tenant Fleet Management</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              {filteredTenants.length} of {tenants.length} fleets
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Global fleet directory: configure per-tenant hardware quotas, feature toggles, and
            enforce instantaneous suspension.
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            data-testid="tenants-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tenant name, slug, owner..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
          />
        </div>
      </div>

      {/* Filter Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Tier Filters */}
        <div className="flex items-center gap-1.5 bg-slate-900/60 p-1 rounded-xl border border-slate-800">
          <span className="text-[11px] font-mono text-slate-400 px-2 uppercase">Tier:</span>
          {(['ALL', 'ENTERPRISE', 'PRO', 'FREE'] as TierFilter[]).map((tier) => (
            <button
              key={tier}
              type="button"
              data-testid={`filter-tier-${tier.toLowerCase()}`}
              onClick={() => setTierFilter(tier)}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                tierFilter === tier
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tier}
            </button>
          ))}
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-1.5 bg-slate-900/60 p-1 rounded-xl border border-slate-800">
          <span className="text-[11px] font-mono text-slate-400 px-2 uppercase">Status:</span>
          {(['ALL', 'ACTIVE', 'SUSPENDED'] as StatusFilter[]).map((st) => (
            <button
              key={st}
              type="button"
              data-testid={`filter-status-${st.toLowerCase()}`}
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                statusFilter === st
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Tenant Directory Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/60 text-slate-400 uppercase font-mono text-[11px] border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Tenant Name</th>
                <th className="px-4 py-3">Slug</th>
                <th className="px-4 py-3">Tier</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Users</th>
                <th className="px-4 py-3">Tickets</th>
                <th className="px-4 py-3">AI Token Quota</th>
                <th className="px-4 py-3 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500 font-mono">
                    Loading tenant directory...
                  </td>
                </tr>
              ) : filteredTenants.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500 font-mono">
                    No tenants match your filters.
                  </td>
                </tr>
              ) : (
                filteredTenants.map((t) => (
                  <tr
                    key={t.id}
                    data-testid={`tenant-row-${t.id}`}
                    onClick={() => setSelectedTenant(t)}
                    className="hover:bg-slate-800/40 cursor-pointer transition-colors group"
                  >
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-indigo-400 shrink-0" />
                        <div>
                          <div className="font-semibold text-white group-hover:text-indigo-300 transition-colors">
                            {t.name}
                          </div>
                          {t.primaryOwner && (
                            <div className="text-[11px] text-slate-400 font-mono">
                              {t.primaryOwner.email}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-slate-400">{t.slug}</td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          t.plan === 'ENTERPRISE'
                            ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                            : t.plan === 'PRO'
                              ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                              : 'bg-slate-800 text-slate-300 border border-slate-700'
                        }`}
                      >
                        {t.plan}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      {t.status === 'ACTIVE' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          ACTIVE
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-rose-400">
                          <XCircle className="w-3.5 h-3.5" />
                          SUSPENDED
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-slate-200">{t.userCount}</td>
                    <td className="px-4 py-3.5 font-mono text-slate-200">{t.ticketCount}</td>
                    <td className="px-4 py-3.5 font-mono text-slate-400">
                      {(t.quotas.aiTokensMonthly / 1000000).toFixed(1)}M /mo
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <button
                        type="button"
                        data-testid={`inspect-tenant-${t.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTenant(t);
                        }}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                        title="Configure quotas & status"
                      >
                        <Sliders className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slide-over Tenant Inspection Drawer */}
      {selectedTenant && (
        <div
          data-testid="tenant-inspection-drawer"
          className="fixed inset-y-0 right-0 z-50 w-full sm:max-w-md bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300"
        >
          {/* Drawer Header */}
          <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">{selectedTenant.name}</h3>
                <div className="text-[11px] font-mono text-slate-400 flex items-center gap-2">
                  <span>slug: {selectedTenant.slug}</span>
                  <span>&bull;</span>
                  <span
                    className={`font-bold ${
                      selectedTenant.status === 'ACTIVE' ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {selectedTenant.status}
                  </span>
                </div>
              </div>
            </div>
            <button
              type="button"
              data-testid="close-drawer-btn"
              onClick={() => setSelectedTenant(null)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6 text-xs text-slate-300">
            {/* Quick Status / Emergency Power Toggle */}
            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white uppercase tracking-wider text-[11px] font-mono">
                  Operational Gate
                </span>
                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                    selectedTenant.status === 'ACTIVE'
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'bg-rose-500/10 text-rose-400'
                  }`}
                >
                  {selectedTenant.status}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Instantly disconnect all active agent websocket connections and block incoming
                customer tickets.
              </p>
              <button
                type="button"
                data-testid="drawer-status-toggle"
                onClick={handleToggleStatus}
                className={`w-full mt-2 py-2 px-3 rounded-lg font-medium text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                  selectedTenant.status === 'ACTIVE'
                    ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                }`}
              >
                <Power className="w-4 h-4" />
                <span>
                  {selectedTenant.status === 'ACTIVE'
                    ? 'Suspend Tenant Access'
                    : 'Activate Tenant Access'}
                </span>
              </button>
            </div>

            {/* Quota Overrides */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Sliders className="w-4 h-4 text-indigo-400" />
                <span>Custom Quota Overrides</span>
              </div>

              {/* Max Seats */}
              <div>
                <label className="block text-[11px] font-mono text-slate-400 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-slate-500" /> Max Seats
                  </span>
                  <span className="text-white font-bold">{drawerQuotas.maxSeats} seats</span>
                </label>
                <input
                  type="number"
                  data-testid="quota-max-seats"
                  value={drawerQuotas.maxSeats}
                  onChange={(e) =>
                    setDrawerQuotas({ ...drawerQuotas, maxSeats: Number(e.target.value) })
                  }
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-slate-100"
                />
              </div>

              {/* Rate Limit */}
              <div>
                <label className="block text-[11px] font-mono text-slate-400 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5 text-slate-500" /> Rate Limit (req/min)
                  </span>
                  <span className="text-white font-bold">{drawerQuotas.rateLimitPerMin} r/m</span>
                </label>
                <input
                  type="number"
                  data-testid="quota-rate-limit"
                  value={drawerQuotas.rateLimitPerMin}
                  onChange={(e) =>
                    setDrawerQuotas({
                      ...drawerQuotas,
                      rateLimitPerMin: Number(e.target.value),
                    })
                  }
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-slate-100"
                />
              </div>

              {/* AI Token Cap */}
              <div>
                <label className="block text-[11px] font-mono text-slate-400 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Cpu className="w-3.5 h-3.5 text-slate-500" /> AI Monthly Token Cap
                  </span>
                  <span className="text-white font-bold">
                    {(drawerQuotas.aiTokensMonthly / 1000000).toFixed(1)}M
                  </span>
                </label>
                <input
                  type="number"
                  data-testid="quota-ai-tokens"
                  value={drawerQuotas.aiTokensMonthly}
                  onChange={(e) =>
                    setDrawerQuotas({
                      ...drawerQuotas,
                      aiTokensMonthly: Number(e.target.value),
                    })
                  }
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-slate-100"
                />
              </div>

              {/* Vector Storage */}
              <div>
                <label className="block text-[11px] font-mono text-slate-400 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Database className="w-3.5 h-3.5 text-slate-500" /> Vector Limit (MB)
                  </span>
                  <span className="text-white font-bold">
                    {drawerQuotas.vectorStorageLimitMb} MB
                  </span>
                </label>
                <input
                  type="number"
                  data-testid="quota-vector-storage"
                  value={drawerQuotas.vectorStorageLimitMb}
                  onChange={(e) =>
                    setDrawerQuotas({
                      ...drawerQuotas,
                      vectorStorageLimitMb: Number(e.target.value),
                    })
                  }
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-slate-100"
                />
              </div>

              {saveSuccess && (
                <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-mono text-center">
                  Quotas updated successfully in cluster!
                </div>
              )}

              <button
                type="button"
                data-testid="save-quotas-btn"
                onClick={handleSaveQuotas}
                className="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Quotas</span>
              </button>
            </div>

            {/* Feature Flags Switches */}
            <div className="space-y-3 pt-3 border-t border-slate-800">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Layers className="w-4 h-4 text-indigo-400" />
                <span>Per-Tenant Feature Flags</span>
              </div>

              {(
                [
                  { key: 'ai_copilot', label: 'AI Copilot & Smart Drafts' },
                  { key: 'sla_automation', label: 'SLA Escalation Engine' },
                  { key: 'realtime_chat', label: 'Realtime Web Widget & Handoff' },
                  { key: 'biometrics_2fa', label: 'Biometrics WebAuthn 2FA' },
                ] as const
              ).map((flag) => {
                const isEnabled = drawerFlags[flag.key];
                return (
                  <div
                    key={flag.key}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800/80"
                  >
                    <span className="font-mono text-[11px] text-slate-300">{flag.label}</span>
                    <button
                      type="button"
                      data-testid={`flag-toggle-${flag.key}`}
                      onClick={() =>
                        setDrawerFlags({
                          ...drawerFlags,
                          [flag.key]: !isEnabled,
                        })
                      }
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        isEnabled ? 'bg-indigo-600' : 'bg-slate-700'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          isEnabled ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
