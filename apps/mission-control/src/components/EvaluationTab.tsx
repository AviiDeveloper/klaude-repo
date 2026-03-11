'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, MinusCircle, RefreshCw, XCircle } from 'lucide-react';
import type { AgentEvalRun } from '@/lib/types';

interface EvaluationTabProps {
  taskId: string;
}

type EvalRow = AgentEvalRun & {
  agent_name?: string | null;
  spec_task_type?: string | null;
};

function badgeClasses(status: string): string {
  if (status === 'pass') return 'bg-green-500/15 text-green-300 border-green-500/40';
  if (status === 'partial') return 'bg-yellow-500/15 text-yellow-300 border-yellow-500/40';
  return 'bg-red-500/15 text-red-300 border-red-500/40';
}

function faultLabel(fault: string): string {
  return fault.replace(/_/g, ' ');
}

function safeArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
  } catch {
    return [];
  }
}

function formatTime(iso: string): string {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return iso;
  return dt.toLocaleString();
}

export function EvaluationTab({ taskId }: EvaluationTabProps) {
  const [rows, setRows] = useState<EvalRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  async function load() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/evals/task/${taskId}`);
      if (!res.ok) {
        const payload = await res.json().catch(() => ({ error: 'Failed to load evaluations' }));
        throw new Error(payload.error || 'Failed to load evaluations');
      }
      const payload = (await res.json()) as EvalRow[];
      setRows(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load evaluations');
    } finally {
      setIsLoading(false);
    }
  }

  async function runNow() {
    setIsRunning(true);
    setError(null);
    try {
      const res = await fetch('/api/evals/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_id: taskId }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({ error: 'Failed to run evaluation' }));
        throw new Error(payload.error || 'Failed to run evaluation');
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run evaluation');
    } finally {
      setIsRunning(false);
    }
  }

  useEffect(() => {
    void load();
  }, [taskId]);

  const latest = rows[0];
  const latestReasons = useMemo(() => safeArray(latest?.reason_codes_json || null), [latest]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">Quality Evaluation</div>
        <div className="flex gap-2">
          <button
            onClick={() => void load()}
            className="px-2 py-1 text-xs rounded border border-mc-border hover:bg-mc-bg-tertiary"
            disabled={isLoading}
          >
            {isLoading ? 'Loading...' : 'Refresh'}
          </button>
          <button
            onClick={() => void runNow()}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-mc-accent text-mc-bg hover:bg-mc-accent/90 disabled:opacity-50"
            disabled={isRunning}
          >
            <RefreshCw className={`w-3 h-3 ${isRunning ? 'animate-spin' : ''}`} />
            {isRunning ? 'Running...' : 'Run Eval'}
          </button>
        </div>
      </div>

      {latest ? (
        <div className="rounded border border-mc-border bg-mc-bg-secondary p-3">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className={`px-2 py-0.5 rounded border text-xs uppercase ${badgeClasses(latest.status)}`}>
              {latest.status}
            </span>
            <span className="text-xs text-mc-text-secondary">Score {latest.quality_score}</span>
            <span className="text-xs text-mc-text-secondary">Confidence {(latest.confidence * 100).toFixed(0)}%</span>
            <span className="text-xs text-mc-text-secondary">Fault: {faultLabel(latest.fault_attribution)}</span>
          </div>
          <div className="text-sm">{latest.summary}</div>
          <div className="text-xs text-mc-text-secondary mt-1">
            Agent: {latest.agent_name || latest.agent_id} • {formatTime(latest.evaluated_at)}
          </div>
          {latestReasons.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {latestReasons.map((code) => (
                <span key={code} className="text-[11px] px-2 py-0.5 rounded bg-mc-bg border border-mc-border text-mc-text-secondary">
                  {code}
                </span>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="rounded border border-mc-border bg-mc-bg-secondary p-4 text-sm text-mc-text-secondary">
          No evaluation runs yet.
        </div>
      )}

      <div className="rounded border border-mc-border bg-mc-bg-secondary p-2 max-h-64 overflow-y-auto">
        <div className="text-xs uppercase text-mc-text-secondary mb-2">History</div>
        {rows.length === 0 ? (
          <div className="text-xs text-mc-text-secondary">No eval history for this task.</div>
        ) : (
          <div className="space-y-2">
            {rows.map((row) => (
              <div key={row.id} className="rounded border border-mc-border/70 p-2">
                <div className="flex items-center gap-2 text-xs">
                  {row.status === 'pass' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                  ) : row.status === 'partial' ? (
                    <MinusCircle className="w-3.5 h-3.5 text-yellow-400" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-red-400" />
                  )}
                  <span className="uppercase">{row.status}</span>
                  <span className="text-mc-text-secondary">score {row.quality_score}</span>
                  {row.fault_attribution === 'input_gap' && (
                    <span className="inline-flex items-center gap-1 text-yellow-300">
                      <AlertTriangle className="w-3 h-3" />
                      input gap
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-mc-text-secondary mt-1">
                  {row.agent_name || row.agent_id} • {formatTime(row.evaluated_at)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {error ? <div className="text-xs text-mc-accent-red">{error}</div> : null}
    </div>
  );
}
