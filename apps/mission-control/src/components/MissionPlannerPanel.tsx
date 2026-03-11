'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Sparkles, AlertTriangle, CalendarCheck, Gauge, ShieldAlert } from 'lucide-react';

interface PlannerSnapshot {
  statusCounts: {
    planning: number;
    inbox: number;
    assigned: number;
    in_progress: number;
    testing: number;
    review: number;
    done: number;
    total: number;
  };
  overdueCount: number;
  dueSoonCount: number;
  staleInProgressCount: number;
  completedLast7d: number;
  failedTestsLast7d: number;
  averageCycleHoursLast7d: number | null;
}

interface PlannerRecommendation {
  summary: string;
  schedule: Array<{ window: string; action: string; rationale: string }>;
  performanceChecks: Array<{ metric: string; target: string; cadence: string }>;
  risks: string[];
  nextActions: string[];
}

interface PlannerResponse {
  snapshot: PlannerSnapshot;
  codex?: { configured: boolean; model: string };
  recommendation?: PlannerRecommendation;
  source?: 'codex' | 'fallback';
  model?: string;
  warning?: string;
}

interface MissionPlannerPanelProps {
  workspaceId: string;
}

export function MissionPlannerPanel({ workspaceId }: MissionPlannerPanelProps) {
  const [objective, setObjective] = useState('Plan the next shift cycle to reduce backlog and improve throughput.');
  const [horizonDays, setHorizonDays] = useState(2);
  const [data, setData] = useState<PlannerResponse | null>(null);
  const [loadingSnapshot, setLoadingSnapshot] = useState(true);
  const [runningPlan, setRunningPlan] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSnapshot = useCallback(async () => {
    setLoadingSnapshot(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/codex`);
      if (!res.ok) {
        throw new Error('Failed to load workspace metrics');
      }
      const payload = await res.json() as PlannerResponse;
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workspace metrics');
    } finally {
      setLoadingSnapshot(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    loadSnapshot();
  }, [loadSnapshot]);

  const runPlanner = async () => {
    const trimmedObjective = objective.trim();
    if (!trimmedObjective) {
      setError('Objective is required.');
      return;
    }

    setRunningPlan(true);
    setError(null);

    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/codex`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          objective: trimmedObjective,
          horizonDays,
        }),
      });

      const payload = await res.json() as PlannerResponse & { error?: string };
      if (!res.ok) {
        throw new Error(payload.error || 'Planner request failed');
      }
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Planner request failed');
    } finally {
      setRunningPlan(false);
    }
  };

  const snapshot = data?.snapshot;
  const recommendation = data?.recommendation;

  return (
    <section className="border-b border-mc-border p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-mc-accent-cyan" />
          <span className="text-xs font-semibold uppercase tracking-wider">Mission Planner</span>
        </div>
        {data?.model && (
          <span className="text-[10px] text-mc-text-secondary">
            {data.source === 'fallback' ? 'Fallback' : 'Codex'} | {data.model}
          </span>
        )}
      </div>

      {loadingSnapshot ? (
        <div className="flex items-center gap-2 text-xs text-mc-text-secondary">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Loading workspace telemetry...
        </div>
      ) : snapshot ? (
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <MetricChip label="Open Queue" value={snapshot.statusCounts.total - snapshot.statusCounts.done} />
          <MetricChip label="Overdue" value={snapshot.overdueCount} danger={snapshot.overdueCount > 0} />
          <MetricChip label="Due Soon" value={snapshot.dueSoonCount} />
          <MetricChip label="Stale WIP" value={snapshot.staleInProgressCount} danger={snapshot.staleInProgressCount > 0} />
          <MetricChip label="Done 7d" value={snapshot.completedLast7d} />
          <MetricChip label="Test Fails 7d" value={snapshot.failedTestsLast7d} danger={snapshot.failedTestsLast7d > 0} />
        </div>
      ) : null}

      <div className="space-y-2">
        <textarea
          value={objective}
          onChange={(e) => setObjective(e.target.value)}
          rows={3}
          maxLength={600}
          className="w-full rounded border border-mc-border bg-mc-bg px-2 py-1.5 text-xs focus:border-mc-accent focus:outline-none"
          placeholder="What should Codex optimize?"
        />

        <div className="flex items-center gap-2">
          <select
            value={horizonDays}
            onChange={(e) => setHorizonDays(Number(e.target.value))}
            className="rounded border border-mc-border bg-mc-bg px-2 py-1 text-xs"
          >
            <option value={1}>1 day</option>
            <option value={2}>2 days</option>
            <option value={3}>3 days</option>
            <option value={7}>7 days</option>
            <option value={14}>14 days</option>
          </select>
          <button
            onClick={runPlanner}
            disabled={runningPlan}
            className="flex-1 rounded bg-mc-accent px-2 py-1 text-xs font-medium text-mc-bg hover:bg-mc-accent/90 disabled:opacity-60"
          >
            {runningPlan ? 'Planning...' : 'Generate Plan'}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded border border-mc-accent-red/40 bg-mc-accent-red/10 p-2 text-[11px] text-mc-accent-red">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {data?.warning && (
        <div className="flex items-start gap-2 rounded border border-mc-accent-yellow/40 bg-mc-accent-yellow/10 p-2 text-[11px] text-mc-accent-yellow">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{data.warning}</span>
        </div>
      )}

      {recommendation && (
        <div className="space-y-2 text-[11px]">
          <p className="rounded border border-mc-border bg-mc-bg px-2 py-1.5 text-mc-text">
            {recommendation.summary}
          </p>

          <div className="space-y-1">
            <div className="flex items-center gap-1 text-mc-text-secondary">
              <CalendarCheck className="h-3.5 w-3.5" />
              <span className="uppercase tracking-wider">Schedule</span>
            </div>
            {recommendation.schedule.map((item, index) => (
              <div key={`${item.window}-${index}`} className="rounded border border-mc-border bg-mc-bg px-2 py-1.5">
                <p className="font-medium text-mc-accent">{item.window}</p>
                <p>{item.action}</p>
                <p className="text-mc-text-secondary">{item.rationale}</p>
              </div>
            ))}
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1 text-mc-text-secondary">
              <Gauge className="h-3.5 w-3.5" />
              <span className="uppercase tracking-wider">Performance Checks</span>
            </div>
            {recommendation.performanceChecks.map((check, index) => (
              <div key={`${check.metric}-${index}`} className="rounded border border-mc-border bg-mc-bg px-2 py-1.5">
                <p className="font-medium">{check.metric}</p>
                <p className="text-mc-text-secondary">Target: {check.target}</p>
                <p className="text-mc-text-secondary">Cadence: {check.cadence}</p>
              </div>
            ))}
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1 text-mc-text-secondary">
              <ShieldAlert className="h-3.5 w-3.5" />
              <span className="uppercase tracking-wider">Risks</span>
            </div>
            {recommendation.risks.map((risk, index) => (
              <p key={`${risk}-${index}`} className="rounded border border-mc-border bg-mc-bg px-2 py-1.5">
                {risk}
              </p>
            ))}
          </div>

          <div className="space-y-1">
            <p className="text-mc-text-secondary uppercase tracking-wider">Next Actions</p>
            {recommendation.nextActions.map((action, index) => (
              <p key={`${action}-${index}`} className="rounded border border-mc-border bg-mc-bg px-2 py-1.5">
                {index + 1}. {action}
              </p>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function MetricChip({ label, value, danger = false }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className="rounded border border-mc-border bg-mc-bg px-2 py-1">
      <p className="text-[10px] uppercase tracking-wider text-mc-text-secondary">{label}</p>
      <p className={danger ? 'text-mc-accent-red font-semibold' : 'font-semibold'}>{value}</p>
    </div>
  );
}
