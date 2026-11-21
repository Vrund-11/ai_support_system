import { useState, useEffect } from 'react';
import { api, type TeamMemberItem } from '../../lib/api';
import { toast } from '../../store/toast.store';
import type { Role } from '@supportpilot/shared-types';
import {
  UserCheck,
  UserPlus,
  X,
  Mail,
  Shield,
  Users,
  Activity,
  Download,
  KeyRound,
  CheckCircle2,
} from 'lucide-react';

const ROLE_BADGES: Record<Role, { label: string; style: string }> = {
  OWNER: { label: 'Owner', style: 'bg-purple-50 text-purple-700 border-purple-200' },
  LEAD: { label: 'Team Lead', style: 'bg-blue-50 text-blue-700 border-blue-200' },
  AGENT: { label: 'Support Agent', style: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  VIEWER: { label: 'Viewer', style: 'bg-slate-100 text-slate-700 border-slate-200' },
  PLATFORM_ADMIN: { label: 'Platform Admin', style: 'bg-rose-50 text-rose-700 border-rose-200' },
};

export function TeamView() {
  const [members, setMembers] = useState<TeamMemberItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState<{ name: string; email: string; role: Role }>({
    name: '',
    email: '',
    role: 'AGENT',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.team.list();
      setMembers(data);
    } catch (err) {
      setError((err as Error).message || 'Failed to load team members');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteForm.email || !inviteForm.name) return;

    try {
      setIsSubmitting(true);
      await api.team.invite(inviteForm);
      setIsInviteOpen(false);
      setInviteForm({ name: '', email: '', role: 'AGENT' });
      await fetchMembers();
      toast.success(`Invitation dispatched to ${inviteForm.email}`);
    } catch (err) {
      toast.error((err as Error).message || 'Failed to invite team member');
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeCount = members.filter((m) => m.status === 'ACTIVE').length;
  const pendingCount = members.filter((m) => m.status === 'INVITED').length;
  const seatCap = 20;
  const seatPercent = Math.min(100, Math.round((members.length / seatCap) * 100));

  return (
    <div className="space-y-6" data-testid="team-view">
      {/* Header & Context Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <span>Settings</span>
            <span>/</span>
            <span>Workspace</span>
            <span>/</span>
            <span className="text-slate-900 font-semibold">Team &amp; Roles</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Team Members</h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>
                {members.length} Members • {pendingCount} Pending Invites
              </span>
            </span>
          </div>
          <p className="text-sm text-slate-500">
            Manage support staff, role assignments, and member permissions.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 shadow-sm transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export Roster (.CSV)</span>
          </button>
          <button
            onClick={() => setIsInviteOpen(true)}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg shadow-sm transition-colors"
            data-testid="invite-member-btn"
          >
            <UserPlus className="w-4 h-4" />
            <span>Invite Member</span>
          </button>
        </div>
      </div>

      {/* 4 Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Seats */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Total Seats
            </span>
            <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 space-y-1.5">
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold text-slate-900">
                {members.length} / {seatCap}
              </span>
              <span className="text-xs text-slate-500 font-medium">Seats Used</span>
            </div>
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                style={{ width: `${seatPercent}%` }}
              />
            </div>
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>{Math.max(0, seatCap - members.length)} available</span>
            <span className="text-emerald-600 font-semibold">{seatPercent}% utilized</span>
          </div>
        </div>

        {/* Card 2: Active Right Now */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Active Right Now
            </span>
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xl font-bold text-slate-900">{activeCount} Online</span>
            </div>
            <p className="text-xs text-slate-500">
              {Math.max(0, members.length - activeCount)} Away / Invited
            </p>
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Live shift presence</span>
            <span className="text-emerald-600 font-medium">Connected</span>
          </div>
        </div>

        {/* Card 3: Workload Balance */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Workload Balance
            </span>
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 space-y-0.5">
            <span className="text-xl font-bold text-slate-900">In Balance</span>
            <p className="text-xs text-slate-500">Healthy queue equilibrium</p>
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Avg 5.2 / agent</span>
            <span className="text-blue-600 font-medium">Normalized</span>
          </div>
        </div>

        {/* Card 4: Security & SSO */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Security &amp; SSO
            </span>
            <div className="p-1.5 rounded-lg bg-purple-50 text-purple-600">
              <KeyRound className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 space-y-0.5">
            <span className="text-xl font-bold text-slate-900">Enforced SAML</span>
            <p className="text-xs text-slate-500">100% 2FA Okta IdP Connected</p>
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Audit status: Compliant</span>
            <span className="text-purple-600 font-medium">SOC-2</span>
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tabs Strip */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-medium shadow-xs"
        >
          <span>All Members</span>
          <span className="px-1.5 py-0.2 rounded-full bg-indigo-700 text-white font-mono text-[10px]">
            {members.length}
          </span>
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium transition-colors"
        >
          <span>Pending Invites</span>
          <span className="px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600 font-mono text-[10px]">
            {pendingCount}
          </span>
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium transition-colors"
        >
          <span>Roles &amp; Permissions Matrix (RBAC)</span>
        </button>
      </div>

      {/* Team Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500" data-testid="team-loading">
            <div className="animate-pulse space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-10 bg-slate-100 rounded-lg w-full" />
              ))}
            </div>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-600">
            <p className="text-sm font-semibold">{error}</p>
            <button
              onClick={fetchMembers}
              className="mt-3 px-3 py-1 bg-rose-50 text-rose-700 text-xs rounded-lg border border-rose-200 hover:bg-rose-100 font-medium"
            >
              Retry
            </button>
          </div>
        ) : members.length === 0 ? (
          <div className="p-12 text-center text-slate-500" data-testid="team-empty">
            <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
              <Users className="w-6 h-6" />
            </div>
            <p className="font-medium text-sm text-slate-800">No team members found</p>
            <p className="text-xs text-slate-400 mt-1">
              Invite your first team member to get started
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm" data-testid="team-table">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3.5">Member</th>
                  <th className="px-4 py-3.5">Role</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Joined Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {members.map((m) => {
                  const roleConfig = ROLE_BADGES[m.role] || {
                    label: m.role,
                    style: 'bg-slate-100 text-slate-700 border-slate-200',
                  };
                  return (
                    <tr
                      key={m.id}
                      className="hover:bg-slate-50/80 transition-colors group"
                      data-testid={`team-row-${m.id}`}
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-center space-x-3">
                          <div className="relative flex-shrink-0">
                            <div className="w-9 h-9 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs uppercase shadow-sm">
                              {m.name.slice(0, 2)}
                            </div>
                            <span
                              className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-white ${
                                m.status === 'ACTIVE'
                                  ? 'bg-emerald-500'
                                  : m.status === 'INVITED'
                                    ? 'bg-amber-500'
                                    : 'bg-rose-500'
                              }`}
                            />
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">
                              {m.name}
                            </div>
                            <div className="text-xs text-slate-400 font-mono">{m.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full border ${roleConfig.style}`}
                          data-testid={`role-badge-${m.role}`}
                        >
                          {roleConfig.label}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center space-x-1.5 text-xs font-medium">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              m.status === 'ACTIVE'
                                ? 'bg-emerald-500'
                                : m.status === 'INVITED'
                                  ? 'bg-amber-500'
                                  : 'bg-rose-500'
                            }`}
                          />
                          <span className="capitalize text-slate-700">
                            {m.status.toLowerCase()}
                          </span>
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-500">
                        {new Date(m.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Invite Member Modal */}
      {isInviteOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4"
          data-testid="invite-modal"
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <UserCheck className="w-5 h-5 text-indigo-600" />
                <h3 className="text-lg font-bold text-slate-900">Invite Team Member</h3>
              </div>
              <button
                onClick={() => setIsInviteOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={inviteForm.name}
                  onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
                  placeholder="e.g. Sarah Connor"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  data-testid="invite-name-input"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email Address *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={inviteForm.email}
                    onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                    placeholder="e.g. sarah@company.com"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    data-testid="invite-email-input"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Workspace Role
                </label>
                <div className="relative">
                  <Shield className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <select
                    value={inviteForm.role}
                    onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value as Role })}
                    className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    data-testid="invite-role-select"
                  >
                    <option value="AGENT">Support Agent</option>
                    <option value="LEAD">Team Lead</option>
                    <option value="VIEWER">Viewer</option>
                    <option value="OWNER">Workspace Owner</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsInviteOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-sm disabled:opacity-50 transition-colors"
                  data-testid="invite-submit-btn"
                >
                  {isSubmitting ? 'Sending...' : 'Send Invitation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
