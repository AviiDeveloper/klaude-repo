import { queryAll, queryOne } from './db';
import type { TaskStatus } from './types';

type StatusCountRow = {
  status: TaskStatus;
  count: number;
};

type CountRow = {
  count: number;
};

type TaskHealthRow = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: string;
  due_date: string | null;
  updated_at: string;
};

type ThroughputRow = {
  day: string;
  count: number;
};

type CompletedTaskRow = {
  created_at: string;
  updated_at: string;
};

const STATUS_KEYS: TaskStatus[] = ['planning', 'inbox', 'assigned', 'in_progress', 'testing', 'review', 'done'];
const DEFAULT_CODEX_MODEL = process.env.MISSION_CONTROL_CODEX_MODEL || 'codex5.3';

export interface TaskHealthItem {
  id: string;
  title: string;
  status: TaskStatus;
  priority: string;
  dueDate: string | null;
  updatedAt: string;
}

export interface WorkspacePerformanceSnapshot {
  generatedAt: string;
  workspaceId: string;
  statusCounts: Record<TaskStatus, number> & { total: number };
  overdueCount: number;
  dueSoonCount: number;
  staleInProgressCount: number;
  highPriorityBacklog: number;
  tasksWithoutDueDate: number;
  activeAgents: number;
  totalAgents: number;
  completedLast7d: number;
  failedTestsLast7d: number;
  averageCycleHoursLast7d: number | null;
  throughputByDay: Array<{ day: string; completed: number }>;
  overdueTasks: TaskHealthItem[];
  dueSoonTasks: TaskHealthItem[];
  staleInProgressTasks: TaskHealthItem[];
}

export interface MissionScheduleItem {
  window: string;
  action: string;
  rationale: string;
}

export interface MissionPerformanceCheck {
  metric: string;
  target: string;
  cadence: string;
}

export interface MissionPlanRecommendation {
  summary: string;
  schedule: MissionScheduleItem[];
  performanceChecks: MissionPerformanceCheck[];
  risks: string[];
  nextActions: string[];
}

function toTaskHealthItem(row: TaskHealthRow): TaskHealthItem {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    priority: row.priority,
    dueDate: row.due_date,
    updatedAt: row.updated_at,
  };
}

function parseDate(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function extractJsonObject(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    const firstBrace = raw.indexOf('{');
    const lastBrace = raw.lastIndexOf('}');
    if (firstBrace === -1 || lastBrace <= firstBrace) {
      return null;
    }
    try {
      const parsed = JSON.parse(raw.slice(firstBrace, lastBrace + 1));
      if (parsed && typeof parsed === 'object') {
        return parsed as Record<string, unknown>;
      }
      return null;
    } catch {
      return null;
    }
  }
}

function coerceStringList(value: unknown, maxItems = 5, fallback: string[] = []): string[] {
  if (!Array.isArray(value)) {
    return fallback;
  }
  return value
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim())
    .slice(0, maxItems);
}

function coerceSchedule(value: unknown): MissionScheduleItem[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item): MissionScheduleItem | null => {
      if (!item || typeof item !== 'object') {
        return null;
      }
      const record = item as Record<string, unknown>;
      const window = typeof record.window === 'string' ? record.window.trim() : '';
      const action = typeof record.action === 'string' ? record.action.trim() : '';
      const rationale = typeof record.rationale === 'string' ? record.rationale.trim() : '';
      if (!window || !action || !rationale) {
        return null;
      }
      return { window, action, rationale };
    })
    .filter((item): item is MissionScheduleItem => item !== null)
    .slice(0, 8);
}

function coercePerformanceChecks(value: unknown): MissionPerformanceCheck[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item): MissionPerformanceCheck | null => {
      if (!item || typeof item !== 'object') {
        return null;
      }
      const record = item as Record<string, unknown>;
      const metric = typeof record.metric === 'string' ? record.metric.trim() : '';
      const target = typeof record.target === 'string' ? record.target.trim() : '';
      const cadence = typeof record.cadence === 'string' ? record.cadence.trim() : '';
      if (!metric || !target || !cadence) {
        return null;
      }
      return { metric, target, cadence };
    })
    .filter((item): item is MissionPerformanceCheck => item !== null)
    .slice(0, 8);
}

