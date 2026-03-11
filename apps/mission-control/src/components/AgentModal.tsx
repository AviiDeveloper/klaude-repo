'use client';

import { useEffect, useState } from 'react';
import { X, Save, Trash2 } from 'lucide-react';
import { useMissionControl } from '@/lib/store';
import type { Agent, AgentEvalRun, AgentPerformanceProfile, AgentStatus } from '@/lib/types';

type CostActionEstimate = {
  action_key: string;
  label: string;
  count: number;
  unit_cost_usd: number;
  estimated_cost_usd: number;
};

type AgentCostSummary = {
  agent_id: string;
  agent_name: string;
  role: string;
  workspace_id: string;
  estimated_total_usd: number;
  actual_total_usd: number;
  delta_usd: number;
  action_breakdown: CostActionEstimate[];
  actual_breakdown: Array<{
    provider: string;
    model: string;
    requests: number;
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
    cost_usd: number;
  }>;
};

interface AgentModalProps {
  agent?: Agent;
  onClose: () => void;
  workspaceId?: string;
  onAgentCreated?: (agentId: string) => void;
}

const EMOJI_OPTIONS = ['🤖', '🦞', '💻', '🔍', '✍️', '🎨', '📊', '🧠', '⚡', '🚀', '🎯', '🔧'];

