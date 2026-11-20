import { useState, useEffect } from 'react';
import { api, type TeamMemberItem } from '../../lib/api';
import type { Role } from '@supportpilot/shared-types';
import { UserCheck, UserPlus, X, Mail, Shield } from 'lucide-react';

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
    } catch (err) {
      alert((err as Error).message || 'Failed to invite team member');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="team-view">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Team Members</h1>
          <p className="text-sm text-slate-500">
            Manage support staff, role assignments, and member permissions.
          </p>
        </div>
        <button
          onClick={() => setIsInviteOpen(true)}
          className="inline-flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-3.5 py-2 rounded-lg shadow-sm transition-colors"
          data-testid="invite-member-btn"
        >
          <UserPlus className="w-4 h-4" />
          <span>Invite Member</span>
        </button>
      </div>

      {/* Team Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500" data-testid="team-loading">
            <div className="animate-pulse space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-6 bg-slate-200 rounded w-full"></div>
              ))}
            </div>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-600">
            <p className="text-sm font-semibold">{error}</p>
            <button
              onClick={fetchMembers}
              className="mt-3 px-3 py-1 bg-rose-50 text-rose-700 text-xs rounded border border-rose-200 hover:bg-rose-100"
            >
              Retry
            </button>
          </div>
        ) : members.length === 0 ? (
          <div className="p-12 text-center text-slate-500" data-testid="team-empty">
            <p className="font-medium text-sm">No team members found</p>
            <p className="text-xs text-slate-400 mt-1">
              Invite your first team member to get started
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm" data-testid="team-table">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Member</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Joined Date</th>
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
                      className="hover:bg-slate-50 transition-colors"
                      data-testid={`team-row-${m.id}`}
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs uppercase">
                            {m.name.slice(0, 2)}
                          </div>
                          <div>
                            <div className="font-medium text-slate-900">{m.name}</div>
                            <div className="text-xs text-slate-400">{m.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full border ${roleConfig.style}`}
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
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          data-testid="invite-modal"
        >
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <UserCheck className="w-5 h-5 text-indigo-600" />
                <h3 className="text-lg font-bold text-slate-900">Invite Team Member</h3>
              </div>
              <button
                onClick={() => setIsInviteOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
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
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-sm disabled:opacity-50"
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