function sanitizePlan(raw: Record<string, unknown>, fallback: MissionPlanRecommendation): MissionPlanRecommendation {
  const summary = typeof raw.summary === 'string' ? raw.summary.trim() : fallback.summary;
  const schedule = coerceSchedule(raw.schedule);
  const performanceChecks = coercePerformanceChecks(raw.performanceChecks);
  const risks = coerceStringList(raw.risks, 8, fallback.risks);
  const nextActions = coerceStringList(raw.nextActions, 8, fallback.nextActions);

  return {
    summary: summary || fallback.summary,
    schedule: schedule.length > 0 ? schedule : fallback.schedule,
    performanceChecks: performanceChecks.length > 0 ? performanceChecks : fallback.performanceChecks,
    risks,
    nextActions,
  };
}

function roundTo2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function buildWorkspaceSnapshot(workspaceId: string, now = new Date()): WorkspacePerformanceSnapshot {
  const nowIso = now.toISOString();
  const lookbackDate = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
  const lookbackIso = lookbackDate.toISOString();
  const dueSoonIso = new Date(now.getTime() + (72 * 60 * 60 * 1000)).toISOString();
  const staleCutoffIso = new Date(now.getTime() - (24 * 60 * 60 * 1000)).toISOString();

  const statusCounts = STATUS_KEYS.reduce<Record<TaskStatus, number> & { total: number }>(
    (acc, key) => ({ ...acc, [key]: 0 }),
    { planning: 0, inbox: 0, assigned: 0, in_progress: 0, testing: 0, review: 0, done: 0, total: 0 },
  );

  const statusRows = queryAll<StatusCountRow>(
    `SELECT status, COUNT(*) as count
     FROM tasks
     WHERE workspace_id = ?
     GROUP BY status`,
    [workspaceId],
  );
  for (const row of statusRows) {
    if (STATUS_KEYS.includes(row.status)) {
      statusCounts[row.status] = row.count;
      statusCounts.total += row.count;
    }
  }

  const overdueTasks = queryAll<TaskHealthRow>(
    `SELECT id, title, status, priority, due_date, updated_at
     FROM tasks
     WHERE workspace_id = ?
       AND due_date IS NOT NULL
       AND due_date < ?
       AND status != 'done'
     ORDER BY due_date ASC
     LIMIT 5`,
    [workspaceId, nowIso],
  );

  const dueSoonTasks = queryAll<TaskHealthRow>(
    `SELECT id, title, status, priority, due_date, updated_at
     FROM tasks
     WHERE workspace_id = ?
       AND due_date IS NOT NULL
       AND due_date >= ?
       AND due_date <= ?
       AND status != 'done'
     ORDER BY due_date ASC
     LIMIT 5`,
    [workspaceId, nowIso, dueSoonIso],
  );

  const staleInProgressTasks = queryAll<TaskHealthRow>(
    `SELECT id, title, status, priority, due_date, updated_at
     FROM tasks
     WHERE workspace_id = ?
       AND status = 'in_progress'
       AND updated_at < ?
     ORDER BY updated_at ASC
     LIMIT 5`,
    [workspaceId, staleCutoffIso],
  );

  const highPriorityBacklog = queryOne<CountRow>(
    `SELECT COUNT(*) as count
     FROM tasks
     WHERE workspace_id = ?
       AND status != 'done'
       AND priority IN ('high', 'urgent')`,
    [workspaceId],
  )?.count ?? 0;

  const tasksWithoutDueDate = queryOne<CountRow>(
    `SELECT COUNT(*) as count
     FROM tasks
     WHERE workspace_id = ?
       AND status != 'done'
       AND due_date IS NULL`,
    [workspaceId],
  )?.count ?? 0;

  const activeAgents = queryOne<CountRow>(
    `SELECT COUNT(*) as count
     FROM agents
     WHERE workspace_id = ?
       AND status = 'working'`,
    [workspaceId],
  )?.count ?? 0;

  const totalAgents = queryOne<CountRow>(
    `SELECT COUNT(*) as count
     FROM agents
     WHERE workspace_id = ?`,
    [workspaceId],
  )?.count ?? 0;

  const completedLast7d = queryOne<CountRow>(
    `SELECT COUNT(*) as count
     FROM tasks
     WHERE workspace_id = ?
       AND status = 'done'
       AND updated_at >= ?`,
    [workspaceId, lookbackIso],
  )?.count ?? 0;

  const failedTestsLast7d = queryOne<CountRow>(
    `SELECT COUNT(*) as count
     FROM task_activities ta
     JOIN tasks t ON t.id = ta.task_id
     WHERE t.workspace_id = ?
       AND ta.activity_type = 'test_failed'
       AND ta.created_at >= ?`,
    [workspaceId, lookbackIso],
  )?.count ?? 0;

  const completedTasks = queryAll<CompletedTaskRow>(
    `SELECT created_at, updated_at
     FROM tasks
     WHERE workspace_id = ?
       AND status = 'done'
       AND updated_at >= ?`,
    [workspaceId, lookbackIso],
  );
  const cycleDurations = completedTasks
    .map((task) => {
      const start = parseDate(task.created_at);
      const end = parseDate(task.updated_at);
      if (start === null || end === null || end < start) {
        return null;
      }
      return (end - start) / (1000 * 60 * 60);
    })
    .filter((hours): hours is number => typeof hours === 'number');
  const averageCycleHoursLast7d = cycleDurations.length > 0
    ? roundTo2(cycleDurations.reduce((sum, value) => sum + value, 0) / cycleDurations.length)
    : null;

  const throughputByDayRows = queryAll<ThroughputRow>(
    `SELECT substr(updated_at, 1, 10) as day, COUNT(*) as count
     FROM tasks
     WHERE workspace_id = ?
       AND status = 'done'
       AND updated_at >= ?
     GROUP BY substr(updated_at, 1, 10)
     ORDER BY day ASC`,
    [workspaceId, lookbackIso],
  );

  return {
    generatedAt: nowIso,
    workspaceId,
    statusCounts,
    overdueCount: overdueTasks.length,
    dueSoonCount: dueSoonTasks.length,
    staleInProgressCount: staleInProgressTasks.length,
    highPriorityBacklog,
    tasksWithoutDueDate,
    activeAgents,
    totalAgents,
    completedLast7d,
    failedTestsLast7d,
    averageCycleHoursLast7d,
    throughputByDay: throughputByDayRows.map((row) => ({ day: row.day, completed: row.count })),
    overdueTasks: overdueTasks.map(toTaskHealthItem),
    dueSoonTasks: dueSoonTasks.map(toTaskHealthItem),
    staleInProgressTasks: staleInProgressTasks.map(toTaskHealthItem),
  };
}