export function AgentModal({ agent, onClose, workspaceId, onAgentCreated }: AgentModalProps) {
  const { addAgent, updateAgent, agents } = useMissionControl();
  const [activeTab, setActiveTab] = useState<'info' | 'performance' | 'soul' | 'user' | 'agents'>('info');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [perfLoading, setPerfLoading] = useState(false);
  const [perfError, setPerfError] = useState<string | null>(null);
  const [performanceProfile, setPerformanceProfile] = useState<AgentPerformanceProfile | null>(null);
  const [recentRuns, setRecentRuns] = useState<AgentEvalRun[]>([]);
  const [costSummary, setCostSummary] = useState<AgentCostSummary | null>(null);

  const [form, setForm] = useState({
    name: agent?.name || '',
    role: agent?.role || '',
    description: agent?.description || '',
    avatar_emoji: agent?.avatar_emoji || '🤖',
    status: agent?.status || 'standby' as AgentStatus,
    is_master: agent?.is_master || false,
    soul_md: agent?.soul_md || '',
    user_md: agent?.user_md || '',
    agents_md: agent?.agents_md || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const url = agent ? `/api/agents/${agent.id}` : '/api/agents';
      const method = agent ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          workspace_id: workspaceId || agent?.workspace_id || 'default',
        }),
      });

      if (res.ok) {
        const savedAgent = await res.json();
        if (agent) {
          updateAgent(savedAgent);
        } else {
          addAgent(savedAgent);
          // Notify parent if callback provided (e.g., for inline agent creation)
          if (onAgentCreated) {
            onAgentCreated(savedAgent.id);
          }
        }
        onClose();
      }
    } catch (error) {
      console.error('Failed to save agent:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!agent || !confirm(`Delete ${agent.name}?`)) return;

    try {
      const res = await fetch(`/api/agents/${agent.id}`, { method: 'DELETE' });
      if (res.ok) {
        // Remove from store
        useMissionControl.setState((state) => ({
          agents: state.agents.filter((a) => a.id !== agent.id),
          selectedAgent: state.selectedAgent?.id === agent.id ? null : state.selectedAgent,
        }));
        onClose();
      }
    } catch (error) {
      console.error('Failed to delete agent:', error);
    }
  };

  const tabs = [
    { id: 'info', label: 'Info' },
    { id: 'performance', label: 'Performance' },
    { id: 'soul', label: 'SOUL.md' },
    { id: 'user', label: 'USER.md' },
    { id: 'agents', label: 'AGENTS.md' },
  ] as const;

  useEffect(() => {
    if (!agent || activeTab !== 'performance') return;

    const load = async () => {
      setPerfLoading(true);
      setPerfError(null);
      try {
        const res = await fetch(`/api/evals/agent/${agent.id}/profile`);
        if (!res.ok) {
          const payload = await res.json().catch(() => ({ error: 'Failed to load performance profile' }));
          throw new Error(payload.error || 'Failed to load performance profile');
        }
        const payload = (await res.json()) as {
          profile: AgentPerformanceProfile | null;
          recent_runs: AgentEvalRun[];
        };
        setPerformanceProfile(payload.profile || null);
        setRecentRuns(Array.isArray(payload.recent_runs) ? payload.recent_runs : []);

        const costRes = await fetch(`/api/costs/overview?workspace_id=${encodeURIComponent(agent.workspace_id || 'default')}`);
        if (costRes.ok) {
          const costPayload = (await costRes.json()) as { agent_summaries?: AgentCostSummary[] };
          setCostSummary((costPayload.agent_summaries || []).find((item) => item.agent_id === agent.id) || null);
        } else {
          setCostSummary(null);
        }
      } catch (error) {
        setPerfError(error instanceof Error ? error.message : 'Failed to load performance profile');
      } finally {
        setPerfLoading(false);
      }
    };

    void load();
  }, [agent, activeTab]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-mc-bg-secondary border border-mc-border rounded-lg w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-mc-border">
          <h2 className="text-lg font-semibold">
            {agent ? `Edit ${agent.name}` : 'Create New Agent'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-mc-bg-tertiary rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-mc-border">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-mc-accent text-mc-accent'
                  : 'border-transparent text-mc-text-secondary hover:text-mc-text'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4">
          {activeTab === 'info' && (
            <div className="space-y-4">
              {/* Avatar Selection */}
              <div>
                <label className="block text-sm font-medium mb-2">Avatar</label>
                <div className="flex flex-wrap gap-2">
                  {EMOJI_OPTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setForm({ ...form, avatar_emoji: emoji })}
                      className={`text-2xl p-2 rounded hover:bg-mc-bg-tertiary ${
                        form.avatar_emoji === emoji
                          ? 'bg-mc-accent/20 ring-2 ring-mc-accent'
                          : ''
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  className="w-full bg-mc-bg border border-mc-border rounded px-3 py-2 text-sm focus:outline-none focus:border-mc-accent"
                  placeholder="Agent name"
                />
              </div>

              {/* Role */}
              <div>
                <label className="block text-sm font-medium mb-1">Role</label>
                <input
                  type="text"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  required
                  className="w-full bg-mc-bg border border-mc-border rounded px-3 py-2 text-sm focus:outline-none focus:border-mc-accent"
                  placeholder="e.g., Code & Automation"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  className="w-full bg-mc-bg border border-mc-border rounded px-3 py-2 text-sm focus:outline-none focus:border-mc-accent resize-none"
                  placeholder="What does this agent do?"
                />
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium mb-1">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as AgentStatus })}
                  className="w-full bg-mc-bg border border-mc-border rounded px-3 py-2 text-sm focus:outline-none focus:border-mc-accent"
                >
                  <option value="standby">Standby</option>
                  <option value="working">Working</option>
                  <option value="offline">Offline</option>
                </select>
              </div>

              {/* Master Toggle */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_master"
                  checked={form.is_master}
                  onChange={(e) => setForm({ ...form, is_master: e.target.checked })}
                  className="w-4 h-4"
                />
                <label htmlFor="is_master" className="text-sm">
                  Master Orchestrator (can coordinate other agents)
                </label>
              </div>
            </div>
          )}

          {activeTab === 'soul' && (
            <div>
              <label className="block text-sm font-medium mb-2">
                SOUL.md - Agent Personality & Identity
              </label>
              <textarea
                value={form.soul_md}
                onChange={(e) => setForm({ ...form, soul_md: e.target.value })}
                rows={15}
                className="w-full bg-mc-bg border border-mc-border rounded px-3 py-2 text-sm font-mono focus:outline-none focus:border-mc-accent resize-none"
                placeholder="# Agent Name&#10;&#10;Define this agent's personality, values, and communication style..."
              />
            </div>
          )}

          {activeTab === 'performance' && (
            <div className="space-y-4">
              {!agent ? (
                <div className="text-sm text-mc-text-secondary">
                  Save this agent first to start tracking performance metrics.
                </div>
              ) : perfLoading ? (
                <div className="text-sm text-mc-text-secondary">Loading performance profile...</div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded border border-mc-border p-3 bg-mc-bg">
                      <div className="text-xs uppercase text-mc-text-secondary">Rolling Score</div>
                      <div className="text-lg font-semibold">{performanceProfile ? performanceProfile.rolling_score.toFixed(1) : '0.0'}</div>
                    </div>
                    <div className="rounded border border-mc-border p-3 bg-mc-bg">
                      <div className="text-xs uppercase text-mc-text-secondary">Estimated AI Spend</div>
                      <div className="text-lg font-semibold text-mc-accent-green">${(costSummary?.estimated_total_usd ?? 0).toFixed(2)}</div>
                    </div>
                    <div className="rounded border border-mc-border p-3 bg-mc-bg">
                      <div className="text-xs uppercase text-mc-text-secondary">Pass Rate</div>
                      <div className="text-lg font-semibold">{(((performanceProfile?.pass_rate ?? 0) * 100)).toFixed(0)}%</div>
                    </div>
                    <div className="rounded border border-mc-border p-3 bg-mc-bg">
                      <div className="text-xs uppercase text-mc-text-secondary">Samples</div>
                      <div className="text-lg font-semibold">{performanceProfile?.samples ?? 0}</div>
                    </div>
                  </div>

                  {costSummary ? (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded border border-mc-border p-3 bg-mc-bg">
                        <div className="text-xs uppercase text-mc-text-secondary">Actual Captured Spend</div>
                        <div className="text-lg font-semibold text-mc-accent-cyan">${costSummary.actual_total_usd.toFixed(2)}</div>
                      </div>
                      <div className="rounded border border-mc-border p-3 bg-mc-bg">
                        <div className="text-xs uppercase text-mc-text-secondary">Delta</div>
                        <div className="text-lg font-semibold">
                          {costSummary.delta_usd >= 0 ? '+' : ''}{costSummary.delta_usd.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {costSummary ? (
                    <div className="rounded border border-mc-border p-3 bg-mc-bg">
                      <div className="text-xs uppercase text-mc-text-secondary mb-2">Estimated Cost by Action</div>
                      <div className="space-y-2">
                        {costSummary.action_breakdown.map((row) => (
                          <div key={row.action_key} className="flex items-center justify-between text-sm">
                            <div className="text-mc-text-secondary">
                              {row.label} <span className="text-mc-text-tertiary">({row.count} x ${row.unit_cost_usd.toFixed(3)})</span>
                            </div>
                            <div className="font-medium text-mc-accent-green">${row.estimated_cost_usd.toFixed(2)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {costSummary && costSummary.actual_breakdown.length > 0 ? (
                    <div className="rounded border border-mc-border p-3 bg-mc-bg">
                      <div className="text-xs uppercase text-mc-text-secondary mb-2">Actual Captured by Provider/Model</div>
                      <div className="space-y-2">
                        {costSummary.actual_breakdown.map((row) => (
                          <div key={`${row.provider}-${row.model}`} className="flex items-center justify-between text-sm">
                            <div className="text-mc-text-secondary">
                              {row.provider} / {row.model} <span className="text-mc-text-tertiary">({row.requests} req)</span>
                            </div>
                            <div className="font-medium text-mc-accent-cyan">${row.cost_usd.toFixed(2)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="rounded border border-mc-border p-3 bg-mc-bg">
                    <div className="text-xs uppercase text-mc-text-secondary mb-2">Recent Eval Runs</div>
                    {recentRuns.length === 0 ? (
                      <div className="text-sm text-mc-text-secondary">No evaluations yet for this agent.</div>
                    ) : (
                      <div className="space-y-2 max-h-56 overflow-y-auto">
                        {recentRuns.map((row) => (
                          <div key={row.id} className="rounded border border-mc-border/70 p-2">
                            <div className="text-xs">
                              <span className="uppercase">{row.status}</span> • score {row.quality_score} • {row.fault_attribution.replace(/_/g, ' ')}
                            </div>
                            <div className="text-[11px] text-mc-text-secondary mt-1">{new Date(row.evaluated_at).toLocaleString()}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}

              {perfError ? <div className="text-xs text-mc-accent-red">{perfError}</div> : null}
            </div>
          )}

          {activeTab === 'user' && (
            <div>
              <label className="block text-sm font-medium mb-2">
                USER.md - Context About the Human
              </label>
              <textarea
                value={form.user_md}
                onChange={(e) => setForm({ ...form, user_md: e.target.value })}
                rows={15}
                className="w-full bg-mc-bg border border-mc-border rounded px-3 py-2 text-sm font-mono focus:outline-none focus:border-mc-accent resize-none"
                placeholder="# User Context&#10;&#10;Information about the human this agent works with..."
              />
            </div>
          )}

          {activeTab === 'agents' && (
            <div>
              <label className="block text-sm font-medium mb-2">
                AGENTS.md - Team Awareness
              </label>
              <textarea
                value={form.agents_md}
                onChange={(e) => setForm({ ...form, agents_md: e.target.value })}
                rows={15}
                className="w-full bg-mc-bg border border-mc-border rounded px-3 py-2 text-sm font-mono focus:outline-none focus:border-mc-accent resize-none"
                placeholder="# Team Roster&#10;&#10;Information about other agents this agent works with..."
              />
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-mc-border">
          <div>
            {agent && (
              <button
                type="button"
                onClick={handleDelete}
                className="flex items-center gap-2 px-3 py-2 text-mc-accent-red hover:bg-mc-accent-red/10 rounded text-sm"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-mc-text-secondary hover:text-mc-text"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-4 py-2 bg-mc-accent text-mc-bg rounded text-sm font-medium hover:bg-mc-accent/90 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isSubmitting ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
