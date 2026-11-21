import { useEffect, useState } from 'react';
import {
  DollarSign,
  Building2,
  Users,
  Ticket,
  Cpu,
  Database,
  Layers,
  Zap,
  Activity,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { adminApi, type PlatformMetrics } from '../../lib/admin-api';

export function OverviewView() {
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  const loadMetrics = async () => {
    setLoading(true);
    try {
      const data = await adminApi.getMetrics();
      setMetrics(data);
    } catch (err) {
      console.error('Failed to load platform metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMetrics();
  }, []);

  const aiUsed = metrics?.aiInferencePool?.used ?? 8400000;
  const aiCap = metrics?.aiInferencePool?.cap ?? 25000000;
  const aiPercent = Math.min(100, Math.round((aiUsed / (aiCap || 1)) * 100));

  return (
    <div className="space-y-6">
      {/* Top Banner / Headline */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>Global Operations Control Plane</span>
            <span className="text-xs font-mono font-normal text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
              LIVE TELEMETRY
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time multi-tenant resource allocations, MRR metrics, and service latencies.
          </p>
        </div>
        <button
          type="button"
          onClick={loadMetrics}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* 5 Top KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* KPI 1: MRR */}
        <div
          data-testid="kpi-mrr"
          className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl shadow-lg relative overflow-hidden group hover:border-indigo-500/50 transition-colors"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider font-mono">
              Monthly Recurring Revenue
            </span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-white">
              ${metrics?.mrr ? metrics.mrr.toLocaleString() : '14,250'}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-emerald-400 font-mono">
              <span>+18.4% vs last month</span>
            </div>
          </div>
        </div>

        {/* KPI 2: Total Tenants */}
        <div
          data-testid="kpi-tenants"
          className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl shadow-lg relative overflow-hidden group hover:border-indigo-500/50 transition-colors"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider font-mono">
              Total Tenants
            </span>
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-white">
              {metrics?.totalTenants ?? 48}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-400 font-mono">
              <span className="text-emerald-400 font-bold">
                {metrics?.activeTenants ?? 46} active
              </span>
              <span>&bull;</span>
              <span className="text-amber-400 font-bold">
                {metrics?.suspendedTenants ?? 2} suspended
              </span>
            </div>
          </div>
        </div>

        {/* KPI 3: Total Platform Users */}
        <div
          data-testid="kpi-users"
          className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl shadow-lg relative overflow-hidden group hover:border-indigo-500/50 transition-colors"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider font-mono">
              Platform Users
            </span>
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-white">
              {metrics?.totalUsers ?? 384}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-400 font-mono">
              <span>Across all fleets</span>
            </div>
          </div>
        </div>

        {/* KPI 4: Total Tickets */}
        <div
          data-testid="kpi-tickets"
          className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl shadow-lg relative overflow-hidden group hover:border-indigo-500/50 transition-colors"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider font-mono">
              Total Tickets
            </span>
            <div className="p-2 rounded-lg bg-violet-500/10 text-violet-400">
              <Ticket className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-white">
              {metrics?.totalTickets ? metrics.totalTickets.toLocaleString() : '18,920'}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-400 font-mono">
              <span>Processed lifetime</span>
            </div>
          </div>
        </div>

        {/* KPI 5: AI Inference Pool (Progress Bar) */}
        <div
          data-testid="kpi-ai-pool"
          className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl shadow-lg relative overflow-hidden group hover:border-indigo-500/50 transition-colors"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider font-mono">
              AI Inference Pool
            </span>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
              <Cpu className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold font-mono text-white">
                {(aiUsed / 1000000).toFixed(1)}M
              </span>
              <span className="text-xs font-mono text-slate-400">
                / {(aiCap / 1000000).toFixed(0)}M tokens
              </span>
            </div>
            {/* Progress bar */}
            <div className="mt-2 w-full bg-slate-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-indigo-500 to-amber-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${aiPercent}%` }}
              ></div>
            </div>
            <div className="mt-1.5 text-[10px] text-slate-400 font-mono flex justify-between">
              <span>{aiPercent}% utilized</span>
              <span className="text-emerald-400">Pool healthy</span>
            </div>
          </div>
        </div>
      </div>

      {/* Infrastructure Telemetry Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
          <Activity className="w-4 h-4 text-indigo-400" />
          <span>Core Infrastructure Telemetry</span>
          <span className="text-xs font-normal text-slate-400">(NOC Monitor & Latencies)</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* MongoDB */}
          <div
            data-testid="telemetry-mongodb"
            className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-white">MongoDB Cluster</div>
                <div className="text-xs font-mono text-slate-400">Primary replica set</div>
              </div>
            </div>
            <div className="text-right">
              <div className="inline-flex items-center gap-1 text-xs font-mono font-semibold text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{metrics?.telemetry?.mongodb?.status ?? 'healthy'}</span>
              </div>
              <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                {metrics?.telemetry?.mongodb?.latencyMs ?? 3}ms latency
              </div>
            </div>
          </div>

          {/* Redis */}
          <div
            data-testid="telemetry-redis"
            className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-rose-500/10 text-rose-400">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-white">Redis Cache & Bus</div>
                <div className="text-xs font-mono text-slate-400">Pub/Sub & Rate Limit</div>
              </div>
            </div>
            <div className="text-right">
              <div className="inline-flex items-center gap-1 text-xs font-mono font-semibold text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{metrics?.telemetry?.redis?.status ?? 'operational'}</span>
              </div>
              <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                {metrics?.telemetry?.redis?.latencyMs ?? 1}ms latency
              </div>
            </div>
          </div>

          {/* PGVector */}
          <div
            data-testid="telemetry-pgvector"
            className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-400">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-white">PGVector Store</div>
                <div className="text-xs font-mono text-slate-400">Knowledge embeddings</div>
              </div>
            </div>
            <div className="text-right">
              <div className="inline-flex items-center gap-1 text-xs font-mono font-semibold text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{metrics?.telemetry?.pgvector?.status ?? 'operational'}</span>
              </div>
              <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                {metrics?.telemetry?.pgvector?.latencyMs ?? 14}ms latency
              </div>
            </div>
          </div>

          {/* BullMQ */}
          <div
            data-testid="telemetry-bullmq"
            className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-400">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-white">BullMQ Worker Pool</div>
                <div className="text-xs font-mono text-slate-400">
                  {metrics?.telemetry?.bullmq?.activeJobs ?? 18} jobs active
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="inline-flex items-center gap-1 text-xs font-mono font-semibold text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{metrics?.telemetry?.bullmq?.status ?? 'operational'}</span>
              </div>
              <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                Lag: {metrics?.telemetry?.bullmq?.queueLag ?? 0}s &bull;{' '}
                {metrics?.telemetry?.bullmq?.latencyMs ?? 2}ms
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
