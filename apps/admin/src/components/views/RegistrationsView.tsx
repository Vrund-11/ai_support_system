import { useEffect, useState, useMemo } from 'react';
import { Search, UserCheck, ShieldCheck, Clock, Building2, CheckCircle2 } from 'lucide-react';
import { adminApi, type RegistrationItem } from '../../lib/admin-api';

export function RegistrationsView() {
  const [registrations, setRegistrations] = useState<RegistrationItem[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [approvedIds, setApprovedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    adminApi
      .getRegistrations()
      .then((data) => setRegistrations(data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return registrations;
    return registrations.filter(
      (r) =>
        r.orgName.toLowerCase().includes(q) ||
        r.slug.toLowerCase().includes(q) ||
        r.adminEmail.toLowerCase().includes(q) ||
        r.tier.toLowerCase().includes(q),
    );
  }, [registrations, search]);

  const handleApprove = (id: string) => {
    setApprovedIds((prev) => new Set(prev).add(id));
    setRegistrations((prev) =>
      prev.map((r) => (r.id === id ? { ...r, verificationStatus: 'VERIFIED' } : r)),
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>New Organization Registrations</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              {filtered.length} total
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time onboarding feed: verify organization credentials, inspect slugs, and approve
            tenant access.
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            data-testid="registrations-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by org, slug, email..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/60 text-slate-400 uppercase font-mono text-[11px] border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Organization</th>
                <th className="px-4 py-3">Slug</th>
                <th className="px-4 py-3">Admin Email</th>
                <th className="px-4 py-3">Tier</th>
                <th className="px-4 py-3">Registered</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500 font-mono">
                    Loading registrations...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500 font-mono">
                    No registrations found matching "{search}"
                  </td>
                </tr>
              ) : (
                filtered.map((r) => {
                  const isApproved = approvedIds.has(r.id) || r.verificationStatus === 'VERIFIED';
                  return (
                    <tr
                      key={r.id}
                      data-testid={`reg-row-${r.id}`}
                      className="hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-indigo-400 shrink-0" />
                          <span className="font-semibold text-white">{r.orgName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-slate-400">{r.slug}</td>
                      <td className="px-4 py-3.5 text-slate-200">{r.adminEmail}</td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                            r.tier === 'ENTERPRISE'
                              ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                              : r.tier === 'PRO'
                                ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                                : 'bg-slate-800 text-slate-300 border border-slate-700'
                          }`}
                        >
                          {r.tier}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-slate-400 font-mono text-[11px]">
                        {new Date(r.createdAt).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="px-4 py-3.5">
                        {isApproved ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium font-mono">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            VERIFIED
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-amber-400 font-medium font-mono">
                            <Clock className="w-3.5 h-3.5" />
                            PENDING
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right space-x-2">
                        {!isApproved && (
                          <button
                            type="button"
                            data-testid={`approve-btn-${r.id}`}
                            onClick={() => handleApprove(r.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[11px] font-medium transition-colors cursor-pointer"
                          >
                            <UserCheck className="w-3 h-3" />
                            <span>Approve</span>
                          </button>
                        )}
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-800/80 text-slate-400 text-[11px] font-mono">
                          <ShieldCheck className="w-3 h-3 text-indigo-400" />
                          <span>Inspect</span>
                        </span>
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
  );
}
