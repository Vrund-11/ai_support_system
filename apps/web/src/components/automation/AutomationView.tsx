import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import type {
  RuleDto,
  RuleTriggerEvent,
  RuleActionType,
  SlaPolicy,
  TicketPriority,
} from '@supportpilot/shared-types';
import { Zap, Clock, Plus, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';

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
      alert((err as Error).message || 'Failed to toggle rule');
    }
  };

  const handleDeleteRule = async (id: string) => {
    if (!confirm('Are you sure you want to delete this automation rule?')) return;
    try {
      await api.automation.deleteRule(id);
      setRules((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      alert((err as Error).message || 'Failed to delete rule');
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
    } catch (err) {
      alert((err as Error).message || 'Failed to create automation rule');
    }
  };

  const handleSaveSla = async () => {
    try {
      await api.automation.updateSlaPolicies(slaPolicies);
      setSlaSaved(true);
      setTimeout(() => setSlaSaved(false), 3000);
    } catch (err) {
      alert((err as Error).message || 'Failed to save SLA policies');
    }
  };

  return (
    <div className="space-y-6" data-testid="automation-view">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">Automation & SLAs</h1>
        <p className="text-sm text-slate-500">
          Streamline ticket routing, tagging, and establish target response times.
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex space-x-4" data-testid="automation-tabs">
          <button
            onClick={() => setActiveTab('rules')}
            className={`flex items-center space-x-2 py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'rules'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
            data-testid="tab-rules"
          >
            <Zap className="w-4 h-4" />
            <span>Rules Engine</span>
          </button>
          <button
            onClick={() => setActiveTab('sla')}
            className={`flex items-center space-x-2 py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'sla'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
            data-testid="tab-sla"
          >
            <Clock className="w-4 h-4" />
            <span>SLA Policies</span>
          </button>
        </nav>
      </div>

      {/* Tab Content: Rules Engine */}
      {activeTab === 'rules' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
              Trigger Rules
            </h2>
            <button
              onClick={() => setIsCreateRuleOpen(true)}
              className="inline-flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg shadow-sm transition-colors"
              data-testid="create-rule-btn"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Rule</span>
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {loadingRules ? (
              <div className="p-8 text-center text-slate-500" data-testid="rules-loading">
                <div className="animate-pulse space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-6 bg-slate-200 rounded w-full"></div>
                  ))}
                </div>
              </div>
            ) : rulesError ? (
              <div className="p-8 text-center text-rose-600">
                <p className="text-sm font-semibold">{rulesError}</p>
                <button
                  onClick={fetchRules}
                  className="mt-3 px-3 py-1 bg-rose-50 text-rose-700 text-xs rounded border border-rose-200 hover:bg-rose-100"
                >
                  Retry
                </button>
              </div>
            ) : rules.length === 0 ? (
              <div className="p-12 text-center text-slate-500" data-testid="rules-empty">
                <p className="font-medium text-sm">No automation rules configured</p>
                <p className="text-xs text-slate-400 mt-1">
                  Create a rule to automatically triage, route, or tag incoming tickets.
                </p>
              </div>
            ) : (
              <table className="w-full text-left text-sm" data-testid="rules-table">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Rule</th>
                    <th className="px-4 py-3">Trigger Event</th>
                    <th className="px-4 py-3">Conditions</th>
                    <th className="px-4 py-3">Actions</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-right">Delete</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rules.map((rule) => (
                    <tr
                      key={rule.id}
                      className="hover:bg-slate-50 transition-colors"
                      data-testid={`rule-row-${rule.id}`}
                    >
                      <td className="px-4 py-3.5">
                        <div className="font-medium text-slate-900">{rule.name}</div>
                        {rule.description && (
                          <div className="text-xs text-slate-400">{rule.description}</div>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="font-mono text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                          {rule.event}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-600">
                        {rule.conditions.map((c, i) => (
                          <div key={i} className="font-mono text-[11px]">
                            <span className="text-indigo-600 font-semibold">{c.field}</span>{' '}
                            <span className="text-slate-400">{c.operator}</span>{' '}
                            <span className="text-slate-900">{String(c.value)}</span>
                          </div>
                        ))}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-600">
                        {rule.actions.map((a, i) => (
                          <div key={i} className="font-mono text-[11px]">
                            <span className="text-emerald-600 font-semibold">{a.type}</span>{' '}
                            <span className="text-slate-900">{a.target || ''}</span>
                          </div>
                        ))}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <button
                          onClick={() => handleToggleRule(rule)}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                            rule.enabled ? 'bg-indigo-600' : 'bg-slate-300'
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
                      <td className="px-4 py-3.5 text-right">
                        <button
                          onClick={() => handleDeleteRule(rule.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
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
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Target Response & Resolution Times
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Configure maximum allowed minutes before an SLA target is breached.
              </p>
            </div>

            {loadingSla ? (
              <div className="p-8 text-center text-slate-500">Loading SLA policies...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm" data-testid="sla-policies-table">
                  <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Priority Level</th>
                      <th className="px-4 py-3">First Response Target (minutes)</th>
                      <th className="px-4 py-3">Resolution Target (minutes)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(['URGENT', 'HIGH', 'MEDIUM', 'LOW'] as TicketPriority[]).map((p) => {
                      const policy = slaPolicies[p] || DEFAULT_SLA_POLICIES[p];
                      return (
                        <tr key={p} data-testid={`sla-row-${p}`}>
                          <td className="px-4 py-3 font-semibold text-xs">
                            <span
                              className={`px-2 py-0.5 rounded font-mono ${
                                p === 'URGENT'
                                  ? 'bg-rose-50 text-rose-700'
                                  : p === 'HIGH'
                                    ? 'bg-amber-50 text-amber-700'
                                    : p === 'MEDIUM'
                                      ? 'bg-blue-50 text-blue-700'
                                      : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {p}
                            </span>
                          </td>
                          <td className="px-4 py-3">
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
                                className="w-24 px-2 py-1 text-sm border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                                data-testid={`sla-response-${p}`}
                              />
                              <span className="text-xs text-slate-400">
                                mins ({Math.round((policy.firstResponseMin / 60) * 10) / 10}h)
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
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

            <div className="pt-4 flex items-center justify-between border-t border-slate-100">
              {slaSaved ? (
                <div className="flex items-center space-x-1.5 text-xs text-emerald-600 font-semibold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>SLA Policies saved successfully</span>
                </div>
              ) : (
                <div className="text-xs text-slate-400">
                  Values are evaluated automatically upon ticket creation.
                </div>
              )}
              <button
                onClick={handleSaveSla}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
                data-testid="save-sla-btn"
              >
                Save SLA Policies
              </button>
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
