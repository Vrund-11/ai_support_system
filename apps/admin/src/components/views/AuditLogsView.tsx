import { useEffect, useState } from 'react';
import { ShieldCheck, AlertTriangle, Terminal, RefreshCw } from 'lucide-react';
import { adminApi, type SuperAdminAuditLog } from '../../lib/admin-api';

export function AuditLogsView() {
  const [logs, setLogs] = useState<SuperAdminAuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await adminApi.getAuditLogs();
      setLogs(data);
    } catch (err) {
      console.error('Failed to load audit trail:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>Platform Security Audit Trail</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              IMMUTABLE WORM LOG
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Global security and privileged administrative events across all multi-tenant nodes and
            platform operators.
          </p>
        </div>

        <button
          type="button"
          onClick={loadLogs}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Audit Log Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl shadow-xl overflow-hidden font-mono">
        <div className="p-3 bg-slate-950 border-b border-slate-800 text-xs text-slate-400 flex items-center gap-2">
          <Terminal className="w-4 h-4 text-indigo-400" />
          <span>platform-audit-stream: stdout (WORM append-only)</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/40 text-slate-400 uppercase text-[11px] border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Resource Target</th>
                <th className="px-4 py-3">IP Address</th>
                <th className="px-4 py-3 text-right">Severity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    Loading security trail...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    No security events recorded.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr
                    key={log.id}
                    data-testid={`audit-row-${log.id}`}
                    className="hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                      {new Date(log.timestamp).toISOString().replace('T', ' ').slice(0, 19)}
                    </td>
                    <td className="px-4 py-3 text-indigo-300 font-semibold">{log.actor}</td>
                    <td className="px-4 py-3 text-white font-bold">{log.action}</td>
                    <td className="px-4 py-3 text-slate-300">{log.resource}</td>
                    <td className="px-4 py-3 text-slate-400">{log.ipAddress}</td>
                    <td className="px-4 py-3 text-right">
                      {log.severity === 'CRITICAL' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                          <AlertTriangle className="w-3 h-3" />
                          CRITICAL
                        </span>
                      ) : log.severity === 'WARN' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                          <AlertTriangle className="w-3 h-3" />
                          WARN
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          <ShieldCheck className="w-3 h-3" />
                          INFO
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