export function buildFallbackPlan(
  objective: string,
  snapshot: WorkspacePerformanceSnapshot,
  horizonDays: number,
): MissionPlanRecommendation {
  const targetBacklogReduction = Math.max(1, Math.ceil(snapshot.statusCounts.inbox / Math.max(horizonDays, 1)));
  const summaryParts = [
    snapshot.overdueCount > 0 ? `${snapshot.overdueCount} overdue task(s)` : null,
    snapshot.staleInProgressCount > 0 ? `${snapshot.staleInProgressCount} stale in-progress task(s)` : null,
    `${snapshot.highPriorityBacklog} high-priority backlog task(s)`,
  ].filter((part): part is string => part !== null);

  const summary = `Objective: ${objective}. Priority focus: ${summaryParts.join(', ')}.`;

  const schedule: MissionScheduleItem[] = [
    {
      window: 'Now - 2h',
      action: 'Triage overdue and urgent tasks, assign owners, and set explicit due dates.',
      rationale: 'Removes hidden priority work and prevents further SLA drift.',
    },
    {
      window: 'Next 4h',
      action: `Pull at least ${targetBacklogReduction} inbox tasks into assigned/in_progress with clear success criteria.`,
      rationale: 'Converts idle queue volume into active throughput.',
    },
    {
      window: 'Daily close',
      action: 'Run testing on completed work and push passed tasks to review the same day.',
      rationale: 'Shortens cycle time and prevents work from stalling in testing.',
    },
  ];

  const performanceChecks: MissionPerformanceCheck[] = [
    {
      metric: 'Overdue tasks',
      target: '0 overdue by end of planning horizon',
      cadence: 'Every 4 hours',
    },
    {
      metric: 'Tasks completed per 7 days',
      target: `> ${Math.max(snapshot.completedLast7d, 1)} completed tasks`,
      cadence: 'Daily',
    },
    {
      metric: 'Failed test activities',
      target: '<= 1 new failure per day',
      cadence: 'Daily',
    },
  ];

  const risks: string[] = [];
  if (snapshot.tasksWithoutDueDate > 0) {
    risks.push(`${snapshot.tasksWithoutDueDate} open task(s) have no due date.`);
  }
  if (snapshot.totalAgents === 0) {
    risks.push('No agents are available in this workspace.');
  }
  if (snapshot.failedTestsLast7d > 0) {
    risks.push(`${snapshot.failedTestsLast7d} failed test activity event(s) in the last 7 days.`);
  }
  if (risks.length === 0) {
    risks.push('No critical risk spikes detected from current telemetry.');
  }

  const nextActions = [
    "Confirm today's top 3 deliverables with owners and deadlines.",
    'Review stale in-progress tasks and either unblock or reassign them.',
    'Track test failures and add a fix-verification checklist before review.',
  ];

  return { summary, schedule, performanceChecks, risks, nextActions };
}

