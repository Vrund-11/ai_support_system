import { useState, useEffect } from 'react';
import { api, type TeamMemberItem } from '../../lib/api';
import { toast } from '../../store/toast.store';
import type { Role } from '@supportpilot/shared-types';

const ROLE_BADGES: Record<Role, { label: string; style: string; icon: string }> = {
  OWNER: {
    label: 'Workspace Owner',
    style: 'bg-primary text-on-primary border-primary/20',
    icon: 'military_tech',
  },
  LEAD: {
    label: 'Team Lead',
    style: 'bg-secondary-fixed text-on-secondary-fixed-variant border-secondary/20',
    icon: 'shield_person',
  },
  AGENT: {
    label: 'Support Agent',
    style: 'bg-ticket-open-bg text-ticket-open-text border-ticket-open-text/20',
    icon: 'support_agent',
  },
  VIEWER: {
    label: 'Viewer',
    style: 'bg-surface-subtle text-text-secondary border-border',
    icon: 'visibility',
  },
  PLATFORM_ADMIN: {
    label: 'Platform Admin',
    style: 'bg-error-container text-on-error-container border-error/20',
    icon: 'admin_panel_settings',
  },
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
    <div className="space-y-space-lg" data-testid="team-view">
      {/* Header & Command Strip */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md bg-surface p-space-md rounded-xl border border-border shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-space-xs font-body-sm text-body-sm text-text-secondary">
            <span>Settings</span>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <span>Workspace</span>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <span className="text-text-primary font-medium">Team &amp; Roles</span>
          </div>
          <div className="flex flex-wrap items-center gap-space-sm">
            <h1 className="font-headline-lg text-headline-lg font-bold text-text-primary tracking-tight">
              Team Members
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-body-sm text-body-sm font-medium bg-ticket-open-bg text-ticket-open-text border border-ticket-open-text/20">
              <span className="w-1.5 h-1.5 rounded-full bg-ticket-open-text animate-pulse" />
              <span>
                {members.length} Members • {pendingCount} Pending Invites
              </span>
            </span>
          </div>
          <p className="font-body-md text-body-md text-text-secondary">
            Manage support staff, role assignments, workload thresholds, and member permissions.
          </p>
        </div>

        <div className="flex items-center gap-space-sm flex-wrap shrink-0">
          <button
            type="button"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-surface border border-border text-text-primary font-headline-sm text-headline-sm hover:bg-surface-subtle transition-all shadow-xs"
          >
            <span
              className="material-symbols-outlined text-[18px] text-text-secondary"
              aria-hidden="true"
            >
              download
            </span>
            <span>Export Roster (.CSV)</span>
          </button>
          <button
            onClick={() => setIsInviteOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary hover:bg-primary-container text-on-primary font-headline-sm text-headline-sm shadow-xs transition-all cursor-pointer"
            data-testid="invite-member-btn"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              person_add
            </span>
            <span>Invite Member</span>
          </button>
        </div>
      </div>

      {/* 4 Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
        {/* Card 1: Total Seats */}
        <div className="bg-surface p-space-md rounded-xl border border-border shadow-xs flex flex-col justify-between gap-space-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="font-body-sm text-body-sm text-text-secondary font-medium uppercase tracking-wider">
              Total Seats
            </span>
            <div className="p-2 rounded-lg bg-primary-fixed text-primary">
              <span className="material-symbols-outlined text-[18px]">group</span>
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex items-baseline gap-2">
              <span className="font-headline-lg text-headline-lg text-text-primary font-bold">
                {members.length} / {seatCap}
              </span>
              <span className="font-body-sm text-body-sm text-text-secondary">Seats Used</span>
            </div>
            <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-primary h-full rounded-full transition-all duration-300"
                style={{ width: `${seatPercent}%` }}
              />
            </div>
          </div>
          <div className="pt-2 border-t border-border flex items-center justify-between font-body-sm text-body-sm text-text-secondary">
            <span>{Math.max(0, seatCap - members.length)} available</span>
            <span className="text-ticket-open-text font-medium">{seatPercent}% utilized</span>
          </div>
        </div>

        {/* Card 2: Active Right Now */}
        <div className="bg-surface p-space-md rounded-xl border border-border shadow-xs flex flex-col justify-between gap-space-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="font-body-sm text-body-sm text-text-secondary font-medium uppercase tracking-wider">
              Active Right Now
            </span>
            <div className="p-2 rounded-lg bg-ticket-open-bg text-ticket-open-text">
              <span className="material-symbols-outlined text-[18px]">sensors</span>
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-ticket-open-text opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-ticket-open-text" />
              </span>
              <span className="font-headline-lg text-headline-lg text-text-primary font-bold">
                {activeCount} Online
              </span>
            </div>
            <p className="font-body-sm text-body-sm text-text-secondary">
              {Math.max(0, members.length - activeCount)} Away / Invited
            </p>
          </div>
          <div className="pt-2 border-t border-border flex items-center justify-between font-body-sm text-body-sm text-text-secondary">
            <span>Live shift presence</span>
            <span className="text-ticket-open-text font-medium">Connected</span>
          </div>
        </div>

        {/* Card 3: Workload Balance */}
        <div className="bg-surface p-space-md rounded-xl border border-border shadow-xs flex flex-col justify-between gap-space-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="font-body-sm text-body-sm text-text-secondary font-medium uppercase tracking-wider">
              Workload Balance
            </span>
            <div className="p-2 rounded-lg bg-ticket-new-bg text-ticket-new-text">
              <span className="material-symbols-outlined text-[18px]">assignment_turned_in</span>
            </div>
          </div>
          <div className="space-y-1">
            <span className="font-headline-lg text-headline-lg text-text-primary font-bold">
              In Balance
            </span>
            <p className="font-body-sm text-body-sm text-text-secondary">
              Healthy queue equilibrium
            </p>
          </div>
          <div className="pt-2 border-t border-border flex items-center justify-between font-body-sm text-body-sm text-text-secondary">
            <span>Avg 5.2 / agent</span>
            <span className="font-code-mono text-ticket-open-text bg-ticket-open-bg px-2 py-0.5 rounded text-[11px]">
              Normalized
            </span>
          </div>
        </div>

        {/* Card 4: Security & SSO */}
        <div className="bg-surface p-space-md rounded-xl border border-border shadow-xs flex flex-col justify-between gap-space-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="font-body-sm text-body-sm text-text-secondary font-medium uppercase tracking-wider">
              Security &amp; SSO
            </span>
            <div className="p-2 rounded-lg bg-ticket-onhold-bg text-ticket-onhold-text">
              <span className="material-symbols-outlined text-[18px]">verified_user</span>
            </div>
          </div>
          <div className="space-y-1">
            <span className="font-headline-lg text-headline-lg text-text-primary font-bold">
              Enforced SAML
            </span>
            <p className="font-body-sm text-body-sm text-text-secondary">
              100% 2FA Okta IdP Connected
            </p>
          </div>
          <div className="pt-2 border-t border-border flex items-center justify-between font-body-sm text-body-sm text-text-secondary">
            <span>Audit status: Compliant</span>
            <span className="font-code-mono text-primary font-medium">SOC-2</span>
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tabs Strip */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface shadow-xs text-primary font-semibold font-body-md text-body-md border border-border"
        >
          <span className="material-symbols-outlined text-[18px]">badge</span>
          <span>All Members</span>
          <span className="px-2 py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed font-code-mono text-code-mono">
            {members.length}
          </span>
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-text-secondary hover:text-text-primary hover:bg-surface/60 font-body-md text-body-md transition-all"
        >
          <span className="material-symbols-outlined text-[18px]">mail</span>
          <span>Pending Invites</span>
          <span className="px-2 py-0.5 rounded-full bg-surface-container text-text-secondary font-code-mono text-code-mono">
            {pendingCount}
          </span>
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-text-secondary hover:text-text-primary hover:bg-surface/60 font-body-md text-body-md transition-all"
        >
          <span className="material-symbols-outlined text-[18px]">shield_person</span>
          <span>Roles &amp; Permissions Matrix (RBAC)</span>
        </button>
      </div>

      {/* Team Table */}
      <div className="bg-surface rounded-xl border border-border shadow-xs overflow-hidden">
        {loading ? (
          <div
            className="p-8 text-center text-text-secondary font-body-sm"
            data-testid="team-loading"
          >
            <div className="animate-pulse space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-10 bg-surface-subtle rounded-lg w-full" />
              ))}
            </div>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-error">
            <p className="font-body-md text-body-md font-semibold">{error}</p>
            <button
              onClick={fetchMembers}
              className="mt-3 px-3 py-1 bg-error-container text-on-error-container font-body-sm text-body-sm rounded-lg border border-error/20 hover:bg-error-container/80 font-medium"
            >
              Retry
            </button>
          </div>
        ) : members.length === 0 ? (
          <div className="p-12 text-center text-text-secondary" data-testid="team-empty">
            <div className="w-12 h-12 mx-auto rounded-full bg-surface-subtle flex items-center justify-center text-text-secondary mb-3">
              <span className="material-symbols-outlined text-[24px]">group</span>
            </div>
            <p className="font-headline-sm text-headline-sm font-semibold text-text-primary">
              No team members found
            </p>
            <p className="font-body-sm text-body-sm text-text-secondary mt-1">
              Invite your first team member to get started
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left font-body-md text-body-md" data-testid="team-table">
              <thead className="bg-surface-subtle border-b border-border text-[11px] font-code-mono uppercase tracking-wider text-text-secondary">
                <tr>
                  <th className="px-space-md py-3 font-medium">Member</th>
                  <th className="px-space-md py-3 font-medium">Role</th>
                  <th className="px-space-md py-3 font-medium">Status</th>
                  <th className="px-space-md py-3 font-medium">Joined Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {members.map((m) => {
                  const roleConfig = ROLE_BADGES[m.role] || {
                    label: m.role,
                    style: 'bg-surface-subtle text-text-secondary border-border',
                    icon: 'badge',
                  };
                  return (
                    <tr
                      key={m.id}
                      className="hover:bg-surface-subtle/70 transition-colors group"
                      data-testid={`team-row-${m.id}`}
                    >
                      <td className="px-space-md py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="relative flex-shrink-0">
                            <div className="w-9 h-9 rounded-full bg-primary-fixed text-primary flex items-center justify-center font-bold font-code-mono text-xs uppercase shadow-xs">
                              {m.name.slice(0, 2)}
                            </div>
                            <span
                              className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-surface ${
                                m.status === 'ACTIVE'
                                  ? 'bg-ticket-open-text'
                                  : m.status === 'INVITED'
                                    ? 'bg-priority-high'
                                    : 'bg-error'
                              }`}
                            />
                          </div>
                          <div>
                            <div className="font-semibold text-text-primary group-hover:text-primary transition-colors">
                              {m.name}
                            </div>
                            <div className="font-code-mono text-code-mono text-text-secondary">
                              {m.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-space-md py-3.5">
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full border ${roleConfig.style}`}
                          data-testid={`role-badge-${m.role}`}
                        >
                          <span className="material-symbols-outlined text-[13px]">
                            {roleConfig.icon}
                          </span>
                          <span>{roleConfig.label}</span>
                        </span>
                      </td>
                      <td className="px-space-md py-3.5">
                        <span className="inline-flex items-center gap-1.5 font-body-sm text-body-sm font-medium">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              m.status === 'ACTIVE'
                                ? 'bg-ticket-open-text'
                                : m.status === 'INVITED'
                                  ? 'bg-priority-high'
                                  : 'bg-error'
                            }`}
                          />
                          <span className="capitalize text-text-primary">
                            {m.status.toLowerCase()}
                          </span>
                        </span>
                      </td>
                      <td className="px-space-md py-3.5 font-code-mono text-code-mono text-text-secondary">
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
          <div className="bg-surface rounded-2xl shadow-2xl max-w-md w-full p-space-lg space-y-space-md border border-border animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-space-xs border-b border-border">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[22px]">
                  person_add
                </span>
                <h3 className="font-headline-md text-headline-md font-bold text-text-primary">
                  Invite Team Member
                </h3>
              </div>
              <button
                onClick={() => setIsInviteOpen(false)}
                className="text-text-secondary hover:text-text-primary p-1 rounded-lg hover:bg-surface-subtle transition-colors cursor-pointer"
                aria-label="Close"
              >
                <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                  close
                </span>
              </button>
            </div>

            <form onSubmit={handleInvite} className="space-y-space-md">
              <div>
                <label className="block font-body-sm text-body-sm font-semibold text-text-primary mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={inviteForm.name}
                  onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
                  placeholder="e.g. Sarah Connor"
                  className="w-full px-3 py-2 bg-surface-subtle border border-border rounded-xl font-body-md text-body-md text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                  data-testid="invite-name-input"
                />
              </div>

              <div>
                <label className="block font-body-sm text-body-sm font-semibold text-text-primary mb-1">
                  Email Address *
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-2.5 text-text-secondary text-[18px]">
                    mail
                  </span>
                  <input
                    type="email"
                    required
                    value={inviteForm.email}
                    onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                    placeholder="e.g. sarah@supportpilot.io"
                    className="w-full pl-9 pr-3 py-2 bg-surface-subtle border border-border rounded-xl font-body-md text-body-md text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                    data-testid="invite-email-input"
                  />
                </div>
              </div>

              <div>
                <label className="block font-body-sm text-body-sm font-semibold text-text-primary mb-1">
                  Workspace Role
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-2.5 text-text-secondary text-[18px]">
                    shield
                  </span>
                  <select
                    value={inviteForm.role}
                    onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value as Role })}
                    className="w-full pl-9 pr-3 py-2 bg-surface-subtle border border-border rounded-xl font-body-md text-body-md text-text-primary focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all cursor-pointer"
                    data-testid="invite-role-select"
                  >
                    <option value="AGENT">Support Agent</option>
                    <option value="LEAD">Team Lead</option>
                    <option value="VIEWER">Viewer</option>
                    <option value="OWNER">Workspace Owner</option>
                  </select>
                </div>
              </div>

              <div className="pt-space-xs flex items-center justify-end gap-space-sm border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsInviteOpen(false)}
                  className="px-4 py-2 font-body-sm text-body-sm font-medium text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-primary hover:bg-primary-container text-on-primary font-headline-sm text-headline-sm font-semibold rounded-xl shadow-xs disabled:opacity-50 transition-all cursor-pointer"
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
