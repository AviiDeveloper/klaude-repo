import { NextRequest, NextResponse } from 'next/server';
import { queryAll } from '@/lib/db';
import type { Agent, TaskStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

type AgentTaskRuntimeRow = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: string;
  assigned_agent_id: string;
  updated_at: string;
  created_at: string;
  delegation_rationale?: string | null;
  expected_output_contract?: string | null;
};

type TaskActivityRollup = {
  task_id: string;
  agent_id: string;
  activity_count: number;
  heartbeat_count: number;
  last_activity_at: string | null;
};

type AgentHeartbeatRow = {
  agent_id: string;
  last_activity_at: string | null;
};

type AgentSessionRow = {
  agent_id: string;
  has_active_session: number;
  last_session_seen_at: string | null;
};

type AgentThroughputRow = {
  agent_id: string;
  completed_24h: number;
};

type AgentCadenceRow = {
  agent_id: string;
  metadata: string | null;
};

type AgentRuntimeSnapshot = {
  agent_id: string;
  current_job: {
    task_id: string;
    title: string;
    status: TaskStatus;
    priority: string;
    assigned_at: string;
    updated_at: string;
    rationale?: string;
    output_contract?: string;
  } | null;
  queue_depth: number;
  progress_percent: number;
  progress_label: string;
  completed_24h: number;
  last_heartbeat_at: string | null;
  next_heartbeat_at: string | null;
  heartbeat_state: 'healthy' | 'lagging' | 'stale' | 'event' | 'unknown';
  heartbeat_source: 'task_activity' | 'session' | 'none';
  cadence: string;
  cadence_ms: number | null;
  role_summary: string;
};

const STATUS_BASELINE: Record<TaskStatus, number> = {
  planning: 20,
  inbox: 10,
  assigned: 35,
  in_progress: 65,
  testing: 85,
  review: 95,
  done: 100,
};

const STATUS_PRIORITY: Record<TaskStatus, number> = {
  in_progress: 0,
  testing: 1,
  assigned: 2,
  review: 3,
  planning: 4,
  inbox: 5,
  done: 6,
};

function parseCadenceToMs(cadence: string): number | null {
  const normalized = cadence.trim().toLowerCase();
  if (!normalized || normalized.includes('event')) return null;

  const minuteMatch = normalized.match(/(\d+)\s*(min|minute)/);
  if (minuteMatch) return Number(minuteMatch[1]) * 60_000;

  const hourMatch = normalized.match(/(\d+)\s*(h|hr|hour)/);
  if (hourMatch) return Number(hourMatch[1]) * 3_600_000;

  const dayMatch = normalized.match(/(\d+)\s*(d|day)/);
  if (dayMatch) return Number(dayMatch[1]) * 86_400_000;

  if (normalized.includes('hourly')) return 3_600_000;
  if (normalized.includes('daily')) return 86_400_000;

  return null;
}

function safeParseCadence(metadata: string | null): string {
  if (!metadata) return 'event-driven';
  try {
    const parsed = JSON.parse(metadata) as { cadence?: string };
    return parsed.cadence?.trim() || 'event-driven';
  } catch {
    return 'event-driven';
  }
}

function chooseCurrentTask(tasks: AgentTaskRuntimeRow[]): AgentTaskRuntimeRow | null {
  if (tasks.length === 0) return null;
  return [...tasks].sort((a, b) => {
    const statusDelta = STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];
    if (statusDelta !== 0) return statusDelta;
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  })[0];
}

