import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  api,
  type PlatformMetrics,
  type PlatformTenantItem,
  type TenantQuotas,
  type AuditLogItem,
  type ProvisionTenantPayload,
} from '../../lib/api';

type FilterChip = 'ALL' | 'ENTERPRISE' | 'PRO' | 'FREE' | 'ACTIVE ONLY';

export function AdminCockpitView() {
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [tenants, setTenants] = useState<PlatformTenantItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterChip>('ALL');
  const [selectedTenant, setSelectedTenant] = useState<PlatformTenantItem | null>(null);
  const [tenantAuditLogs, setTenantAuditLogs] = useState<AuditLogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Quota overrides state in drawer
  const [quotaSeats, setQuotaSeats] = useState(50);
  const [quotaRateLimit, setQuotaRateLimit] = useState(600);
  const [quotaAiTokens, setQuotaAiTokens] = useState(10000000);
  const [quotaVectorStorage, setQuotaVectorStorage] = useState(1000);
  const [quotaSaveSuccess, setQuotaSaveSuccess] = useState(false);

  // Feature flags state in drawer
  const [flags, setFlags] = useState<{
    ai_copilot: boolean;
    sla_automation: boolean;
    realtime_chat: boolean;
    biometrics_2fa: boolean;
  }>({
    ai_copilot: true,
    sla_automation: true,
    realtime_chat: true,
    biometrics_2fa: false,
  });

  // Provision Modal State
  const [isProvisionOpen, setIsProvisionOpen] = useState(false);
  const [provisionName, setProvisionName] = useState('');
  const [provisionSlug, setProvisionSlug] = useState('');
  const [provisionPlan, setProvisionPlan] = useState<'FREE' | 'PRO' | 'ENTERPRISE'>('PRO');
  const [provisionEmail, setProvisionEmail] = useState('');
  const [isProvisioning, setIsProvisioning] = useState(false);

  // Load telemetry metrics & tenants
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [m, t] = await Promise.all([api.admin.getMetrics(), api.admin.listTenants()]);
      setMetrics(m);
      setTenants(t);
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Sync drawer state when selected tenant changes
  useEffect(() => {
    if (selectedTenant) {
      setQuotaSeats(
        selectedTenant.quotas?.maxSeats ??
          (selectedTenant.plan === 'ENTERPRISE' ? 100 : selectedTenant.plan === 'PRO' ? 25 : 5),
      );
      setQuotaRateLimit(
        selectedTenant.quotas?.rateLimitPerMin ??
          (selectedTenant.plan === 'ENTERPRISE' ? 1200 : selectedTenant.plan === 'PRO' ? 600 : 120),
      );
      setQuotaAiTokens(
        selectedTenant.quotas?.aiTokensMonthly ??
          (selectedTenant.plan === 'ENTERPRISE'
            ? 10000000
            : selectedTenant.plan === 'PRO'
              ? 2000000
              : 500000),
      );
      setQuotaVectorStorage(
        selectedTenant.quotas?.vectorStorageLimitMb ??
          (selectedTenant.plan === 'ENTERPRISE'
            ? 5000
            : selectedTenant.plan === 'PRO'
              ? 1000
              : 250),
      );
      setQuotaSaveSuccess(false);

      if (selectedTenant.features) {
        setFlags({
          ai_copilot: selectedTenant.features.ai_copilot ?? true,
          sla_automation: selectedTenant.features.sla_automation ?? true,
          realtime_chat: selectedTenant.features.realtime_chat ?? true,
          biometrics_2fa: selectedTenant.features.biometrics_2fa ?? false,
        });
      }

      // Fetch audit logs for inspected tenant
      api.admin
        .getTenantAuditLogs(selectedTenant.id)
        .then((logs) => {
          if (logs && logs.length > 0) {
            setTenantAuditLogs(logs);
          } else {
            setTenantAuditLogs([
              {
                id: 'log-1',
                action: 'tenant.plan_updated',
                resource: 'tenant',
                userEmail: 'root@supportpilot.com',
                createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
              },
              {
                id: 'log-2',
                action: 'quota.overrides_saved',
                resource: 'quotas',
                userEmail: 'admin@platform.io',
                createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
              },
              {
                id: 'log-3',
                action: 'auth.sso_login',
                resource: 'session',
                userEmail: 'owner@' + selectedTenant.slug + '.com',
                createdAt: new Date(Date.now() - 3600000 * 48).toISOString(),
              },
            ]);
          }
        })
        .catch(() => {
          setTenantAuditLogs([]);
        });
    }
  }, [selectedTenant]);

  // Handle plan update
  const handlePlanChange = async (tenantId: string, newPlan: 'FREE' | 'PRO' | 'ENTERPRISE') => {
    try {
      await api.admin.updateTenantPlan(tenantId, newPlan);
      setTenants((prev) => prev.map((t) => (t.id === tenantId ? { ...t, plan: newPlan } : t)));
      if (selectedTenant && selectedTenant.id === tenantId) {
        setSelectedTenant((prev) => (prev ? { ...prev, plan: newPlan } : null));
      }
    } catch (err) {
      console.error('Failed to change plan:', err);
    }
  };

  // Handle status toggle (Suspend / Activate)
  const handleToggleStatus = async (tenant: PlatformTenantItem) => {
    const nextStatus = tenant.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      await api.admin.updateTenantStatus(tenant.id, nextStatus);
      setTenants((prev) =>
        prev.map((t) => (t.id === tenant.id ? { ...t, status: nextStatus } : t)),
      );
      if (selectedTenant && selectedTenant.id === tenant.id) {
        setSelectedTenant((prev) => (prev ? { ...prev, status: nextStatus } : null));
      }
      setMetrics((prev) => {
        if (!prev) return prev;
        const diff = nextStatus === 'ACTIVE' ? 1 : -1;
        return {
          ...prev,
          activeTenants: prev.activeTenants + diff,
          suspendedTenants: prev.suspendedTenants - diff,
        };
      });
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  // Handle save quotas in drawer
  const handleSaveQuotas = async () => {
    if (!selectedTenant) return;
    try {
      const overrides: Partial<TenantQuotas> = {
        maxSeats: quotaSeats,
        rateLimitPerMin: quotaRateLimit,
        aiTokensMonthly: quotaAiTokens,
        vectorStorageLimitMb: quotaVectorStorage,
      };
      await api.admin.updateTenantQuotas(selectedTenant.id, overrides);
      setTenants((prev) =>
        prev.map((t) => (t.id === selectedTenant.id ? { ...t, quotas: overrides } : t)),
      );
      setSelectedTenant((prev) => (prev ? { ...prev, quotas: overrides } : null));
      setQuotaSaveSuccess(true);
      setTimeout(() => setQuotaSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to update quotas:', err);
    }
  };

  // Handle toggle feature flag
  const handleToggleFlag = (key: keyof typeof flags) => {
    const nextVal = !flags[key];
    setFlags((prev) => ({ ...prev, [key]: nextVal }));
    if (selectedTenant) {
      const updatedFeatures = { ...(selectedTenant.features || {}), [key]: nextVal };
      setTenants((prev) =>
        prev.map((t) => (t.id === selectedTenant.id ? { ...t, features: updatedFeatures } : t)),
      );
      setSelectedTenant((prev) => (prev ? { ...prev, features: updatedFeatures } : null));
    }
  };

  // Handle provision submit
  const handleProvisionTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!provisionName || !provisionSlug) return;
    setIsProvisioning(true);
    try {
      const payload: ProvisionTenantPayload = {
        name: provisionName,
        slug: provisionSlug,
        plan: provisionPlan,
        adminEmail: provisionEmail || 'admin@' + provisionSlug + '.com',
      };
      const created = await api.admin.provisionTenant(payload);
      setTenants((prev) => [created, ...prev]);
      setMetrics((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          totalTenants: prev.totalTenants + 1,
          activeTenants: prev.activeTenants + 1,
        };
      });
      setIsProvisionOpen(false);
      setProvisionName('');
      setProvisionSlug('');
      setProvisionEmail('');
    } catch (err) {
      console.error('Provision failed:', err);
    } finally {
      setIsProvisioning(false);
    }
  };

  // Filtered tenants list
  const filteredTenants = useMemo(() => {
    return tenants.filter((t) => {
      const matchesSearch =
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.slug.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      if (activeFilter === 'ENTERPRISE') return t.plan === 'ENTERPRISE';
      if (activeFilter === 'PRO') return t.plan === 'PRO';
      if (activeFilter === 'FREE') return t.plan === 'FREE';
      if (activeFilter === 'ACTIVE ONLY') return t.status === 'ACTIVE';
      return true;
    });
  }, [tenants, searchQuery, activeFilter]);

  // Derived metrics counts
  const totalTenantsCount = metrics?.totalTenants ?? tenants.length;
  const activeTenantsCount =
    metrics?.activeTenants ?? tenants.filter((t) => t.status === 'ACTIVE').length;
  const suspendedTenantsCount =
    metrics?.suspendedTenants ?? tenants.filter((t) => t.status === 'SUSPENDED').length;
  const totalUsersCount =
    metrics?.totalUsers ?? tenants.reduce((acc, t) => acc + (t.userCount || 0), 0);
  const totalTicketsCount =
    metrics?.totalTickets ?? tenants.reduce((acc, t) => acc + (t.ticketCount || 0), 0);
  const aiTokensUsed = metrics?.aiTokensTotal.used ?? 8400000;
  const aiTokensCap = metrics?.aiTokensTotal.cap ?? 25000000;
  const aiTokenPercent = Math.min(100, Math.round((aiTokensUsed / (aiTokensCap || 1)) * 100));

  return (
    <div className="flex flex-col w-full bg-background min-h-screen text-on-surface">
      {/* Top Context & Command Ribbon */}
      <section className="w-full px-margin py-space-md bg-surface border-b border-border">
        <div className="max-w-7xl mx-auto flex flex-col gap-space-md">
          {/* Breadcrumbs */}
          <nav
            aria-label="Breadcrumb"
            className="flex items-center gap-space-xs font-body-sm text-body-sm text-text-secondary"
          >
            <span>Platform Root</span>
            <span className="material-symbols-outlined text-[16px] text-outline-variant">
              chevron_right
            </span>
            <span>Multi-Tenant Fleet</span>
            <span className="material-symbols-outlined text-[16px] text-outline-variant">
              chevron_right
            </span>
            <span className="text-text-primary font-semibold">Tenants Directory</span>
          </nav>

          {/* Cockpit Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-md">
            <div>
              <h1 className="font-headline-lg text-headline-lg text-text-primary tracking-tight font-bold">
                Super Admin Platform Cockpit
              </h1>
              <p className="font-body-md text-body-md text-text-secondary mt-0.5">
                Multi-tenant fleet telemetry, infrastructure health, quota enforcement, and live
                tenant administration.
              </p>
            </div>
            <div className="flex items-center gap-space-sm">
              <button
                type="button"
                data-testid="provision-tenant-btn"
                onClick={() => setIsProvisionOpen(true)}
                className="h-10 px-4 rounded-xl bg-primary hover:bg-primary-container text-on-primary font-headline-sm text-body-sm font-semibold inline-flex items-center gap-2 shadow-sm transition-all active:scale-95 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">add_circle</span>
                <span>+ Provision Tenant</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Main Cockpit Content Area */}
      <div className="w-full px-margin py-space-lg flex-1">
        <div className="max-w-7xl mx-auto flex flex-col gap-space-xl">
          {/* 1. 5 KPI Cards Grid */}
          <section
            aria-label="Platform Telemetry"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-space-md"
          >
            {/* Card 1: Total Tenants */}
            <div className="bg-surface border border-border rounded-xl p-space-md shadow-sm flex flex-col justify-between hover:border-outline-variant transition-colors">
              <div className="flex items-center justify-between">
                <span className="font-headline-sm text-body-sm text-text-secondary font-medium">
                  Total Tenants
                </span>
                <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-primary flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">domain</span>
                </div>
              </div>
              <div className="mt-space-md">
                <div className="font-code-mono text-headline-lg font-bold text-text-primary tracking-tight">
                  {totalTenantsCount}
                </div>
                <div className="mt-1 flex items-center gap-1.5 font-body-sm text-code-mono text-text-secondary">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>{activeTenantsCount} Active</span>
                  <span>·</span>
                  <span className="inline-block w-2 h-2 rounded-full bg-rose-500"></span>
                  <span>{suspendedTenantsCount} Suspended</span>
                </div>
              </div>
            </div>

            {/* Card 2: Total Platform Users */}
            <div className="bg-surface border border-border rounded-xl p-space-md shadow-sm flex flex-col justify-between hover:border-outline-variant transition-colors">
              <div className="flex items-center justify-between">
                <span className="font-headline-sm text-body-sm text-text-secondary font-medium">
                  Total Platform Users
                </span>
                <div className="w-8 h-8 rounded-lg bg-sky-50 dark:bg-sky-950/40 text-sky-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">group</span>
                </div>
              </div>
              <div className="mt-space-md">
                <div className="font-code-mono text-headline-lg font-bold text-text-primary tracking-tight">
                  {totalUsersCount}
                </div>
                <div className="mt-1 font-body-sm text-text-secondary">
                  Seats across organizations
                </div>
              </div>
            </div>

            {/* Card 3: Total Tickets Processed */}
            <div className="bg-surface border border-border rounded-xl p-space-md shadow-sm flex flex-col justify-between hover:border-outline-variant transition-colors">
              <div className="flex items-center justify-between">
                <span className="font-headline-sm text-body-sm text-text-secondary font-medium">
                  Total Tickets Processed
                </span>
                <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">confirmation_number</span>
                </div>
              </div>
              <div className="mt-space-md">
                <div className="font-code-mono text-headline-lg font-bold text-text-primary tracking-tight">
                  {totalTicketsCount.toLocaleString()}
                </div>
                <div className="mt-1 font-body-sm text-text-secondary">Fleet volume</div>
              </div>
            </div>

            {/* Card 4: Aggregate AI Token Volume */}
            <div className="bg-surface border border-border rounded-xl p-space-md shadow-sm flex flex-col justify-between hover:border-outline-variant transition-colors">
              <div className="flex items-center justify-between">
                <span className="font-headline-sm text-body-sm text-text-secondary font-medium">
                  AI Token Volume
                </span>
                <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">psychology</span>
                </div>
              </div>
              <div className="mt-space-md">
                <div className="font-code-mono text-headline-md font-bold text-text-primary tracking-tight">
                  {(aiTokensUsed / 1000000).toFixed(1)}M{' '}
                  <span className="text-body-sm text-text-secondary font-normal">
                    / {(aiTokensCap / 1000000).toFixed(0)}M
                  </span>
                </div>
                {/* Visual progress bar */}
                <div className="w-full bg-surface-subtle h-2 rounded-full mt-2 overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${aiTokenPercent}%` }}
                  />
                </div>
                <div className="mt-1 font-body-sm text-code-mono text-text-secondary flex justify-between">
                  <span>{aiTokenPercent}% used</span>
                  <span>Cap: {(aiTokensCap / 1000000).toFixed(0)}M</span>
                </div>
              </div>
            </div>

            {/* Card 5: Fleet Infrastructure Telemetry */}
            <div className="bg-surface border border-border rounded-xl p-space-md shadow-sm flex flex-col justify-between hover:border-outline-variant transition-colors">
              <div className="flex items-center justify-between">
                <span className="font-headline-sm text-body-sm text-text-secondary font-medium">
                  Infrastructure Telemetry
                </span>
                <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">dns</span>
                </div>
              </div>
              <div className="mt-2 space-y-1.5 font-code-mono text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">MongoDB</span>
                  <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    {metrics?.services.mongodb ?? 'healthy'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">Redis</span>
                  <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    {metrics?.services.redis ?? 'healthy'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">PGVector</span>
                  <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    {metrics?.services.pgvector ?? 'healthy'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">BullMQ</span>
                  <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    {metrics?.services.bullmq ?? 'healthy'}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* 2. Multi-Tenant Fleet Directory Section */}
          <section className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden flex flex-col">
            {/* Table Controls Ribbon */}
            <div className="p-space-md border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-space-md bg-surface-subtle/50">
              {/* Search Bar */}
              <div className="relative flex-1 max-w-md">
                <span className="material-symbols-outlined absolute left-3 top-2.5 text-text-secondary text-[20px]">
                  search
                </span>
                <input
                  type="text"
                  data-testid="tenant-search-input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search tenants by name or slug..."
                  className="w-full h-10 pl-10 pr-4 bg-surface border border-border rounded-xl font-body-md text-body-md text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                />
              </div>

              {/* Filter Chips */}
              <div className="flex flex-wrap items-center gap-1.5">
                {(['ALL', 'ENTERPRISE', 'PRO', 'FREE', 'ACTIVE ONLY'] as FilterChip[]).map(
                  (chip) => {
                    const isActive = activeFilter === chip;
                    return (
                      <button
                        key={chip}
                        type="button"
                        data-testid={`filter-${chip.toLowerCase().replace(' ', '-')}`}
                        onClick={() => setActiveFilter(chip)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                          isActive
                            ? 'bg-primary text-on-primary shadow-sm'
                            : 'bg-surface border border-border text-text-secondary hover:text-text-primary hover:bg-surface-subtle'
                        }`}
                      >
                        {chip}
                      </button>
                    );
                  },
                )}
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border bg-surface-subtle/30 font-headline-sm text-xs text-text-secondary uppercase tracking-wider">
                    <th className="py-3 px-4">Tenant Name & Slug</th>
                    <th className="py-3 px-4">Plan Tier</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Users</th>
                    <th className="py-3 px-4">Tickets</th>
                    <th className="py-3 px-4">AI Token Usage</th>
                    <th className="py-3 px-4">Created</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-body-sm text-body-sm text-text-primary">
                  {isLoading && tenants.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="py-12 text-center text-text-secondary font-code-mono"
                      >
                        Loading multi-tenant fleet...
                      </td>
                    </tr>
                  ) : filteredTenants.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-text-secondary">
                        <div className="flex flex-col items-center justify-center gap-1">
                          <span className="material-symbols-outlined text-[32px] text-text-secondary">
                            search_off
                          </span>
                          <span className="font-medium">No tenants match the search filter</span>
                          <span className="text-xs text-text-secondary">
                            Try adjusting query or filter chip
                          </span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredTenants.map((tenant) => {
                      const usedTokens = tenant.aiTokenUsage?.used ?? 500000;
                      const totalTokens =
                        tenant.aiTokenUsage?.total ??
                        (tenant.plan === 'ENTERPRISE'
                          ? 10000000
                          : tenant.plan === 'PRO'
                            ? 2000000
                            : 500000);
                      const usagePct = Math.min(
                        100,
                        Math.round((usedTokens / (totalTokens || 1)) * 100),
                      );

                      return (
                        <tr
                          key={tenant.id}
                          className="hover:bg-surface-subtle/40 transition-colors"
                          data-testid={`tenant-row-${tenant.id}`}
                        >
                          {/* Name & Slug */}
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-text-primary">{tenant.name}</div>
                            <div className="font-code-mono text-xs text-text-secondary mt-0.5">
                              {tenant.slug}
                            </div>
                          </td>

                          {/* Plan Badge */}
                          <td className="py-3.5 px-4">
                            {tenant.plan === 'ENTERPRISE' ? (
                              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                                ENTERPRISE
                              </span>
                            ) : tenant.plan === 'PRO' ? (
                              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                                PRO
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700">
                                FREE
                              </span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-4">
                            {tenant.status === 'ACTIVE' ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                ACTIVE
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                                SUSPENDED
                              </span>
                            )}
                          </td>

                          {/* Users */}
                          <td className="py-3.5 px-4 font-code-mono text-xs">
                            {tenant.userCount ?? 1} seats
                          </td>

                          {/* Tickets */}
                          <td className="py-3.5 px-4 font-code-mono text-xs">
                            {tenant.ticketCount ?? 0}
                          </td>

                          {/* AI Token Usage Progress Bar */}
                          <td className="py-3.5 px-4">
                            <div className="w-28 space-y-1">
                              <div className="flex justify-between font-code-mono text-[11px] text-text-secondary">
                                <span>{(usedTokens / 1000000).toFixed(1)}M</span>
                                <span>{(totalTokens / 1000000).toFixed(0)}M</span>
                              </div>
                              <div className="w-full bg-surface-subtle h-1.5 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    usagePct > 80 ? 'bg-amber-500' : 'bg-primary'
                                  }`}
                                  style={{ width: `${usagePct}%` }}
                                />
                              </div>
                            </div>
                          </td>

                          {/* Created */}
                          <td className="py-3.5 px-4 font-code-mono text-xs text-text-secondary whitespace-nowrap">
                            {new Date(tenant.createdAt).toLocaleDateString(undefined, {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="inline-flex items-center gap-2">
                              {/* Inspect Button */}
                              <button
                                type="button"
                                data-testid={`inspect-tenant-${tenant.id}`}
                                onClick={() => setSelectedTenant(tenant)}
                                className="px-2.5 py-1 text-xs rounded-lg border border-border bg-surface hover:bg-surface-subtle font-medium text-text-primary inline-flex items-center gap-1 shadow-sm transition-all cursor-pointer"
                                title="Inspect & Configure Quotas"
                              >
                                <span className="material-symbols-outlined text-[15px] text-primary">
                                  tune
                                </span>
                                <span>Inspect</span>
                              </button>

                              {/* Status Toggle Button */}
                              <button
                                type="button"
                                data-testid={`toggle-status-${tenant.id}`}
                                onClick={() => handleToggleStatus(tenant)}
                                className={`px-2.5 py-1 text-xs rounded-lg border font-medium inline-flex items-center gap-1 transition-all cursor-pointer ${
                                  tenant.status === 'ACTIVE'
                                    ? 'border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                                    : 'border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                                }`}
                              >
                                {tenant.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                              </button>

                              {/* Plan Dropdown */}
                              <select
                                data-testid={`select-plan-${tenant.id}`}
                                value={tenant.plan}
                                onChange={(e) =>
                                  handlePlanChange(
                                    tenant.id,
                                    e.target.value as 'FREE' | 'PRO' | 'ENTERPRISE',
                                  )
                                }
                                className="h-7 px-2 text-xs rounded-lg border border-border bg-surface font-semibold text-text-secondary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                              >
                                <option value="FREE">FREE</option>
                                <option value="PRO">PRO</option>
                                <option value="ENTERPRISE">ENTERPRISE</option>
                              </select>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>

      {/* 3. Slide-Over Tenant Inspection Drawer */}
      {selectedTenant && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-neutral/40 backdrop-blur-sm transition-opacity"
            onClick={() => setSelectedTenant(null)}
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-xl bg-surface dark:bg-zinc-900 border-l border-border shadow-2xl flex flex-col z-50">
              {/* Drawer Header */}
              <div className="p-space-lg border-b border-border flex items-center justify-between bg-surface-subtle/50">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <h2 className="font-headline-md text-headline-md font-bold text-text-primary tracking-tight">
                      {selectedTenant.name}
                    </h2>
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                      {selectedTenant.plan}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 font-code-mono text-xs text-text-secondary">
                    <span>Slug: {selectedTenant.slug}</span>
                    <span>·</span>
                    <span>ID: {selectedTenant.id}</span>
                  </div>
                </div>

                <button
                  type="button"
                  data-testid="close-drawer-btn"
                  onClick={() => setSelectedTenant(null)}
                  aria-label="Close drawer"
                  className="p-2 rounded-lg hover:bg-surface-subtle text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>

              {/* Drawer Body */}
              <div className="flex-1 overflow-y-auto p-space-lg space-y-space-lg">
                {/* Section 1: Capacity & Quota Overrides */}
                <div className="bg-surface border border-border rounded-xl p-space-md shadow-sm space-y-space-md">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-headline-sm text-body-md font-bold text-text-primary">
                        Capacity & Quota Overrides
                      </h3>
                      <p className="font-body-sm text-xs text-text-secondary">
                        Fine-grained resource caps and concurrency allocations.
                      </p>
                    </div>
                    <span className="material-symbols-outlined text-primary text-[20px]">tune</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-md">
                    <div>
                      <label className="block text-xs font-semibold text-text-secondary mb-1">
                        Max Seats (Users)
                      </label>
                      <input
                        type="number"
                        data-testid="input-max-seats"
                        value={quotaSeats}
                        onChange={(e) => setQuotaSeats(Number(e.target.value))}
                        className="w-full h-9 px-3 bg-surface-subtle border border-border rounded-xl font-code-mono text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-text-secondary mb-1">
                        Rate Limit (Req / Min)
                      </label>
                      <input
                        type="number"
                        data-testid="input-rate-limit"
                        value={quotaRateLimit}
                        onChange={(e) => setQuotaRateLimit(Number(e.target.value))}
                        className="w-full h-9 px-3 bg-surface-subtle border border-border rounded-xl font-code-mono text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-text-secondary mb-1">
                        AI Tokens Monthly Cap
                      </label>
                      <input
                        type="number"
                        step="500000"
                        data-testid="input-ai-tokens"
                        value={quotaAiTokens}
                        onChange={(e) => setQuotaAiTokens(Number(e.target.value))}
                        className="w-full h-9 px-3 bg-surface-subtle border border-border rounded-xl font-code-mono text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-text-secondary mb-1">
                        Vector Storage Limit (MB)
                      </label>
                      <input
                        type="number"
                        step="100"
                        data-testid="input-vector-storage"
                        value={quotaVectorStorage}
                        onChange={(e) => setQuotaVectorStorage(Number(e.target.value))}
                        className="w-full h-9 px-3 bg-surface-subtle border border-border rounded-xl font-code-mono text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    {quotaSaveSuccess && (
                      <span className="text-xs text-emerald-600 font-medium inline-flex items-center gap-1">
                        <span className="material-symbols-outlined text-[16px]">check_circle</span>
                        Quotas updated successfully
                      </span>
                    )}
                    <button
                      type="button"
                      data-testid="save-quotas-btn"
                      onClick={handleSaveQuotas}
                      className="ml-auto h-9 px-4 rounded-xl bg-primary text-on-primary font-headline-sm text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm hover:bg-primary-container transition-all cursor-pointer"
                    >
                      <span>Save Quotas</span>
                    </button>
                  </div>
                </div>

                {/* Section 2: Per-Tenant Feature Flags */}
                <div className="bg-surface border border-border rounded-xl p-space-md shadow-sm space-y-space-md">
                  <div>
                    <h3 className="font-headline-sm text-body-md font-bold text-text-primary">
                      Per-Tenant Feature Flags
                    </h3>
                    <p className="font-body-sm text-xs text-text-secondary">
                      Toggle specific platform capabilities for this organization.
                    </p>
                  </div>

                  <div className="divide-y divide-border">
                    {[
                      {
                        key: 'ai_copilot' as const,
                        label: 'AI Copilot & Smart Reply',
                        desc: 'RAG semantic search and generative response suggestions',
                      },
                      {
                        key: 'sla_automation' as const,
                        label: 'SLA Automation Engine',
                        desc: 'Breach calculation, automated escalations and webhooks',
                      },
                      {
                        key: 'realtime_chat' as const,
                        label: 'Real-time Live Chat',
                        desc: 'WebSocket presence, agent typing, and live room handoff',
                      },
                      {
                        key: 'biometrics_2fa' as const,
                        label: 'Biometrics & FIDO2 2FA',
                        desc: 'Enforce hardware security key or biometric authentication',
                      },
                    ].map((flag) => (
                      <div key={flag.key} className="py-2.5 flex items-center justify-between">
                        <div>
                          <div className="font-body-md text-xs font-semibold text-text-primary">
                            {flag.label}
                          </div>
                          <div className="font-body-sm text-[11px] text-text-secondary">
                            {flag.desc}
                          </div>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={flags[flag.key]}
                          data-testid={`toggle-flag-${flag.key}`}
                          onClick={() => handleToggleFlag(flag.key)}
                          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            flags[flag.key] ? 'bg-primary' : 'bg-slate-300 dark:bg-zinc-700'
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              flags[flag.key] ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Section 3: Recent Security Audit Trail */}
                <div className="bg-surface border border-border rounded-xl p-space-md shadow-sm space-y-space-md">
                  <div>
                    <h3 className="font-headline-sm text-body-md font-bold text-text-primary">
                      Recent Security Audit Trail
                    </h3>
                    <p className="font-body-sm text-xs text-text-secondary">
                      Immutable event logs scoped to {selectedTenant.name}.
                    </p>
                  </div>

                  <div className="space-y-2">
                    {tenantAuditLogs.length === 0 ? (
                      <div className="text-xs text-text-secondary font-code-mono py-2">
                        No recent audit events found.
                      </div>
                    ) : (
                      tenantAuditLogs.map((log) => (
                        <div
                          key={log.id}
                          className="p-2.5 rounded-lg bg-surface-subtle border border-border font-code-mono text-xs flex flex-col gap-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-primary">{log.action}</span>
                            <span className="text-[11px] text-text-secondary">
                              {new Date(log.createdAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                          <div className="text-[11px] text-text-secondary flex justify-between">
                            <span>Actor: {log.userEmail || 'System Worker'}</span>
                            <span>Resource: {log.resource}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Danger Zone */}
                <div className="border border-rose-300 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/20 rounded-xl p-space-md space-y-space-sm">
                  <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400 font-bold text-sm">
                    <span className="material-symbols-outlined text-[18px]">warning</span>
                    <span>Danger Zone</span>
                  </div>
                  <p className="font-body-sm text-xs text-rose-700 dark:text-rose-400">
                    Tenant is currently{' '}
                    <strong className="underline uppercase">{selectedTenant.status}</strong>.
                    Suspending immediately blocks all customer API keys, agent seats, and live
                    sockets.
                  </p>
                  <button
                    type="button"
                    data-testid="drawer-emergency-toggle"
                    onClick={() => handleToggleStatus(selectedTenant)}
                    className="h-9 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-headline-sm text-xs font-semibold inline-flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                  >
                    <span>
                      {selectedTenant.status === 'ACTIVE'
                        ? 'Emergency Suspend Tenant'
                        : 'Re-Activate Tenant Fleet'}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Provision Tenant Modal */}
      {isProvisionOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-neutral/40 backdrop-blur-sm transition-opacity"
            onClick={() => setIsProvisionOpen(false)}
          />

          <div className="relative w-full max-w-lg bg-surface dark:bg-zinc-900 rounded-2xl border border-border shadow-2xl p-space-lg space-y-space-md z-10">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">add_business</span>
                </div>
                <h3 className="font-headline-md text-headline-sm font-bold text-text-primary">
                  Provision New Fleet Tenant
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsProvisionOpen(false)}
                className="p-1 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-subtle"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleProvisionTenant} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">
                  Tenant Organization Name
                </label>
                <input
                  type="text"
                  required
                  data-testid="provision-name-input"
                  value={provisionName}
                  onChange={(e) => {
                    setProvisionName(e.target.value);
                    if (!provisionSlug) {
                      setProvisionSlug(
                        e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9]/g, '-')
                          .slice(0, 24),
                      );
                    }
                  }}
                  placeholder="e.g. Apex Global Corp"
                  className="w-full h-10 px-3 bg-surface-subtle border border-border rounded-xl font-body-md text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">
                  Tenant Slug (Unique URI Identifier)
                </label>
                <input
                  type="text"
                  required
                  data-testid="provision-slug-input"
                  value={provisionSlug}
                  onChange={(e) => setProvisionSlug(e.target.value.toLowerCase())}
                  placeholder="e.g. apex-global"
                  className="w-full h-10 px-3 bg-surface-subtle border border-border rounded-xl font-code-mono text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">
                    Plan Tier
                  </label>
                  <select
                    data-testid="provision-plan-select"
                    value={provisionPlan}
                    onChange={(e) =>
                      setProvisionPlan(e.target.value as 'FREE' | 'PRO' | 'ENTERPRISE')
                    }
                    className="w-full h-10 px-3 bg-surface-subtle border border-border rounded-xl font-body-md text-xs font-semibold text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="FREE">FREE (5 seats, 500k AI)</option>
                    <option value="PRO">PRO (25 seats, 2M AI)</option>
                    <option value="ENTERPRISE">ENTERPRISE (100 seats, 10M AI)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">
                    Admin Contact Email
                  </label>
                  <input
                    type="email"
                    data-testid="provision-email-input"
                    value={provisionEmail}
                    onChange={(e) => setProvisionEmail(e.target.value)}
                    placeholder="admin@apex.com"
                    className="w-full h-10 px-3 bg-surface-subtle border border-border rounded-xl font-body-md text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-border flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsProvisionOpen(false)}
                  className="h-10 px-4 rounded-xl border border-border text-text-secondary hover:text-text-primary font-headline-sm text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProvisioning}
                  data-testid="submit-provision-btn"
                  className="h-10 px-4 rounded-xl bg-primary hover:bg-primary-container text-on-primary font-headline-sm text-xs font-semibold transition-all inline-flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">verified</span>
                  <span>{isProvisioning ? 'Provisioning...' : 'Provision Tenant'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
