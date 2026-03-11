'use client';

import { useEffect, useMemo, useState } from 'react';
import { Crown, Loader2, Send, ShieldAlert } from 'lucide-react';
import { useMissionControl } from '@/lib/store';
import type { Agent, LeadDecisionLog, LeadQueueItem } from '@/lib/types';

interface LeadConsolePanelProps {
  workspaceId: string;
}

interface LeadApprovalItem {
  id: string;
  task_id: string;
  recommendation: string;
  risks: string[];
  status: 'pending' | 'approved' | 'denied';
  decision?: string | null;
  created_at: string;
  updated_at: string;
}

interface QueueResponse {
  workspace_id: string;
  lead_agent: Agent;
  queue: LeadQueueItem[];
  approvals: LeadApprovalItem[];
  operator_commands: Array<{ id: string; operator_id: string; command: string; created_at: string }>;
}

function relativeTime(iso: string): string {
  const deltaMs = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(deltaMs) || deltaMs < 0) return 'just now';
  const min = Math.floor(deltaMs / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

function evalBadgeClasses(status?: string | null): string {
  if (status === 'pass') return 'bg-green-500/15 text-green-300 border-green-500/40';
  if (status === 'partial') return 'bg-yellow-500/15 text-yellow-300 border-yellow-500/40';
  if (status === 'fail') return 'bg-red-500/15 text-red-300 border-red-500/40';
  return 'bg-mc-bg-tertiary text-mc-text-secondary border-mc-border';
}

export function LeadConsolePanel({ workspaceId }: LeadConsolePanelProps) {
  const { setTasks, setEvents } = useMissionControl();
  const [data, setData] = useState<QueueResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workingTaskId, setWorkingTaskId] = useState<string | null>(null);

  async function reload() {
    setIsLoading(true);
    setError(null);
    try {
      const [queueRes, tasksRes, eventsRes] = await Promise.all([
        fetch(`/api/lead/queue?workspace_id=${workspaceId}`),
        fetch(`/api/tasks?workspace_id=${workspaceId}`),
        fetch('/api/events?limit=50'),
      ]);
      if (!queueRes.ok) {
        const payload = await queueRes.json().catch(() => ({ error: 'Failed to load lead queue' }));
        throw new Error(payload.error || 'Failed to load lead queue');
      }
      setData(await queueRes.json());
      if (tasksRes.ok) {
        setTasks(await tasksRes.json());
      }
      if (eventsRes.ok) {
        setEvents(await eventsRes.json());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Lead Console');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void reload();
    const interval = setInterval(() => {
      void reload();
    }, 12000);
    return () => clearInterval(interval);
  }, [workspaceId]);

  const intakeItems = useMemo(
    () => (data?.queue || []).filter((item) => ['intake', 'triage'].includes(item.status)),
    [data],
  );
  const pendingApprovals = useMemo(
    () => (data?.approvals || []).filter((item) => item.status === 'pending'),
    [data],
  );

  async function delegate(taskId: string) {
    setWorkingTaskId(taskId);
    setError(null);
    try {
      const res = await fetch(`/api/lead/tasks/${taskId}/delegate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspaceId,
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({ error: 'Delegation failed' }));
        throw new Error(payload.error || 'Delegation failed');
      }

      const dispatch = await fetch(`/api/tasks/${taskId}/dispatch`, { method: 'POST' });
      if (!dispatch.ok) {
        const payload = await dispatch.json().catch(() => ({ error: 'Dispatch failed' }));
        throw new Error(payload.error || 'Dispatch failed');
      }
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delegation failed');
    } finally {
      setWorkingTaskId(null);
    }
  }

  return (
    <div className="border-b border-mc-border bg-mc-bg p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Crown className="w-4 h-4 text-mc-accent-yellow" />
          <span className="text-xs uppercase tracking-wider text-mc-text-secondary">Lead Console</span>
        </div>
        <button
          onClick={() => void reload()}
          className="text-[11px] px-2 py-1 rounded border border-mc-border text-mc-text-secondary hover:bg-mc-bg-tertiary"
          disabled={isLoading}
        >
          {isLoading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {data && (
        <div className="grid grid-cols-3 gap-2 text-[11px]">
          <div className="rounded border border-mc-border p-2 bg-mc-bg-secondary">
            <div className="text-mc-text-secondary uppercase">Intake</div>
            <div className="text-lg font-semibold">{intakeItems.length}</div>
          </div>
          <div className="rounded border border-mc-border p-2 bg-mc-bg-secondary">
            <div className="text-mc-text-secondary uppercase">Awaiting Approval</div>
            <div className="text-lg font-semibold">{pendingApprovals.length}</div>
          </div>
          <div className="rounded border border-mc-border p-2 bg-mc-bg-secondary">
            <div className="text-mc-text-secondary uppercase">Lead Agent</div>
            <div className="text-sm font-semibold truncate">{data.lead_agent.name}</div>
          </div>
        </div>
      )}

      <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
        {intakeItems.length === 0 ? (
          <div className="text-xs text-mc-text-secondary">No tasks waiting for Lead triage.</div>
        ) : (
          intakeItems.slice(0, 6).map((item) => (
            <div key={item.task_id} className="rounded border border-mc-border p-2 bg-mc-bg-secondary">
              <div className="text-xs font-medium line-clamp-1">{item.task_title}</div>
              <div className="text-[11px] text-mc-text-secondary">
                {item.status.toUpperCase()} • {item.task_priority.toUpperCase()} • {relativeTime(item.updated_at)}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1">
                <span className={`text-[10px] px-1.5 py-0.5 rounded border uppercase ${evalBadgeClasses(item.latest_eval_status)}`}>
                  {item.latest_eval_status || 'no-eval'}
                </span>
                {typeof item.latest_eval_score === 'number' && (
                  <span className="text-[10px] text-mc-text-secondary">score {item.latest_eval_score}</span>
                )}
                {item.latest_eval_fault && (
                  <span className="text-[10px] text-mc-text-secondary">{item.latest_eval_fault.replace(/_/g, ' ')}</span>
                )}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <button
                  onClick={() => void delegate(item.task_id)}
                  disabled={workingTaskId === item.task_id}
                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded bg-mc-accent text-mc-bg hover:bg-mc-accent/90 disabled:opacity-50"
                >
                  {workingTaskId === item.task_id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                  Delegate
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {pendingApprovals.length > 0 && (
        <div className="rounded border border-mc-accent-yellow/40 bg-mc-accent-yellow/10 p-2">
          <div className="flex items-center gap-2 text-xs font-medium">
            <ShieldAlert className="w-3.5 h-3.5 text-mc-accent-yellow" />
            Pending Lead approvals: {pendingApprovals.length}
          </div>
        </div>
      )}

      {data?.operator_commands?.length ? (
        <details className="rounded border border-mc-border p-2 bg-mc-bg-secondary">
          <summary className="cursor-pointer text-xs text-mc-text-secondary">
            Operator command history ({data.operator_commands.length})
          </summary>
          <div className="mt-2 space-y-1">
            {data.operator_commands.slice(0, 8).map((command) => (
              <div key={command.id} className="text-[11px] text-mc-text-secondary">
                <span className="text-mc-text">{command.operator_id}</span>: {command.command}
              </div>
            ))}
          </div>
        </details>
      ) : null}

      {error ? <div className="text-xs text-mc-accent-red">{error}</div> : null}
    </div>
  );
}