export async function GET(request: NextRequest) {
  try {
    const workspaceId = request.nextUrl.searchParams.get('workspace_id') || 'default';
    const now = Date.now();

    const agents = queryAll<Agent>(
      `SELECT * FROM agents WHERE workspace_id = ? ORDER BY is_master DESC, name ASC`,
      [workspaceId],
    );

    if (agents.length === 0) {
      return NextResponse.json({ workspace_id: workspaceId, snapshots: [] });
    }

    const activeTasks = queryAll<AgentTaskRuntimeRow>(
      `
      SELECT
        t.id,
        t.title,
        t.status,
        t.priority,
        t.assigned_agent_id,
        t.updated_at,
        t.created_at,
        d.rationale as delegation_rationale,
        d.expected_output_contract
      FROM tasks t
      LEFT JOIN lead_task_delegations d
        ON d.id = (
          SELECT ld.id
          FROM lead_task_delegations ld
          WHERE ld.task_id = t.id
          ORDER BY ld.created_at DESC
          LIMIT 1
        )
      WHERE t.workspace_id = ?
        AND t.assigned_agent_id IS NOT NULL
        AND t.status IN ('planning', 'inbox', 'assigned', 'in_progress', 'testing', 'review')
      `,
      [workspaceId],
    );

    const taskActivityRollup = queryAll<TaskActivityRollup>(
      `
      SELECT
        task_id,
        agent_id,
        COUNT(*) as activity_count,
        SUM(CASE WHEN activity_type = 'updated' THEN 1 ELSE 0 END) as heartbeat_count,
        MAX(created_at) as last_activity_at
      FROM task_activities
      WHERE agent_id IS NOT NULL
      GROUP BY task_id, agent_id
      `,
    );

    const agentHeartbeats = queryAll<AgentHeartbeatRow>(
      `
      SELECT
        agent_id,
        MAX(created_at) as last_activity_at
      FROM task_activities
      WHERE agent_id IS NOT NULL
      GROUP BY agent_id
      `,
    );

    const sessionHeartbeats = queryAll<AgentSessionRow>(
      `
      SELECT
        s.agent_id,
        MAX(CASE WHEN s.status = 'active' THEN 1 ELSE 0 END) as has_active_session,
        MAX(s.updated_at) as last_session_seen_at
      FROM openclaw_sessions s
      INNER JOIN agents a ON a.id = s.agent_id
      WHERE a.workspace_id = ?
      GROUP BY s.agent_id
      `,
      [workspaceId],
    );

    const throughput = queryAll<AgentThroughputRow>(
      `
      SELECT
        assigned_agent_id as agent_id,
        COUNT(*) as completed_24h
      FROM tasks
      WHERE workspace_id = ?
        AND assigned_agent_id IS NOT NULL
        AND status = 'done'
        AND updated_at >= datetime('now', '-1 day')
      GROUP BY assigned_agent_id
      `,
      [workspaceId],
    );

    const cadenceRows = queryAll<AgentCadenceRow>(
      `
      SELECT ars.agent_id, ars.metadata
      FROM agent_reference_sheets ars
      INNER JOIN (
        SELECT
          agent_id,
          COALESCE(
            MAX(CASE WHEN COALESCE(lifecycle_state, 'active') = 'active' THEN version END),
            MAX(version)
          ) as max_version
        FROM agent_reference_sheets
        WHERE COALESCE(lifecycle_state, 'active') != 'archived'
        GROUP BY agent_id
      ) latest
      ON latest.agent_id = ars.agent_id AND latest.max_version = ars.version
      `,
    );

    const tasksByAgent = new Map<string, AgentTaskRuntimeRow[]>();
    for (const task of activeTasks) {
      const bucket = tasksByAgent.get(task.assigned_agent_id) || [];
      bucket.push(task);
      tasksByAgent.set(task.assigned_agent_id, bucket);
    }

    const activityByTaskAgent = new Map<string, TaskActivityRollup>();
    for (const item of taskActivityRollup) {
      activityByTaskAgent.set(`${item.task_id}:${item.agent_id}`, item);
    }

    const heartbeatByAgent = new Map<string, AgentHeartbeatRow>();
    for (const item of agentHeartbeats) heartbeatByAgent.set(item.agent_id, item);

    const sessionByAgent = new Map<string, AgentSessionRow>();
    for (const item of sessionHeartbeats) sessionByAgent.set(item.agent_id, item);

    const throughputByAgent = new Map<string, number>();
    for (const item of throughput) throughputByAgent.set(item.agent_id, Number(item.completed_24h || 0));

    const cadenceByAgent = new Map<string, string>();
    for (const row of cadenceRows) cadenceByAgent.set(row.agent_id, safeParseCadence(row.metadata));

    const snapshots: AgentRuntimeSnapshot[] = agents.map((agent) => {
      const agentTasks = tasksByAgent.get(agent.id) || [];
      const currentTask = chooseCurrentTask(agentTasks);
      const queueDepth = agentTasks.length;
      const cadence = cadenceByAgent.get(agent.id) || 'event-driven';

      const taskHeartbeat = heartbeatByAgent.get(agent.id)?.last_activity_at || null;
      const sessionHeartbeat = sessionByAgent.get(agent.id)?.last_session_seen_at || null;
      const lastHeartbeatAt = [taskHeartbeat, sessionHeartbeat]
        .filter(Boolean)
        .sort((a, b) => new Date(b as string).getTime() - new Date(a as string).getTime())[0] || null;

      const heartbeatSource = taskHeartbeat
        ? 'task_activity'
        : sessionHeartbeat
          ? 'session'
          : 'none';

      let cadenceMs = parseCadenceToMs(cadence);
      if (agent.status === 'working') {
        cadenceMs = Math.min(cadenceMs || 30_000, 30_000);
      }

      const nextHeartbeatAt = lastHeartbeatAt && cadenceMs
        ? new Date(new Date(lastHeartbeatAt).getTime() + cadenceMs).toISOString()
        : null;

      let heartbeatState: AgentRuntimeSnapshot['heartbeat_state'] = 'unknown';
      if (!lastHeartbeatAt) {
        heartbeatState = cadenceMs ? 'stale' : 'unknown';
      } else if (!cadenceMs) {
        heartbeatState = 'event';
      } else {
        const since = now - new Date(lastHeartbeatAt).getTime();
        if (since <= cadenceMs * 1.5) heartbeatState = 'healthy';
        else if (since <= cadenceMs * 4) heartbeatState = 'lagging';
        else heartbeatState = 'stale';
      }

      let progressPercent = currentTask ? STATUS_BASELINE[currentTask.status] : 0;
      const progressLabel = currentTask ? currentTask.status.replace('_', ' ') : 'idle';

      if (currentTask) {
        const rollup = activityByTaskAgent.get(`${currentTask.id}:${agent.id}`);
        const heartbeatCount = Number(rollup?.heartbeat_count || 0);
        const boost = Math.min(20, heartbeatCount * 3);
        progressPercent = Math.min(97, progressPercent + boost);
        if (currentTask.status === 'review') progressPercent = Math.max(progressPercent, 95);
        if (currentTask.status === 'testing') progressPercent = Math.max(progressPercent, 85);
      }

      const roleSummary = currentTask?.delegation_rationale?.trim()
        || agent.description?.trim()
        || `${agent.role} specialist`;

      return {
        agent_id: agent.id,
        current_job: currentTask
          ? {
              task_id: currentTask.id,
              title: currentTask.title,
              status: currentTask.status,
              priority: currentTask.priority,
              assigned_at: currentTask.created_at,
              updated_at: currentTask.updated_at,
              rationale: currentTask.delegation_rationale || undefined,
              output_contract: currentTask.expected_output_contract || undefined,
            }
          : null,
        queue_depth: queueDepth,
        progress_percent: progressPercent,
        progress_label: progressLabel,
        completed_24h: throughputByAgent.get(agent.id) || 0,
        last_heartbeat_at: lastHeartbeatAt,
        next_heartbeat_at: nextHeartbeatAt,
        heartbeat_state: heartbeatState,
        heartbeat_source: heartbeatSource,
        cadence,
        cadence_ms: cadenceMs,
        role_summary: roleSummary,
      };
    });

    return NextResponse.json({ workspace_id: workspaceId, snapshots });
  } catch (error) {
    console.error('Failed to build agent runtime snapshots:', error);
    return NextResponse.json({ error: 'Failed to load agent runtime snapshots' }, { status: 500 });
  }
}
