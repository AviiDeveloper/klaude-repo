'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Crown,
  RefreshCw,
  Send,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import type {
  Workspace,
  Agent,
  LeadQueueItem,
  LeadDecisionLog,
  Task,
  TaskActivity,
} from '@/lib/types';

interface LeadControlConsoleProps {
  workspace: Workspace;
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

interface LeadQueueResponse {
  workspace_id: string;
  lead_agent: Agent;
  queue: LeadQueueItem[];
  approvals: LeadApprovalItem[];
  operator_commands: Array<{ id: string; operator_id: string; command: string; created_at: string }>;
}

interface LeadLearningContextView {
  sample_count: number;
  recent_answer_count: number;
  avg_score: number;
  latest_score: number | null;
  good_rate: number;
  partial_rate: number;
  wrong_rate: number;
  trend: 'improving' | 'declining' | 'stable' | 'insufficient_data';
  delegation_mode: 'conservative' | 'balanced' | 'exploratory';
  coaching_focus: string;
  latest_concept_tag?: string | null;
}

interface LeadMemoryPacketView {
  learning_context?: LeadLearningContextView | null;
}

interface LearningQuestionPreview {
  id: string;
  question: string;
  concept_tag?: string | null;
  created_at: string;
}

interface DelegateResponse {
  delegation: {
    id: string;
    delegated_to_agent_id: string;
    rationale: string;
    expected_output_contract: string;
    timeout_ms: number;
    retry_limit: number;
    status: string;
    last_error?: string | null;
    created_at: string;
    updated_at: string;
  };
  selected_agent: {
    id: string;
    name: string;
  };
  score_reasons: string[];
}

const QUEUE_STATE_META: Record<LeadQueueItem['status'], { label: string; hint: string; tone: string }> = {
  intake: {
    label: 'Intake',
    hint: 'Queued for first-pass lead review.',
    tone: 'text-mc-accent-cyan border-mc-accent-cyan/40 bg-mc-accent-cyan/10',
  },
  triage: {
    label: 'Triage',
    hint: 'Lead is selecting agent and execution strategy.',
    tone: 'text-mc-accent border-mc-accent/40 bg-mc-accent/10',
  },
  delegated: {
    label: 'Delegated',
    hint: 'Assigned to worker and ready/running in dispatch path.',
    tone: 'text-mc-accent-green border-mc-accent-green/40 bg-mc-accent-green/10',
  },
  monitoring: {
    label: 'Monitoring',
    hint: 'Lead is monitoring worker outputs/findings.',
    tone: 'text-mc-text border-mc-border bg-mc-bg-tertiary',
  },
  awaiting_operator: {
    label: 'Awaiting Operator',
    hint: 'Operator decision/input required to continue.',
    tone: 'text-mc-accent-yellow border-mc-accent-yellow/40 bg-mc-accent-yellow/10',
  },
  blocked: {
    label: 'Blocked',
    hint: 'Quality gate or approval denial is blocking next action.',
    tone: 'text-mc-accent-red border-mc-accent-red/40 bg-mc-accent-red/10',
  },
  closed: {
    label: 'Closed',
    hint: 'Lead flow complete for this task.',
    tone: 'text-mc-text-secondary border-mc-border bg-mc-bg',
  },
};

function prettyDate(ts?: string | null): string {
  if (!ts) return '-';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return d.toLocaleString();
}

function relativeAge(ts?: string | null): string {
  if (!ts) return '-';
  const deltaMs = Date.now() - new Date(ts).getTime();
  if (!Number.isFinite(deltaMs) || deltaMs < 0) return 'just now';
  const min = Math.floor(deltaMs / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

function parseDetailsJson(detailsJson?: string | null): Record<string, unknown> {
  if (!detailsJson) return {};
  try {
    const parsed = JSON.parse(detailsJson) as Record<string, unknown>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function LeadControlConsole({ workspace }: LeadControlConsoleProps) {
  const [data, setData] = useState<LeadQueueResponse | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [selectedApprovalId, setSelectedApprovalId] = useState<string>('');
  const [decisionLog, setDecisionLog] = useState<LeadDecisionLog[]>([]);
  const [memoryPacket, setMemoryPacket] = useState<LeadMemoryPacketView | null>(null);
  const [taskActivities, setTaskActivities] = useState<TaskActivity[]>([]);
  const [latestDelegationResult, setLatestDelegationResult] = useState<DelegateResponse | null>(null);
  const [learningQuestion, setLearningQuestion] = useState<LearningQuestionPreview | null>(null);
  const [learningMessage, setLearningMessage] = useState<string | null>(null);
  const [operatorId, setOperatorId] = useState('operator');
  const [approvalRationale, setApprovalRationale] = useState('');
  const [commandInput, setCommandInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isWorking, setIsWorking] = useState(false);

  const queue = data?.queue || [];
  const approvals = data?.approvals || [];
  const pendingApprovals = approvals
    .filter((item) => item.status === 'pending')
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === selectedTaskId) || null,
    [tasks, selectedTaskId],
  );

  const selectedTaskQueueItem = useMemo(
    () => queue.find((item) => item.task_id === selectedTaskId) || null,
    [queue, selectedTaskId],
  );

  const selectedApproval = useMemo(
    () => approvals.find((approval) => approval.id === selectedApprovalId) || null,
    [approvals, selectedApprovalId],
  );

  const queueStateCounts = useMemo(() => {
    const counts = {
      intake: 0,
      triage: 0,
      delegated: 0,
      monitoring: 0,
      awaiting_operator: 0,
      blocked: 0,
      closed: 0,
    } satisfies Record<LeadQueueItem['status'], number>;

    for (const item of queue) {
      counts[item.status] += 1;
    }
    return counts;
  }, [queue]);

  const taskTitleById = useMemo(() => {
    const map = new Map<string, string>();
    for (const task of tasks) {
      map.set(task.id, task.title);
    }
    return map;
  }, [tasks]);

  const learningContext = memoryPacket?.learning_context ?? null;
  const learningModeTone =
    learningContext?.delegation_mode === 'conservative'
      ? 'text-mc-accent-red border-mc-accent-red/40 bg-mc-accent-red/10'
      : learningContext?.delegation_mode === 'exploratory'
      ? 'text-mc-accent-green border-mc-accent-green/40 bg-mc-accent-green/10'
      : 'text-mc-accent border-mc-accent/40 bg-mc-accent/10';

  const latestDelegateLog = useMemo(
    () => decisionLog.find((row) => row.decision_type === 'delegate') || null,
    [decisionLog],
  );
  const latestDelegateDetails = useMemo(
    () => parseDetailsJson(latestDelegateLog?.details_json),
    [latestDelegateLog],
  );
  const delegatedAgentNameFromLog =
    typeof latestDelegateDetails.selected_agent_name === 'string'
      ? latestDelegateDetails.selected_agent_name
      : null;
  const effectiveScoreReasons = useMemo(() => {
    if (latestDelegationResult?.score_reasons?.length) {
      return latestDelegationResult.score_reasons;
    }
    if (Array.isArray(latestDelegateDetails.score_reasons)) {
      return latestDelegateDetails.score_reasons.filter(
        (item): item is string => typeof item === 'string',
      );
    }
    return [];
  }, [latestDelegationResult, latestDelegateDetails]);

  const lastActivity = taskActivities[0] || null;
  const lastHeartbeat =
    taskActivities.find((activity) => activity.activity_type === 'updated') ||
    taskActivities.find((activity) => activity.agent_id) ||
    null;
  const heartbeatAgeMin = lastHeartbeat
    ? Math.floor((Date.now() - new Date(lastHeartbeat.created_at).getTime()) / 60000)
    : null;
  const heartbeatTone =
    heartbeatAgeMin === null
      ? 'text-mc-text-secondary border-mc-border bg-mc-bg'
      : heartbeatAgeMin <= 2
      ? 'text-mc-accent-green border-mc-accent-green/40 bg-mc-accent-green/10'
      : heartbeatAgeMin <= 8
      ? 'text-mc-accent-yellow border-mc-accent-yellow/40 bg-mc-accent-yellow/10'
      : 'text-mc-accent-red border-mc-accent-red/40 bg-mc-accent-red/10';

  async function refreshCore() {
    setError(null);
    setIsLoading(true);
    try {
      const [queueRes, tasksRes, operatorRes] = await Promise.all([
        fetch(`/api/lead/queue?workspace_id=${workspace.id}`),
        fetch(`/api/tasks?workspace_id=${workspace.id}`),
        fetch(`/api/memory/operator?workspace_id=${workspace.id}`),
      ]);

      if (!queueRes.ok) {
        const payload = await queueRes.json().catch(() => ({ error: 'Failed to load lead queue' }));
        throw new Error(payload.error || 'Failed to load lead queue');
      }

      const queueJson = (await queueRes.json()) as LeadQueueResponse;
      setData(queueJson);

      if (tasksRes.ok) {
        const allTasks = (await tasksRes.json()) as Task[];
        setTasks(allTasks);
      }

      if (operatorRes.ok) {
        const operatorJson = (await operatorRes.json()) as {
          profile?: { operator_name?: string | null } | null;
        };
        if (operatorJson.profile?.operator_name?.trim()) {
          setOperatorId(operatorJson.profile.operator_name.trim());
        }
      }

      const fallbackTaskId = selectedTaskId || queueJson.queue[0]?.task_id || '';
      if (fallbackTaskId) {
        setSelectedTaskId(fallbackTaskId);
      }

      const fallbackApproval =
        selectedApprovalId ||
        queueJson.approvals.find((a) => a.status === 'pending')?.id ||
        '';
      if (fallbackApproval) {
        setSelectedApprovalId(fallbackApproval);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Lead Console');
    } finally {
      setIsLoading(false);
    }
  }

  async function refreshTaskViews(taskId: string) {
    if (!taskId) {
      setDecisionLog([]);
      setMemoryPacket(null);
      setTaskActivities([]);
      return;
    }

    try {
      const [logRes, packetRes, activitiesRes] = await Promise.all([
        fetch(`/api/lead/tasks/${taskId}/decision-log?workspace_id=${workspace.id}`),
        fetch(`/api/lead/memory/packet?workspace_id=${workspace.id}&task_id=${taskId}`),
        fetch(`/api/tasks/${taskId}/activities`),
      ]);

      if (logRes.ok) {
        const payload = (await logRes.json()) as { decision_log?: LeadDecisionLog[]; logs?: LeadDecisionLog[] };
        setDecisionLog(payload.decision_log || payload.logs || []);
      } else {
        setDecisionLog([]);
      }

      if (packetRes.ok) {
        const payload = (await packetRes.json()) as { packet?: LeadMemoryPacketView };
        setMemoryPacket(payload.packet ?? null);
      } else {
        setMemoryPacket(null);
      }

      if (activitiesRes.ok) {
        const payload = (await activitiesRes.json()) as TaskActivity[];
        setTaskActivities(payload || []);
      } else {
        setTaskActivities([]);
      }
    } catch {
      setDecisionLog([]);
      setMemoryPacket(null);
      setTaskActivities([]);
    }
  }

  async function refreshLearningQuestion() {
    try {
      const latestRes = await fetch(`/api/learning/questions/latest?workspace_id=${workspace.id}`);
      if (!latestRes.ok) {
        setLearningQuestion(null);
        return;
      }
      const payload = (await latestRes.json()) as { question?: LearningQuestionPreview | null };
      setLearningQuestion(payload.question || null);
    } catch {
      setLearningQuestion(null);
    }
  }

  useEffect(() => {
    void refreshCore();
    const interval = setInterval(() => {
      void refreshCore();
    }, 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace.id]);

  useEffect(() => {
    void refreshTaskViews(selectedTaskId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTaskId, workspace.id]);

  useEffect(() => {
    void refreshLearningQuestion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace.id]);

  async function runAction(action: () => Promise<void>) {
    setError(null);
    setIsWorking(true);
    try {
      await action();
      await refreshCore();
      if (selectedTaskId) {
        await refreshTaskViews(selectedTaskId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setIsWorking(false);
    }
  }

  async function intakeSelectedTask() {
    if (!selectedTaskId) {
      throw new Error('Select a task first');
    }

    const res = await fetch('/api/lead/tasks/intake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspace_id: workspace.id, task_id: selectedTaskId }),
    });

    if (!res.ok) {
      const payload = await res.json().catch(() => ({ error: 'Intake failed' }));
      throw new Error(payload.error || 'Intake failed');
    }
  }

  async function delegateSelectedTask() {
    if (!selectedTaskId) {
      throw new Error('Select a task first');
    }

    const delegate = await fetch(`/api/lead/tasks/${selectedTaskId}/delegate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspace_id: workspace.id }),
    });

    if (!delegate.ok) {
      const payload = await delegate.json().catch(() => ({ error: 'Delegation failed' }));
      throw new Error(payload.error || 'Delegation failed');
    }

    const payload = (await delegate.json()) as DelegateResponse;
    setLatestDelegationResult(payload);
  }

  async function resolveApproval(decision: 'approved' | 'denied') {
    if (!selectedTaskId || !selectedApprovalId) {
      throw new Error('Select a pending approval first');
    }

    const res = await fetch(`/api/lead/tasks/${selectedTaskId}/approval-decision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspace_id: workspace.id,
        approval_request_id: selectedApprovalId,
        operator_id: operatorId,
        decision,
        rationale: approvalRationale || null,
      }),
    });

    if (!res.ok) {
      const payload = await res.json().catch(() => ({ error: `Approval ${decision} failed` }));
      throw new Error(payload.error || `Approval ${decision} failed`);
    }

    setApprovalRationale('');
  }

  async function sendLeadCommand() {
    if (!commandInput.trim()) {
      throw new Error('Command is required');
    }

    const res = await fetch('/api/lead/commands', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspace_id: workspace.id,
        task_id: selectedTaskId || undefined,
        operator_id: operatorId,
        command: commandInput.trim(),
      }),
    });

    if (!res.ok) {
      const payload = await res.json().catch(() => ({ error: 'Command failed' }));
      throw new Error(payload.error || 'Command failed');
    }

    setCommandInput('');
  }

  async function generateLearningQuestion() {
    const res = await fetch('/api/learning/questions/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspace_id: workspace.id,
        source_type: 'decision_log',
      }),
    });

    if (!res.ok) {
      const payload = await res.json().catch(() => ({ error: 'Failed to generate learning question' }));
      throw new Error(payload.error || 'Failed to generate learning question');
    }

    const payload = (await res.json()) as {
      question_record?: LearningQuestionPreview;
      question?: LearningQuestionPreview;
    } & Partial<LearningQuestionPreview>;
    const created = payload.question_record || payload.question || (payload as LearningQuestionPreview);
    setLearningQuestion(created);
    setLearningMessage('Learning question generated for this workspace.');
  }

  return (
    <div className="flex-1 overflow-hidden p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Crown className="w-5 h-5 text-mc-accent-yellow" />
          <div>
            <h1 className="text-xl font-semibold">Lead Orchestrator Console</h1>
            <p className="text-sm text-mc-text-secondary">
              Queue states, delegation rationale, approvals, and heartbeat visibility for operator control.
            </p>
          </div>
        </div>
        <button
          onClick={() => void refreshCore()}
          disabled={isLoading}
          className="inline-flex items-center gap-2 px-3 py-2 rounded border border-mc-border text-sm hover:bg-mc-bg-tertiary disabled:opacity-60"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-4 gap-3 text-sm">
        <div className="bg-mc-bg-secondary border border-mc-border rounded-lg p-3">
          <div className="text-mc-text-secondary uppercase text-xs">Lead Agent</div>
          <div className="mt-1 font-semibold truncate">{data?.lead_agent?.name || 'Loading...'}</div>
        </div>
        <div className="bg-mc-bg-secondary border border-mc-border rounded-lg p-3">
          <div className="text-mc-text-secondary uppercase text-xs">Needs Lead Action</div>
          <div className="mt-1 text-lg font-semibold">
            {queueStateCounts.intake + queueStateCounts.triage + queueStateCounts.awaiting_operator + queueStateCounts.blocked}
          </div>
        </div>
        <div className="bg-mc-bg-secondary border border-mc-border rounded-lg p-3">
          <div className="text-mc-text-secondary uppercase text-xs">Pending Approvals</div>
          <div className="mt-1 text-lg font-semibold">{pendingApprovals.length}</div>
        </div>
        <div className="bg-mc-bg-secondary border border-mc-border rounded-lg p-3">
          <div className="text-mc-text-secondary uppercase text-xs">Open Tasks</div>
          <div className="mt-1 text-lg font-semibold">{tasks.filter((t) => t.status !== 'done').length}</div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4 h-[calc(100%-148px)]">
        <section className="col-span-4 bg-mc-bg-secondary border border-mc-border rounded-lg p-3 overflow-y-auto space-y-3">
          <h2 className="font-semibold">Task Intake & Delegation</h2>
          <label className="text-xs text-mc-text-secondary block">Selected Task</label>
          <select
            value={selectedTaskId}
            onChange={(e) => setSelectedTaskId(e.target.value)}
            className="w-full bg-mc-bg border border-mc-border rounded px-3 py-2 text-sm"
          >
            <option value="">Select task...</option>
            {tasks.map((task) => (
              <option key={task.id} value={task.id}>
                {task.title} [{task.status}]
              </option>
            ))}
          </select>

          <div className="grid grid-cols-2 gap-2">
            <button
              disabled={isWorking}
              onClick={() => void runAction(intakeSelectedTask)}
              className="px-3 py-2 rounded bg-mc-accent text-mc-bg text-sm font-medium hover:bg-mc-accent/90 disabled:opacity-60"
            >
              Force Intake
            </button>
            <button
              disabled={isWorking}
              onClick={() => void runAction(delegateSelectedTask)}
              className="px-3 py-2 rounded border border-mc-border text-sm hover:bg-mc-bg-tertiary disabled:opacity-60"
            >
              Delegate Now
            </button>
          </div>

          {selectedTask ? (
            <div className="text-xs text-mc-text-secondary border border-mc-border rounded p-2 bg-mc-bg space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="text-mc-text">Status:</span> {selectedTask.status}
                </div>
                {selectedTaskQueueItem ? (
                  <span
                    className={`px-2 py-0.5 rounded border text-[10px] uppercase tracking-wide ${
                      QUEUE_STATE_META[selectedTaskQueueItem.status].tone
                    }`}
                  >
                    {QUEUE_STATE_META[selectedTaskQueueItem.status].label}
                  </span>
                ) : null}
              </div>
              <div>
                <span className="text-mc-text">Priority:</span> {selectedTask.priority}
              </div>
              <div>
                <span className="text-mc-text">Assigned Agent:</span>{' '}
                {selectedTask.assigned_agent_id || 'none'}
              </div>
              <div className="mt-1 text-mc-text">{selectedTask.description || 'No description'}</div>
            </div>
          ) : null}

          <div className={`rounded border p-2 text-xs space-y-1 ${heartbeatTone}`}>
            <div className="flex items-center gap-1 font-medium">
              <Clock3 className="w-3.5 h-3.5" /> Agent Heartbeat & Progress
            </div>
            <div>
              Last heartbeat: <span className="text-mc-text">{relativeAge(lastHeartbeat?.created_at)}</span>
            </div>
            <div>
              Last activity: <span className="text-mc-text">{lastActivity?.message || 'No activity yet'}</span>
            </div>
            {lastActivity ? (
              <div className="text-[11px] text-mc-text-secondary">
                {lastActivity.activity_type} • {prettyDate(lastActivity.created_at)}
              </div>
            ) : null}
          </div>

          <div className="border border-mc-border rounded bg-mc-bg p-2 text-xs space-y-2">
            <div className="text-mc-text-secondary uppercase">Delegation Reasoning</div>
            <div className="text-mc-text">
              {(latestDelegationResult?.delegation?.rationale as string | undefined) ||
                (latestDelegateDetails.rationale as string | undefined) ||
                'No delegation rationale recorded for selected task yet.'}
            </div>
            {effectiveScoreReasons.length > 0 && (
              <div>
                <div className="text-mc-text-secondary uppercase">Why this assignee</div>
                <ul className="list-disc pl-4 text-mc-text-secondary space-y-0.5">
                  {effectiveScoreReasons.slice(0, 6).map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </div>
            )}
            {(latestDelegationResult?.selected_agent?.name || delegatedAgentNameFromLog) && (
              <div className="text-mc-text-secondary">
                Selected worker:{' '}
                <span className="text-mc-text">
                  {latestDelegationResult?.selected_agent?.name || delegatedAgentNameFromLog}
                </span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs uppercase text-mc-text-secondary">Lead Queue</div>
              <div className="text-[11px] text-mc-text-secondary">{queue.length} total</div>
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-[10px]">
              {(Object.keys(QUEUE_STATE_META) as LeadQueueItem['status'][]).map((status) => (
                <div key={status} className={`rounded border px-1.5 py-1 ${QUEUE_STATE_META[status].tone}`}>
                  <div className="font-medium uppercase">{QUEUE_STATE_META[status].label}</div>
                  <div>{queueStateCounts[status]}</div>
                </div>
              ))}
            </div>
            {queue.length === 0 ? (
              <div className="text-xs text-mc-text-secondary">No lead queue items.</div>
            ) : (
              queue.slice(0, 20).map((item) => (
                <button
                  key={item.task_id}
                  onClick={() => setSelectedTaskId(item.task_id)}
                  className={`w-full text-left rounded border p-2 text-xs ${
                    selectedTaskId === item.task_id ? 'border-mc-accent' : 'border-mc-border'
                  } bg-mc-bg hover:bg-mc-bg-tertiary`}
                >
                  <div className="font-medium line-clamp-1">{item.task_title}</div>
                  <div className="mt-1 flex items-center flex-wrap gap-1">
                    <span
                      className={`px-1.5 py-0.5 rounded border text-[10px] uppercase ${
                        QUEUE_STATE_META[item.status].tone
                      }`}
                    >
                      {QUEUE_STATE_META[item.status].label}
                    </span>
                    <span className="text-mc-text-secondary">{item.task_priority.toUpperCase()}</span>
                    <span className="text-mc-text-secondary">{relativeAge(item.updated_at)}</span>
                  </div>
                  <div className="text-[11px] text-mc-text-secondary mt-1 line-clamp-1">
                    {QUEUE_STATE_META[item.status].hint}
                  </div>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="col-span-4 bg-mc-bg-secondary border border-mc-border rounded-lg p-3 overflow-y-auto space-y-3">
          <h2 className="font-semibold">Approval Inbox</h2>

          <label className="text-xs text-mc-text-secondary block">Operator ID (authorized)</label>
          <input
            value={operatorId}
            onChange={(e) => setOperatorId(e.target.value)}
            className="w-full bg-mc-bg border border-mc-border rounded px-3 py-2 text-sm"
            placeholder="operator"
          />

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded border border-mc-border bg-mc-bg p-2">
              <div className="text-mc-text-secondary uppercase">Pending</div>
              <div className="text-lg font-semibold">{pendingApprovals.length}</div>
            </div>
            <div className="rounded border border-mc-border bg-mc-bg p-2">
              <div className="text-mc-text-secondary uppercase">Resolved</div>
              <div className="text-lg font-semibold">{approvals.length - pendingApprovals.length}</div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs text-mc-text-secondary uppercase">Pending Approval Requests</div>
            {pendingApprovals.length === 0 ? (
              <div className="text-xs text-mc-text-secondary border border-mc-border rounded p-2 bg-mc-bg">
                Inbox clear. No pending lead approvals.
              </div>
            ) : (
              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {pendingApprovals.map((approval) => (
                  <button
                    key={approval.id}
                    onClick={() => {
                      setSelectedApprovalId(approval.id);
                      setSelectedTaskId(approval.task_id);
                    }}
                    className={`w-full text-left rounded border p-2 text-xs ${
                      selectedApprovalId === approval.id ? 'border-mc-accent-yellow' : 'border-mc-border'
                    } bg-mc-bg hover:bg-mc-bg-tertiary`}
                  >
                    <div className="font-medium line-clamp-1">
                      {taskTitleById.get(approval.task_id) || `Task ${approval.task_id.slice(0, 8)}...`}
                    </div>
                    <div className="text-mc-text-secondary mt-1">
                      Waiting {relativeAge(approval.created_at)} • {approval.risks.length} risk
                      {approval.risks.length === 1 ? '' : 's'}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedApproval ? (
            <div className="border border-mc-border rounded bg-mc-bg p-2 text-xs space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-mc-text-secondary uppercase">Selected Request</div>
                <span className="text-mc-text-secondary">{relativeAge(selectedApproval.created_at)}</span>
              </div>
              <div>
                <div className="text-mc-text-secondary uppercase">Task</div>
                <div className="text-mc-text">
                  {taskTitleById.get(selectedApproval.task_id) || selectedApproval.task_id}
                </div>
              </div>
              <div>
                <div className="text-mc-text-secondary uppercase">Recommendation</div>
                <div className="text-mc-text">{selectedApproval.recommendation}</div>
              </div>
              <div>
                <div className="text-mc-text-secondary uppercase">Risks</div>
                {selectedApproval.risks?.length ? (
                  <ul className="list-disc pl-4 text-mc-text-secondary">
                    {selectedApproval.risks.map((risk) => (
                      <li key={risk}>{risk}</li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-mc-text-secondary">No risks listed.</div>
                )}
              </div>
              <div className="text-[11px] text-mc-text-secondary">
                Created: {prettyDate(selectedApproval.created_at)}
              </div>
            </div>
          ) : null}

          <label className="text-xs text-mc-text-secondary block">Decision Rationale</label>
          <textarea
            value={approvalRationale}
            onChange={(e) => setApprovalRationale(e.target.value)}
            className="w-full min-h-24 bg-mc-bg border border-mc-border rounded px-3 py-2 text-sm"
            placeholder="Why approve or deny?"
          />

          <div className="grid grid-cols-2 gap-2">
            <button
              disabled={isWorking || !selectedApprovalId}
              onClick={() => void runAction(() => resolveApproval('approved'))}
              className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded bg-mc-accent-green/20 border border-mc-accent-green text-mc-accent-green text-sm disabled:opacity-60"
            >
              <CheckCircle2 className="w-4 h-4" /> Approve
            </button>
            <button
              disabled={isWorking || !selectedApprovalId}
              onClick={() => void runAction(() => resolveApproval('denied'))}
              className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded bg-mc-accent-red/20 border border-mc-accent-red text-mc-accent-red text-sm disabled:opacity-60"
            >
              <XCircle className="w-4 h-4" /> Deny
            </button>
          </div>

          <div className="border-t border-mc-border pt-3 space-y-2">
            <div className="text-xs uppercase text-mc-text-secondary">Operator Command to Lead</div>
            <textarea
              value={commandInput}
              onChange={(e) => setCommandInput(e.target.value)}
              className="w-full min-h-24 bg-mc-bg border border-mc-border rounded px-3 py-2 text-sm"
              placeholder="Tell Lead what to do next"
            />
            <button
              disabled={isWorking || !commandInput.trim()}
              onClick={() => void runAction(sendLeadCommand)}
              className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded border border-mc-border text-sm hover:bg-mc-bg-tertiary disabled:opacity-60"
            >
              <Send className="w-4 h-4" /> Send Command
            </button>
          </div>
        </section>

        <section className="col-span-4 bg-mc-bg-secondary border border-mc-border rounded-lg p-3 overflow-y-auto space-y-3">
          <h2 className="font-semibold">Lead Decisions & Memory Packet</h2>

          <div className="text-xs uppercase text-mc-text-secondary">Learning Delegation Mode</div>
          {learningContext ? (
            <div className="border border-mc-border rounded bg-mc-bg p-3 text-xs space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className={`px-2 py-1 rounded border uppercase tracking-wide font-medium ${learningModeTone}`}>
                  {learningContext.delegation_mode}
                </span>
                <span className="text-mc-text-secondary">
                  trend: <span className="text-mc-text">{learningContext.trend}</span>
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-mc-text-secondary">
                <div>
                  Avg score: <span className="text-mc-text">{learningContext.avg_score}</span>
                </div>
                <div>
                  Latest score: <span className="text-mc-text">{learningContext.latest_score ?? '-'}</span>
                </div>
                <div>
                  Good rate: <span className="text-mc-text">{Math.round(learningContext.good_rate * 100)}%</span>
                </div>
                <div>
                  Wrong rate: <span className="text-mc-text">{Math.round(learningContext.wrong_rate * 100)}%</span>
                </div>
                <div>
                  Recent samples: <span className="text-mc-text">{learningContext.recent_answer_count}</span>
                </div>
                <div>
                  Total samples: <span className="text-mc-text">{learningContext.sample_count}</span>
                </div>
              </div>
              <div className="border border-mc-border rounded p-2 bg-mc-bg-secondary/60 text-mc-text-secondary">
                <span className="text-mc-text">Coaching focus:</span> {learningContext.coaching_focus}
              </div>
              {learningContext.latest_concept_tag ? (
                <div className="text-[11px] text-mc-text-secondary">
                  Latest concept: <span className="text-mc-text">{learningContext.latest_concept_tag}</span>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="text-xs text-mc-text-secondary border border-mc-border rounded p-2 bg-mc-bg space-y-2">
              <div>No learning signal yet. Charlie is running in balanced mode.</div>
              <div>Generate and answer one learning question to activate learning-driven delegation tuning.</div>
            </div>
          )}

          <div className="grid grid-cols-[1fr_auto] gap-2 items-center">
            <div className="text-xs uppercase text-mc-text-secondary">Learning Bootstrap</div>
            <button
              disabled={isWorking}
              onClick={() => void runAction(generateLearningQuestion)}
              className="px-2 py-1 rounded border border-mc-border text-xs hover:bg-mc-bg-tertiary disabled:opacity-60"
            >
              Generate Question
            </button>
          </div>
          {learningQuestion ? (
            <div className="border border-mc-border rounded bg-mc-bg p-2 text-xs space-y-1">
              <div className="text-mc-text line-clamp-3">{learningQuestion.question}</div>
              <div className="text-mc-text-secondary">
                {learningQuestion.concept_tag ? `Concept: ${learningQuestion.concept_tag} • ` : ''}
                {prettyDate(learningQuestion.created_at)}
              </div>
            </div>
          ) : (
            <div className="text-xs text-mc-text-secondary border border-mc-border rounded p-2 bg-mc-bg">
              No learning question generated yet.
            </div>
          )}
          {learningMessage ? <div className="text-xs text-mc-accent-cyan">{learningMessage}</div> : null}

          <div className="text-xs uppercase text-mc-text-secondary">Decision Log</div>
          {decisionLog.length === 0 ? (
            <div className="text-xs text-mc-text-secondary">No lead decisions yet for selected task.</div>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {decisionLog.map((row) => (
                <div key={row.id} className="border border-mc-border rounded bg-mc-bg p-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-mc-text">{row.decision_type}</span>
                    <span className="text-mc-text-secondary">{prettyDate(row.created_at)}</span>
                  </div>
                  <div className="text-mc-text-secondary mt-1">{row.summary}</div>
                </div>
              ))}
            </div>
          )}

          <div className="text-xs uppercase text-mc-text-secondary">Recent Worker Activity</div>
          {taskActivities.length === 0 ? (
            <div className="text-xs text-mc-text-secondary border border-mc-border rounded p-2 bg-mc-bg">
              No worker activity logged for selected task.
            </div>
          ) : (
            <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
              {taskActivities.slice(0, 8).map((activity) => (
                <div key={activity.id} className="border border-mc-border rounded bg-mc-bg p-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-mc-text">{activity.message}</span>
                    <span className="text-mc-text-secondary">{relativeAge(activity.created_at)}</span>
                  </div>
                  <div className="text-mc-text-secondary mt-1">
                    {activity.activity_type}
                    {activity.agent?.name ? ` • ${activity.agent.name}` : ''}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="text-xs uppercase text-mc-text-secondary">Memory Packet (live)</div>
          <pre className="bg-mc-bg border border-mc-border rounded p-2 text-[11px] leading-5 overflow-auto max-h-[280px] whitespace-pre-wrap break-words">
            {memoryPacket ? JSON.stringify(memoryPacket, null, 2) : 'No memory packet loaded.'}
          </pre>
        </section>
      </div>

      {error ? (
        <div className="rounded border border-mc-accent-red/40 bg-mc-accent-red/10 p-3 text-sm text-mc-accent-red inline-flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
      ) : (
        <div className="rounded border border-mc-accent-green/30 bg-mc-accent-green/10 p-2 text-xs text-mc-accent-green inline-flex items-center gap-2">
          <ShieldAlert className="w-4 h-4" />
          Lead controls active. Worker side-effects remain approval-gated.
        </div>
      )}
    </div>
  );
}