export async function generateCodexPlan(params: {
  objective: string;
  horizonDays: number;
  snapshot: WorkspacePerformanceSnapshot;
}): Promise<{ plan: MissionPlanRecommendation; model: string; source: 'codex' | 'fallback'; warning?: string }> {
  const fallback = buildFallbackPlan(params.objective, params.snapshot, params.horizonDays);
  const apiKey = process.env.OPENAI_API_KEY;
  const model = DEFAULT_CODEX_MODEL;

  if (!apiKey) {
    return {
      plan: fallback,
      model,
      source: 'fallback',
      warning: 'OPENAI_API_KEY is not set. Returned deterministic fallback plan.',
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'You are a mission-control operations planner. Return strict JSON only with keys: summary, schedule, performanceChecks, risks, nextActions. Each schedule item must include window, action, rationale. Each performanceChecks item must include metric, target, cadence.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              objective: params.objective,
              horizonDays: params.horizonDays,
              snapshot: params.snapshot,
            }),
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        plan: fallback,
        model,
        source: 'fallback',
        warning: `Codex request failed (${response.status}): ${errorText.slice(0, 200)}`,
      };
    }

    const payload = await response.json() as {
      choices?: Array<{
        message?: {
          content?: string | Array<{ type?: string; text?: string }>;
        };
      }>;
    };

    const content = payload.choices?.[0]?.message?.content;
    const rawText = typeof content === 'string'
      ? content
      : Array.isArray(content)
        ? content
            .map((part) => (typeof part?.text === 'string' ? part.text : ''))
            .join('\n')
        : '';
    if (!rawText) {
      return {
        plan: fallback,
        model,
        source: 'fallback',
        warning: 'Codex response did not include structured content.',
      };
    }

    const parsed = extractJsonObject(rawText);
    if (!parsed) {
      return {
        plan: fallback,
        model,
        source: 'fallback',
        warning: 'Codex response could not be parsed as JSON.',
      };
    }

    return {
      plan: sanitizePlan(parsed, fallback),
      model,
      source: 'codex',
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown error';
    return {
      plan: fallback,
      model,
      source: 'fallback',
      warning: `Codex request failed: ${reason}`,
    };
  } finally {
    clearTimeout(timeout);
  }
}
