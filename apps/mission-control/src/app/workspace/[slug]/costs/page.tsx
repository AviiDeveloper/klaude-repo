'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ChevronLeft, DollarSign } from 'lucide-react';
import { Header } from '@/components/Header';
import type { Workspace } from '@/lib/types';

type CostActionEstimate = {
  action_key: string;
  label: string;
  count: number;
  unit_cost_usd: number;
  estimated_cost_usd: number;
  description: string;
};

type AgentCostSummary = {
  agent_id: string;
  agent_name: string;
  role: string;
  workspace_id: string;
  estimated_total_usd: number;
  action_breakdown: CostActionEstimate[];
};

type WorkspaceCostSummary = {
  workspace_id: string;
  workspace_name: string;
  workspace_slug: string;
  estimated_total_usd: number;
  actual_total_usd: number;
  delta_usd: number;
  task_count: number;
  agent_count: number;
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

type CostOverview = {
  generated_at: string;
  disclaimer: string;
  actual_disclaimer: string;
  total_estimated_usd: number;
  total_actual_usd: number;
  total_delta_usd: number;
  workspace_summaries: WorkspaceCostSummary[];
  agent_summaries: AgentCostSummary[];
};

export default function WorkspaceCostsPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [overview, setOverview] = useState<CostOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const workspaceRes = await fetch(`/api/workspaces/${slug}`);
        if (!workspaceRes.ok) {
          throw new Error('Workspace not found');
        }
        const workspacePayload = (await workspaceRes.json()) as Workspace;
        setWorkspace(workspacePayload);

        const costRes = await fetch('/api/costs/overview');
        if (!costRes.ok) {
          const payload = await costRes.json().catch(() => ({ error: 'Failed to load cost view' }));
          throw new Error(payload.error || 'Failed to load cost view');
        }
        setOverview((await costRes.json()) as CostOverview);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load cost dashboard');
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [slug]);

  const workspaceSummary = overview?.workspace_summaries.find((item) => item.workspace_id === workspace?.id) || null;

  return (
    <div className="min-h-screen bg-mc-bg">
      <Header workspace={workspace || undefined} />
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <DollarSign className="w-6 h-6 text-mc-accent-green" />
              <h1 className="text-3xl font-semibold">Cost Observatory</h1>
            </div>
            <p className="text-mc-text-secondary max-w-4xl">
              Estimated OpenClaw-driven AI spend for this workspace, plus the agents and actions most likely driving cost.
            </p>
          </div>
          <Link
            href={workspace ? `/workspace/${workspace.slug}` : '/'}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-mc-border text-mc-text-secondary hover:bg-mc-bg-secondary"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </Link>
        </div>

        {loading ? (
          <div className="border border-mc-border bg-mc-bg-secondary rounded-xl p-6 text-mc-text-secondary">
            Loading cost dashboard...
          </div>
        ) : error ? (
          <div className="border border-mc-accent-red/40 bg-mc-accent-red/10 text-mc-accent-red rounded-xl p-6">
            {error}
          </div>
        ) : workspaceSummary ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="border border-mc-border bg-mc-bg-secondary rounded-xl p-5">
                <div className="text-xs uppercase text-mc-text-secondary mb-2">Estimated total</div>
                <div className="text-3xl font-semibold text-mc-accent-green">
                  ${workspaceSummary.estimated_total_usd.toFixed(2)}
                </div>
              </div>
              <div className="border border-mc-border bg-mc-bg-secondary rounded-xl p-5">
                <div className="text-xs uppercase text-mc-text-secondary mb-2">Actual captured</div>
                <div className="text-3xl font-semibold text-mc-accent-cyan">${workspaceSummary.actual_total_usd.toFixed(2)}</div>
              </div>
              <div className="border border-mc-border bg-mc-bg-secondary rounded-xl p-5">
                <div className="text-xs uppercase text-mc-text-secondary mb-2">Delta</div>
                <div className="text-3xl font-semibold">{workspaceSummary.delta_usd >= 0 ? '+' : ''}{workspaceSummary.delta_usd.toFixed(2)}</div>
              </div>
              <div className="border border-mc-border bg-mc-bg-secondary rounded-xl p-5">
                <div className="text-xs uppercase text-mc-text-secondary mb-2">Generated at</div>
                <div className="text-sm font-mono text-mc-text-secondary">{new Date(overview!.generated_at).toLocaleString()}</div>
              </div>
            </div>

            <div className="border border-mc-accent-yellow/30 bg-mc-accent-yellow/10 rounded-xl p-4 text-sm text-mc-text-secondary">
              {overview!.disclaimer}
            </div>
            <div className="border border-mc-accent-cyan/30 bg-mc-accent-cyan/10 rounded-xl p-4 text-sm text-mc-text-secondary">
              {overview!.actual_disclaimer}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <section className="border border-mc-border bg-mc-bg-secondary rounded-xl p-5">
                <h2 className="text-xl font-semibold mb-4">Estimated cost by action</h2>
                <div className="space-y-3">
                  {workspaceSummary.action_breakdown.length === 0 ? (
                    <div className="text-mc-text-secondary">No cost-driving actions recorded yet.</div>
                  ) : workspaceSummary.action_breakdown.map((item) => (
                    <div key={item.action_key} className="border border-mc-border rounded-lg p-4 bg-mc-bg">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="font-medium">{item.label}</div>
                          <div className="text-sm text-mc-text-secondary">{item.description}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-semibold text-mc-accent-green">
                            ${item.estimated_cost_usd.toFixed(2)}
                          </div>
                          <div className="text-xs text-mc-text-secondary">
                            {item.count} x ${item.unit_cost_usd.toFixed(3)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="border border-mc-border bg-mc-bg-secondary rounded-xl p-5">
                <h2 className="text-xl font-semibold mb-4">Agents by estimated spend</h2>
                <div className="space-y-3">
                  {overview!.agent_summaries.length === 0 ? (
                    <div className="text-mc-text-secondary">No agent-specific cost signal yet.</div>
                  ) : overview!.agent_summaries.map((agent) => (
                    <div key={agent.agent_id} className="border border-mc-border rounded-lg p-4 bg-mc-bg">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="font-medium">{agent.agent_name}</div>
                          <div className="text-sm text-mc-text-secondary">{agent.role}</div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {agent.action_breakdown.slice(0, 3).map((item) => (
                              <span key={`${agent.agent_id}-${item.action_key}`} className="px-2 py-1 rounded bg-mc-bg-secondary border border-mc-border text-xs text-mc-text-secondary">
                                {item.label}: {item.count}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-semibold text-mc-accent-green">
                            ${agent.estimated_total_usd.toFixed(2)}
                          </div>
                          <div className="text-xs text-mc-text-secondary">estimated</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <section className="border border-mc-border bg-mc-bg-secondary rounded-xl p-5">
              <h2 className="text-xl font-semibold mb-4">All workspaces</h2>
              <div className="space-y-3">
                {overview!.workspace_summaries.map((item) => (
                  <div key={item.workspace_id} className="border border-mc-border rounded-lg p-4 bg-mc-bg">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="font-medium">{item.workspace_name}</div>
                        <div className="text-sm text-mc-text-secondary">
                          {item.task_count} tasks • {item.agent_count} agents
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-semibold text-mc-accent-green">${item.estimated_total_usd.toFixed(2)}</div>
                        <div className="text-xs text-mc-text-secondary">estimated</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="border border-mc-border bg-mc-bg-secondary rounded-xl p-5">
              <h2 className="text-xl font-semibold mb-4">Actual telemetry by provider/model</h2>
              <div className="space-y-3">
                {workspaceSummary.actual_breakdown.length === 0 ? (
                  <div className="text-mc-text-secondary">
                    No captured actual billing payloads yet for this workspace.
                  </div>
                ) : workspaceSummary.actual_breakdown.map((item) => (
                  <div key={`${item.provider}-${item.model}`} className="border border-mc-border rounded-lg p-4 bg-mc-bg">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="font-medium">{item.provider} / {item.model}</div>
                        <div className="text-sm text-mc-text-secondary">
                          {item.requests} requests • {item.total_tokens.toLocaleString()} tokens
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-semibold text-mc-accent-cyan">${item.cost_usd.toFixed(2)}</div>
                        <div className="text-xs text-mc-text-secondary">
                          in {item.input_tokens.toLocaleString()} / out {item.output_tokens.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}
