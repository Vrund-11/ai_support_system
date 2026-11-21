import { useEffect, useState } from 'react';
import { CreditCard, DollarSign, TrendingUp, Calendar, ArrowUpRight, Zap } from 'lucide-react';
import { adminApi, type SubscriptionItem } from '../../lib/admin-api';

export function SubscriptionsView() {
  const [subscriptions, setSubscriptions] = useState<SubscriptionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi
      .getSubscriptions()
      .then((data) => setSubscriptions(data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const totalMrr = subscriptions.reduce((acc, s) => acc + (s.amountMonthly || 0), 0);
  const enterpriseCount = subscriptions.filter((s) => s.plan === 'ENTERPRISE').length;
  const proCount = subscriptions.filter((s) => s.plan === 'PRO').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>Paid Subscriptions & MRR Breakdown</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              STRIPE CONNECTED
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Active paid subscriptions across PRO ($49/mo) and ENTERPRISE ($299/mo) contracts with
            renewal schedules.
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400 uppercase">Tracked MRR</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-white">
            ${totalMrr.toLocaleString()}
            <span className="text-xs text-slate-400 font-normal ml-1">/mo</span>
          </div>
          <div className="mt-1 text-[11px] text-emerald-400 font-mono">
            100% collecting via Stripe auto-charge
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400 uppercase">Enterprise Contracts</span>
            <Zap className="w-4 h-4 text-purple-400" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-white">
            {enterpriseCount}
            <span className="text-xs text-slate-400 font-normal ml-1">accounts ($299/mo)</span>
          </div>
          <div className="mt-1 text-[11px] text-purple-400 font-mono">
            ${enterpriseCount * 299} / mo combined
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400 uppercase">Pro Subscriptions</span>
            <TrendingUp className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-white">
            {proCount}
            <span className="text-xs text-slate-400 font-normal ml-1">accounts ($49/mo)</span>
          </div>
          <div className="mt-1 text-[11px] text-indigo-400 font-mono">
            ${proCount * 49} / mo combined
          </div>
        </div>
      </div>

      {/* Subscriptions List */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl shadow-xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-indigo-400" />
            <span className="text-sm font-semibold text-white">Active Subscriber Feed</span>
          </div>
          <span className="text-xs font-mono text-slate-400">
            {subscriptions.length} active billable accounts
          </span>
        </div>

        <div className="divide-y divide-slate-800/60 font-sans">
          {loading ? (
            <div className="p-8 text-center text-slate-500 font-mono text-xs">
              Loading subscriber ledger...
            </div>
          ) : (
            subscriptions.map((sub) => (
              <div
                key={sub.id}
                data-testid={`sub-item-${sub.id}`}
                className="p-4 hover:bg-slate-800/40 transition-colors flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white text-sm">{sub.tenantName}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        sub.plan === 'ENTERPRISE'
                          ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                          : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                      }`}
                    >
                      {sub.plan} &bull; ${sub.amountMonthly}/mo
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-slate-400 flex items-center gap-3">
                    <span>Billing: {sub.customerBillingEmail}</span>
                    <span>&bull;</span>
                    <span className="flex items-center gap-1 font-mono">
                      <Calendar className="w-3 h-3 text-slate-500" />
                      Next renewal: {sub.renewalDate}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                    <ArrowUpRight className="w-3 h-3" />
                    <span>{sub.lastBillingEvent}</span>
                  </div>
                </div>

                {/* Upgrade timeline */}
                <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80 text-[11px] font-mono text-slate-300 min-w-[260px]">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 font-bold">
                    Plan Upgrade Timeline
                  </div>
                  {(sub.upgradeTimeline || []).map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-slate-400">
                      <span className="text-slate-500">{item.date}:</span>
                      <span className="text-slate-200">{item.event}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
