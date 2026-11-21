import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { toast } from '../../store/toast.store';
import type {
  RuleDto,
  RuleTriggerEvent,
  RuleActionType,
  SlaPolicy,
  TicketPriority,
} from '@supportpilot/shared-types';
import { Trash2, AlertCircle } from 'lucide-react';

const DEFAULT_SLA_POLICIES: Record<TicketPriority, SlaPolicy> = {
  URGENT: { firstResponseMin: 15, resolveMin: 120 },
  HIGH: { firstResponseMin: 60, resolveMin: 480 },
  MEDIUM: { firstResponseMin: 240, resolveMin: 1440 },
  LOW: { firstResponseMin: 480, resolveMin: 2880 },
};

export function AutomationView() {
  const [activeTab, setActiveTab] = useState<'rules' | 'sla'>('rules');

  // Rules Engine State
  const [rules, setRules] = useState<RuleDto[]>([]);
  const [loadingRules, setLoadingRules] = useState(true);
  const [rulesError, setRulesError] = useState<string | null>(null);

  const [isCreateRuleOpen, setIsCreateRuleOpen] = useState(false);
  const [newRule, setNewRule] = useState<{
    name: string;
    description: string;
    event: RuleTriggerEvent;
    conditionField: 'status' | 'priority' | 'tag';
    operator: 'EQUALS' | 'NOT_EQUALS' | 'CONTAINS';
    conditionValue: string;
    actionType: RuleActionType;
    actionTarget: string;
  }>({
    name: '',
    description: '',
    event: 'TICKET_CREATED',
    conditionField: 'priority',
    operator: 'EQUALS',
    conditionValue: 'HIGH',
    actionType: 'ADD_TAG',
    actionTarget: 'urgent',
  });

  // SLA State
  const [slaPolicies, setSlaPolicies] =
    useState<Record<TicketPriority, SlaPolicy>>(DEFAULT_SLA_POLICIES);
  const [loadingSla, setLoadingSla] = useState(true);
  const [slaSaved, setSlaSaved] = useState(false);

  const fetchRules = async () => {
    try {
      setLoadingRules(true);
      setRulesError(null);
      const data = await api.automation.listRules();
      setRules(data);
    } catch (err) {
      setRulesError((err as Error).message || 'Failed to load rules');
    } finally {
      setLoadingRules(false);
    }
  };

  const fetchSla = async () => {
    try {
      setLoadingSla(true);
      const policies = await api.automation.getSlaPolicies();
      if (policies && Object.keys(policies).length > 0) {
        setSlaPolicies(policies);
      }
    } catch {
      // Fallback to default SLA policies
      setSlaPolicies(DEFAULT_SLA_POLICIES);
    } finally {
      setLoadingSla(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'rules') {
      fetchRules();
    } else {
      fetchSla();
    }
  }, [activeTab]);

  const handleToggleRule = async (rule: RuleDto) => {
    try {
      const updated = await api.automation.toggleRule(rule.id, !rule.enabled);
      setRules((prev) =>
        prev.map((r) => (r.id === rule.id ? { ...r, enabled: updated.enabled } : r)),
      );
    } catch (err) {
      toast.error((err as Error).message || 'Failed to toggle rule');
    }
  };

  const handleDeleteRule = async (id: string) => {
    try {
      await api.automation.deleteRule(id);
      setRules((prev) => prev.filter((r) => r.id !== id));
      toast.success('Automation rule deleted.');
    } catch (err) {
      toast.error((err as Error).message || 'Failed to delete rule');
    }
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRule.name.trim()) return;

    try {
      await api.automation.createRule({
        name: newRule.name.trim(),
        description: newRule.description.trim() || undefined,
        event: newRule.event,
        conditionLogic: 'AND',
        conditions: [
          {
            field: newRule.conditionField,
            operator: newRule.operator,
            value: newRule.conditionValue,
          },
        ],
        actions: [
          {
            type: newRule.actionType,
            target: newRule.actionTarget,
          },
        ],
        enabled: true,
        order: rules.length + 1,
      });

      setIsCreateRuleOpen(false);
      setNewRule({
        name: '',
        description: '',
        event: 'TICKET_CREATED',
        conditionField: 'priority',
        operator: 'EQUALS',
        conditionValue: 'HIGH',
        actionType: 'ADD_TAG',
        actionTarget: 'urgent',
      });
      await fetchRules();
      toast.success('Automation rule created successfully.');
    } catch (err) {
      toast.error((err as Error).message || 'Failed to create automation rule');
    }
  };

  const handleSaveSla = async () => {
    try {
      await api.automation.updateSlaPolicies(slaPolicies);
      setSlaSaved(true);
      toast.success('SLA targets updated successfully.');
      setTimeout(() => setSlaSaved(false), 3000);
    } catch (err) {
      toast.error((err as Error).message || 'Failed to save SLA policies');
    }
  };

  return (
    <div className="space-y-space-lg" data-testid="automation-view">
      {/* Top Command & Breadcrumb Strip */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md p-space-lg rounded-xl bg-surface border border-border shadow-sm">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-space-xs font-body-sm text-body-sm text-text-secondary">
            <span>Settings</span>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <span className="text-text-primary font-medium">Automations &amp; SLA Policies</span>
          </div>
          <div className="flex items-center flex-wrap gap-space-sm mt-0.5">
            <h1 className="font-headline-lg text-headline-lg text-text-primary tracking-tight">
              Automations &amp; SLA Policies
            </h1>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-ticket-open-bg text-ticket-open-text font-body-sm text-body-sm font-medium border border-ticket-open-text/20">
              <span className="w-1.5 h-1.5 rounded-full bg-ticket-open-text animate-pulse"></span>
              Policy Engine: Active (v3.2)
            </div>
          </div>
          <p className="font-body-md text-body-md text-text-secondary max-w-3xl">
            Configure automated routing, priority response time commitments, escalation triggers,
            and operational calendars across all enterprise channels.
          </p>
        </div>

        {/* Action Toolbar */}
        <div className="flex items-center gap-space-sm shrink-0 flex-wrap">
          <button
            type="button"
            onClick={() => setIsCreateRuleOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary hover:bg-primary-container text-on-primary font-headline-sm text-headline-sm transition-all shadow-sm cursor-pointer"
            data-testid="create-rule-btn"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            <span>Create Rule</span>
          </button>
        </div>
      </div>

      {/* Top KPI & Operational Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
        <div className="p-space-md rounded-xl bg-surface border border-border shadow-sm flex items-center justify-between">
          <div>
            <div className="font-body-sm text-body-sm text-text-secondary">
              Overall SLA Adherence
            </div>
            <div className="font-headline-lg text-headline-lg text-text-primary font-bold mt-1">
              98.42%
            </div>
            <div className="font-body-sm text-body-sm text-ticket-open-text flex items-center gap-1 mt-1 font-medium">
              <span className="material-symbols-outlined text-[16px]">trending_up</span> +0.8% past
              30 days
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-ticket-open-bg text-ticket-open-text flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[24px]">verified</span>
          </div>
        </div>
        <div className="p-space-md rounded-xl bg-surface border border-border shadow-sm flex items-center justify-between">
          <div>
            <div className="font-body-sm text-body-sm text-text-secondary">Avg Target Headroom</div>
            <div className="font-headline-lg text-headline-lg text-text-primary font-bold mt-1">
              42.6%
            </div>
            <div className="font-body-sm text-body-sm text-text-secondary mt-1">
              SLA buffer before breach
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-ticket-new-bg text-ticket-new-text flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[24px]">speed</span>
          </div>
        </div>
        <div className="p-space-md rounded-xl bg-surface border border-border shadow-sm flex items-center justify-between">
          <div>
            <div className="font-body-sm text-body-sm text-text-secondary">Active Breaches</div>
            <div className="font-headline-lg text-headline-lg text-ticket-open-text font-bold mt-1">
              0
            </div>
            <div className="font-body-sm text-body-sm text-text-secondary mt-1">
              Zero pending escalations
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-surface-subtle text-text-secondary flex items-center justify-center shrink-0 border border-border">
            <span className="material-symbols-outlined text-[24px]">shield</span>
          </div>
        </div>
        <div className="p-space-md rounded-xl bg-surface border border-border shadow-sm flex items-center justify-between">
          <div>
            <div className="font-body-sm text-body-sm text-text-secondary">
              Automations Fired (7d)
            </div>
            <div className="font-headline-lg text-headline-lg text-text-primary font-bold mt-1">
              14,290
            </div>
            <div className="font-body-sm text-body-sm text-primary flex items-center gap-1 mt-1 font-medium">
              <span className="material-symbols-outlined text-[16px]">bolt</span> 89.2h rep time
              saved
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-primary-fixed text-primary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[24px]">smart_toy</span>
          </div>
        </div>
      </div>

      {/* Primary Sub-Navigation Tabs Bar */}
      <div className="w-full px-space-sm bg-surface border border-border rounded-xl flex items-center justify-between overflow-x-auto shadow-xs">
        <nav className="flex items-center gap-space-lg" data-testid="automation-tabs">
          <button
            onClick={() => setActiveTab('rules')}
            className={`inline-flex items-center gap-2 py-3.5 border-b-2 font-headline-sm text-headline-sm font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'rules'
                ? 'border-primary text-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
            data-testid="tab-rules"
          >
            <span className="material-symbols-outlined text-[20px]">alt_route</span>
            <span>Rules Engine</span>
            <span className="px-2 py-0.5 rounded-full bg-primary-fixed text-primary font-code-mono text-code-mono font-medium">
              {rules.length} Rules
            </span>
          </button>
          <button
            onClick={() => setActiveTab('sla')}
            className={`inline-flex items-center gap-2 py-3.5 border-b-2 font-headline-sm text-headline-sm font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'sla'
                ? 'border-primary text-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
            data-testid="tab-sla"
          >
            <span className="material-symbols-outlined text-[20px]">timer</span>
            <span>SLA Policies</span>
            <span className="px-2 py-0.5 rounded-full bg-surface-subtle text-text-secondary font-code-mono text-code-mono">
              4 Active Tiers
            </span>
          </button>
        </nav>
      </div>

      {/* Tab Content: Rules Engine */}
      {activeTab === 'rules' && (
        <div className="space-y-4">
          <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
            {loadingRules ? (
              <div className="p-8 text-center text-text-secondary" data-testid="rules-loading">
                <div className="animate-pulse space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-6 bg-surface-subtle rounded w-full"></div>
                  ))}
                </div>
              </div>
            ) : rulesError ? (
              <div className="p-8 text-center text-priority-urgent">
                <p className="font-body-md font-semibold">{rulesError}</p>
                <button
                  onClick={fetchRules}
                  className="mt-3 px-3 py-1 bg-priority-urgent/10 text-priority-urgent text-body-sm rounded-lg border border-priority-urgent/20 hover:bg-priority-urgent/20 cursor-pointer"
                >
                  Retry
                </button>
              </div>
            ) : rules.length === 0 ? (
              <div className="p-12 text-center text-text-secondary" data-testid="rules-empty">
                <p className="font-medium font-body-md">No automation rules configured</p>
                <p className="font-body-sm text-body-sm text-text-secondary mt-1">
                  Create a rule to automatically triage, route, or tag incoming tickets.
                </p>
              </div>
            ) : (
              <table
                className="w-full text-left font-body-sm text-body-sm"
                data-testid="rules-table"
              >
                <thead className="bg-surface-subtle border-b border-border font-code-mono text-text-secondary uppercase text-[11px]">
                  <tr>
                    <th className="px-space-lg py-3 font-medium">Rule</th>
                    <th className="px-space-md py-3 font-medium">Trigger Event</th>
                    <th className="px-space-md py-3 font-medium">Conditions</th>
                    <th className="px-space-md py-3 font-medium">Actions</th>
                    <th className="px-space-md py-3 font-medium text-center">Status</th>
                    <th className="px-space-lg py-3 font-medium text-right">Delete</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-text-primary">
                  {rules.map((rule) => (
                    <tr
                      key={rule.id}
                      className="hover:bg-surface-subtle transition-colors"
                      data-testid={`rule-row-${rule.id}`}
                    >
                      <td className="px-space-lg py-3.5">
                        <div className="font-semibold text-text-primary">{rule.name}</div>
                        {rule.description && (
                          <div className="font-body-sm text-[11px] text-text-secondary">
                            {rule.description}
                          </div>
                        )}
                      </td>
                      <td className="px-space-md py-3.5">
                        <span className="font-code-mono text-[11px] bg-primary-fixed/40 text-primary px-2 py-0.5 rounded border border-primary/20 font-medium">
                          {rule.event}
                        </span>
                      </td>
                      <td className="px-space-md py-3.5 font-code-mono text-[11px]">
                        {rule.conditions.map((c, i) => (
                          <div key={i} className="flex items-center gap-1">
                            <span className="text-primary font-semibold">{c.field}</span>
                            <span className="text-text-secondary">{c.operator}</span>
                            <span className="text-text-primary font-bold">{String(c.value)}</span>
                          </div>
                        ))}
                      </td>
                      <td className="px-space-md py-3.5 font-code-mono text-[11px]">
                        {rule.actions.map((a, i) => (
                          <div key={i} className="flex items-center gap-1">
                            <span className="text-ticket-open-text font-semibold">{a.type}</span>
                            <span className="text-text-primary">{a.target || ''}</span>
                          </div>
                        ))}
                      </td>
                      <td className="px-space-md py-3.5 text-center">
                        <button
                          onClick={() => handleToggleRule(rule)}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${
                            rule.enabled ? 'bg-primary' : 'bg-slate-300'
                          }`}
                          data-testid={`toggle-rule-${rule.id}`}
                        >
                          <span
                            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                              rule.enabled ? 'translate-x-4.5' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </td>
                      <td className="px-space-lg py-3.5 text-right">
                        <button
                          onClick={() => handleDeleteRule(rule.id)}
                          className="p-1 text-text-secondary hover:text-priority-urgent transition-colors cursor-pointer"
                          data-testid={`delete-rule-${rule.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Tab Content: SLA Policies */}
      {activeTab === 'sla' && (
        <div className="space-y-6" data-testid="sla-policies-tab">
          <div className="bg-surface p-space-lg rounded-xl border border-border shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
              <div>
                <h2 className="font-headline-md text-headline-md font-bold text-text-primary">
                  Default Enterprise SLA Policy Matrix
                </h2>
                <p className="font-body-sm text-body-sm text-text-secondary mt-0.5">
                  Configure maximum allowed minutes before an SLA target is breached.
                </p>
              </div>
              <button
                onClick={handleSaveSla}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-container text-on-primary font-body-sm text-body-sm font-semibold rounded-xl shadow-sm transition-all cursor-pointer"
                data-testid="save-sla-btn"
              >
                <span className="material-symbols-outlined text-[18px]">save</span>
                <span>{slaSaved ? 'Policies Saved!' : 'Save SLA Policies'}</span>
              </button>
            </div>

            {loadingSla ? (
              <div className="p-8 text-center text-text-secondary font-body-sm">
                Loading SLA policies...
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table
                  className="w-full text-left font-body-sm text-body-sm"
                  data-testid="sla-policies-table"
                >
                  <thead className="bg-surface-subtle border-b border-border font-code-mono uppercase text-[11px] text-text-secondary">
                    <tr>
                      <th className="px-space-lg py-3 font-medium">Priority Tier</th>
                      <th className="px-space-md py-3 font-medium">First Response Target</th>
                      <th className="px-space-md py-3 font-medium">Resolution Target</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-text-primary">
                    {(['URGENT', 'HIGH', 'MEDIUM', 'LOW'] as TicketPriority[]).map((p) => {
                      const policy = slaPolicies[p] || DEFAULT_SLA_POLICIES[p];
                      return (
                        <tr
                          key={p}
                          data-testid={`sla-row-${p}`}
                          className="hover:bg-surface-subtle transition-colors"
                        >
                          <td className="px-space-lg py-3.5 font-semibold">
                            <span
                              className={`px-2.5 py-1 rounded-full font-code-mono text-xs font-semibold ${
                                p === 'URGENT'
                                  ? 'bg-priority-urgent/10 text-priority-urgent border border-priority-urgent/20'
                                  : p === 'HIGH'
                                    ? 'bg-priority-high/10 text-priority-high border border-priority-high/20'
                                    : p === 'MEDIUM'
                                      ? 'bg-primary-fixed/40 text-primary border border-primary/20'
                                      : 'bg-surface-subtle text-text-secondary border border-border'
                              }`}
                            >
                              {p}
                            </span>
                          </td>
                          <td className="px-space-md py-3.5">
                            <div className="flex items-center space-x-2">
                              <input
                                type="number"
                                min={1}
                                value={policy.firstResponseMin}
                                onChange={(e) =>
                                  setSlaPolicies({
                                    ...slaPolicies,
                                    [p]: {
                                      ...policy,
                                      firstResponseMin: Number(e.target.value) || 0,
                                    },
                                  })
                                }
                                className="w-24 px-2.5 py-1 text-body-md border border-border rounded-lg bg-surface-subtle text-text-primary focus:ring-1 focus:ring-primary focus:outline-none"
                                data-testid={`sla-response-${p}`}
                              />
                              <span className="font-code-mono text-[11px] text-text-secondary">
                                mins ({Math.round((policy.firstResponseMin / 60) * 10) / 10}h)
                              </span>
                            </div>
                          </td>
                          <td className="px-space-md py-3.5">
                            <div className="flex items-center space-x-2">
                              <input
                                type="number"
                                min={1}
                                value={policy.resolveMin}
                                onChange={(e) =>
                                  setSlaPolicies({
                                    ...slaPolicies,
                                    [p]: {
                                      ...policy,
                                      resolveMin: Number(e.target.value) || 0,
                                    },
                                  })
                                }
                                className="w-24 px-2 py-1 text-sm border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                                data-testid={`sla-resolve-${p}`}
                              />
                              <span className="text-xs text-slate-400">
                                mins ({Math.round((policy.resolveMin / 60) * 10) / 10}h)
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="pt-4 flex items-center justify-between border-t border-border">
              {slaSaved ? (
                <div className="flex items-center gap-2 text-body-sm font-body-sm text-ticket-open-text font-semibold">
                  <span className="material-symbols-outlined text-[18px]">check_circle</span>
                  <span>SLA Policies saved successfully</span>
                </div>
              ) : (
                <div className="font-body-sm text-body-sm text-text-secondary">
                  Values are evaluated automatically upon ticket creation across enterprise queues.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Rule Modal */}
      {isCreateRuleOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          data-testid="create-rule-modal"
        >
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Create Automation Rule</h3>
              <button
                onClick={() => setIsCreateRuleOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <AlertCircle className="w-5 h-5 hidden" />
                <span className="text-xl leading-none">&times;</span>
              </button>
            </div>

            <form onSubmit={handleCreateRule} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Rule Name *
                </label>
                <input
                  type="text"
                  required
                  value={newRule.name}
                  onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                  placeholder="e.g. Escalate VIP tickets"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  data-testid="rule-name-input"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Trigger Event
                </label>
                <select
                  value={newRule.event}
                  onChange={(e) =>
                    setNewRule({ ...newRule, event: e.target.value as RuleTriggerEvent })
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="TICKET_CREATED">When Ticket is Created</option>
                  <option value="TICKET_UPDATED">When Ticket is Updated</option>
                  <option value="MESSAGE_RECEIVED">When Message is Received</option>
                </select>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2">
                <div className="text-xs font-semibold text-indigo-700 uppercase">IF Condition:</div>
                <div className="grid grid-cols-3 gap-2">
                  <select
                    value={newRule.conditionField}
                    onChange={(e) =>
                      setNewRule({ ...newRule, conditionField: e.target.value as any })
                    }
                    className="text-xs p-1.5 border border-slate-300 rounded bg-white"
                  >
                    <option value="priority">Priority</option>
                    <option value="status">Status</option>
                    <option value="tag">Tag</option>
                  </select>
                  <select
                    value={newRule.operator}
                    onChange={(e) => setNewRule({ ...newRule, operator: e.target.value as any })}
                    className="text-xs p-1.5 border border-slate-300 rounded bg-white"
                  >
                    <option value="EQUALS">EQUALS</option>
                    <option value="NOT_EQUALS">NOT EQUALS</option>
                    <option value="CONTAINS">CONTAINS</option>
                  </select>
                  <input
                    type="text"
                    value={newRule.conditionValue}
                    onChange={(e) => setNewRule({ ...newRule, conditionValue: e.target.value })}
                    placeholder="Value..."
                    className="text-xs p-1.5 border border-slate-300 rounded bg-white"
                  />
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2">
                <div className="text-xs font-semibold text-emerald-700 uppercase">THEN Action:</div>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={newRule.actionType}
                    onChange={(e) => setNewRule({ ...newRule, actionType: e.target.value as any })}
                    className="text-xs p-1.5 border border-slate-300 rounded bg-white"
                  >
                    <option value="ADD_TAG">Add Tag</option>
                    <option value="ASSIGN">Assign to Agent</option>
                    <option value="SET_PRIORITY">Set Priority</option>
                    <option value="SET_STATUS">Set Status</option>
                  </select>
                  <input
                    type="text"
                    value={newRule.actionTarget}
                    onChange={(e) => setNewRule({ ...newRule, actionTarget: e.target.value })}
                    placeholder="Target or value..."
                    className="text-xs p-1.5 border border-slate-300 rounded bg-white"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsCreateRuleOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-sm"
                  data-testid="submit-rule-btn"
                >
                  Create Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
