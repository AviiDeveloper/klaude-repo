import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { queryOne, run } from '@/lib/db';
import { getOpenClawClient } from '@/lib/openclaw/client';
import { broadcast } from '@/lib/events';
import { getProjectsPath, getMissionControlUrl } from '@/lib/config';
import { getAgentApiAuthHeaders, isAgentApiTokenEnabled } from '@/lib/agent-api-auth';
import { buildMemoryPacket, formatMemoryPacketForPrompt } from '@/lib/memory/packet';
import { getLatestDelegation } from '@/lib/lead-orchestrator';
import {
  buildProfessionalStandardFromFactory,
  formatProfessionalStandardForPrompt,
} from '@/lib/agent-professional-standard';
import type { Task, Agent, OpenClawSession } from '@/lib/types';

interface RouteParams {
  params: Promise<{ id: string }>;
}

function logTaskActivity(params: {
  taskId: string;
  agentId: string;
  activityType: 'spawned' | 'updated' | 'completed' | 'status_changed';
  message: string;
  metadata?: Record<string, unknown>;
}) {
  const activityId = uuidv4();
  const createdAt = new Date().toISOString();
  run(
    `INSERT INTO task_activities (id, task_id, agent_id, activity_type, message, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      activityId,
      params.taskId,
      params.agentId,
      params.activityType,
      params.message,
      params.metadata ? JSON.stringify(params.metadata) : null,
      createdAt,
    ],
  );

  broadcast({
    type: 'activity_logged',
    payload: {
      id: activityId,
      task_id: params.taskId,
      agent_id: params.agentId,
      activity_type: params.activityType,
      message: params.message,
      metadata: params.metadata ? JSON.stringify(params.metadata) : undefined,
      created_at: createdAt,
    },
  });
}

function touchTaskUpdatedAt(taskId: string) {
  const now = new Date().toISOString();
  run('UPDATE tasks SET updated_at = ? WHERE id = ?', [now, taskId]);
  const refreshed = queryOne<Task>('SELECT * FROM tasks WHERE id = ?', [taskId]);
  if (refreshed) {
    broadcast({
      type: 'task_updated',
      payload: refreshed,
    });
  }
}

/**
 * POST /api/tasks/[id]/dispatch
 * 
 * Dispatches a task to its assigned agent's OpenClaw session.
 * Creates session if needed, sends task details to agent.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Get task with agent info
    const task = queryOne<Task & { assigned_agent_name?: string }>(
      `SELECT t.*, a.name as assigned_agent_name, a.is_master
       FROM tasks t
       LEFT JOIN agents a ON t.assigned_agent_id = a.id
       WHERE t.id = ?`,
      [id]
    );

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    if (!task.assigned_agent_id) {
      return NextResponse.json(
        { error: 'Task has no assigned agent' },
        { status: 400 }
      );
    }

    // Get agent details
    const agent = queryOne<Agent>(
      'SELECT * FROM agents WHERE id = ?',
      [task.assigned_agent_id]
    );

    if (!agent) {
      return NextResponse.json({ error: 'Assigned agent not found' }, { status: 404 });
    }

    const latestDelegation = getLatestDelegation(task.id);
    if (!latestDelegation || latestDelegation.delegated_to_agent_id !== agent.id) {
      return NextResponse.json(
        {
          error: 'Dispatch blocked: no valid Lead delegation for assigned agent',
        },
        { status: 403 },
      );
    }

    // Connect to OpenClaw Gateway
    const client = getOpenClawClient();
    if (!client.isConnected()) {
      try {
        await client.connect();
      } catch (err) {
        console.error('Failed to connect to OpenClaw Gateway:', err);
        return NextResponse.json(
          { error: 'Failed to connect to OpenClaw Gateway' },
          { status: 503 }
        );
      }
    }

    // Get or create OpenClaw session for this agent
    let session = queryOne<OpenClawSession>(
      'SELECT * FROM openclaw_sessions WHERE agent_id = ? AND status = ?',
      [agent.id, 'active']
    );

    const now = new Date().toISOString();

    if (!session) {
      // Create session record
      const sessionId = uuidv4();
      const openclawSessionId = `mission-control-${agent.name.toLowerCase().replace(/\s+/g, '-')}`;
      
      run(
        `INSERT INTO openclaw_sessions (id, agent_id, openclaw_session_id, channel, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [sessionId, agent.id, openclawSessionId, 'mission-control', 'active', now, now]
      );

      session = queryOne<OpenClawSession>(
        'SELECT * FROM openclaw_sessions WHERE id = ?',
        [sessionId]
      );

      // Log session creation
      run(
        `INSERT INTO events (id, type, agent_id, message, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [uuidv4(), 'agent_status_changed', agent.id, `${agent.name} session created`, now]
      );
    }

    if (!session) {
      return NextResponse.json(
        { error: 'Failed to create agent session' },
        { status: 500 }
      );
    }

    // Build task message for agent
    const priorityEmoji = {
      low: '🔵',
      normal: '⚪',
      high: '🟡',
      urgent: '🔴'
    }[task.priority] || '⚪';

    // Get project path for deliverables
    const projectsPath = getProjectsPath();
    const projectDir = task.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const taskProjectDir = `${projectsPath}/${projectDir}`;
    const missionControlUrl = getMissionControlUrl();
    const authHeaders = getAgentApiAuthHeaders();
    const authInstruction = isAgentApiTokenEnabled()
      ? `\n**API AUTH REQUIRED:** Include header \`Authorization: ${authHeaders.Authorization || ''}\` in every Mission Control API request.\n`
      : '';
    const memoryPacket = buildMemoryPacket({
      workspaceId: task.workspace_id,
      taskId: task.id,
      agentId: agent.id,
    });
    const memoryPrompt = formatMemoryPacketForPrompt(memoryPacket);
    const latestReference = queryOne<{ metadata?: string }>(
      `SELECT metadata
       FROM agent_reference_sheets
       WHERE agent_id = ?
         AND COALESCE(lifecycle_state, 'active') != 'archived'
       ORDER BY
         CASE WHEN COALESCE(lifecycle_state, 'active') = 'active' THEN 0 ELSE 1 END,
         version DESC
       LIMIT 1`,
      [agent.id],
    );
    let professionalStandard = buildProfessionalStandardFromFactory({
      workspace_id: task.workspace_id,
      name: agent.name,
      role: agent.role,
      objective: task.description || task.title,
      specialization: agent.role,
      autonomy_level: 'semi-autonomous',
      risk_tolerance: 'medium',
      tool_stack: [],
      handoff_targets: [],
      approval_required_actions: [],
      output_contract: 'Return concise, structured completion outputs with evidence and confidence.',
      cadence: 'event-driven',
    });
    if (latestReference?.metadata) {
      try {
        const parsed = JSON.parse(latestReference.metadata) as {
          professional_standard?: unknown;
        };
        if (parsed.professional_standard && typeof parsed.professional_standard === 'object') {
          professionalStandard = parsed.professional_standard as ReturnType<
            typeof buildProfessionalStandardFromFactory
          >;
        }
      } catch {
        // Keep default synthesized standard if metadata parse fails.
      }
    }
    const professionalStandardPrompt = formatProfessionalStandardForPrompt({
      standard: professionalStandard,
      task,
      agent,
      memoryPacket,
    });

    const taskMessage = `${priorityEmoji} **NEW TASK ASSIGNED**

**Title:** ${task.title}
${task.description ? `**Description:** ${task.description}\n` : ''}
**Priority:** ${task.priority.toUpperCase()}
${task.due_date ? `**Due:** ${task.due_date}\n` : ''}
**Task ID:** ${task.id}

**OUTPUT DIRECTORY:** ${taskProjectDir}
Create this directory and save all deliverables there.
${authInstruction}

**PERSISTENT MEMORY CONTEXT (APPLY THIS)**
${memoryPrompt}

${professionalStandardPrompt}

**IMPORTANT:** After completing work, you MUST call these APIs:
1. Log activity: POST ${missionControlUrl}/api/tasks/${task.id}/activities
   Body: {"activity_type": "completed", "message": "Description of what was done"}
2. Register deliverable: POST ${missionControlUrl}/api/tasks/${task.id}/deliverables
   Body: {"deliverable_type": "file", "title": "File name", "path": "${taskProjectDir}/filename.html"}
3. Submit findings to Lead: POST ${missionControlUrl}/api/lead/tasks/${task.id}/findings
   Body: {"agent_id":"${agent.id}","summary":"What was found","evidence":{"key":"value"},"risk_level":"low|medium|high|critical","recommendation":"proposed next action"}
4. If side effects or policy-risk actions are required, request operator decision through Lead:
   POST ${missionControlUrl}/api/lead/tasks/${task.id}/approval-request
   Body: {"requested_by_agent_id":"${agent.id}","recommendation":"approve/deny context","risks":["risk 1","risk 2"],"decision_options":["approve","deny"]}
5. Update status: PATCH ${missionControlUrl}/api/tasks/${task.id}
   Body: {"status": "review"}

When complete, reply with:
\`TASK_COMPLETE: [brief summary of what you did]\`

If you need help or clarification, ask me (Charlie).`;

    // Send message to agent's session using chat.send
    try {
      // Use sessionKey for routing to the agent's session
      // Format: agent:main:{openclaw_session_id}
      const sessionKey = `agent:main:${session.openclaw_session_id}`;
      const dispatchRunId = `dispatch-${task.id}-${Date.now()}`;
      await client.call('chat.send', {
        sessionKey,
        message: taskMessage,
        idempotencyKey: dispatchRunId
      });

      // Update task status to in_progress
      run(
        'UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?',
        ['in_progress', now, id]
      );
      run(
        'UPDATE lead_task_delegations SET status = ?, updated_at = ? WHERE id = ?',
        ['running', now, latestDelegation.id],
      );
      run(
        'UPDATE lead_task_intake SET status = ?, updated_at = ? WHERE task_id = ?',
        ['monitoring', now, task.id],
      );

      // Broadcast task update
      const updatedTask = queryOne<Task>('SELECT * FROM tasks WHERE id = ?', [id]);
      if (updatedTask) {
        broadcast({
          type: 'task_updated',
          payload: updatedTask,
        });
      }

      // Update agent status to working
      run(
        'UPDATE agents SET status = ?, updated_at = ? WHERE id = ?',
        ['working', now, agent.id]
      );

      // Log dispatch event
      run(
        `INSERT INTO events (id, type, agent_id, task_id, message, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          'task_dispatched',
          agent.id,
          task.id,
          `Task "${task.title}" dispatched to ${agent.name}`,
          now
        ]
      );

      logTaskActivity({
        taskId: task.id,
        agentId: agent.id,
        activityType: 'spawned',
        message: `${agent.name} accepted dispatch and started execution`,
        metadata: {
          sessionKey,
          runId: dispatchRunId,
        },
      });

      // Non-blocking run monitor: emits heartbeat activity while long tasks execute.
      (async () => {
        let heartbeatCount = 0;
        const maxHeartbeats = 20; // 10 minutes at 30s cadence
        const heartbeatMs = 30000;
        const timer = setInterval(() => {
          heartbeatCount += 1;
          if (heartbeatCount > maxHeartbeats) {
            clearInterval(timer);
            return;
          }
          logTaskActivity({
            taskId: task.id,
            agentId: agent.id,
            activityType: 'updated',
            message: `${agent.name} is still executing this task`,
            metadata: {
              runId: dispatchRunId,
              heartbeat: heartbeatCount,
            },
          });
          touchTaskUpdatedAt(task.id);
        }, heartbeatMs);

        try {
          const waitResult = await client.call<Record<string, unknown>>('agent.wait', {
            runId: dispatchRunId,
            timeoutMs: 600000,
          });
          clearInterval(timer);
          logTaskActivity({
            taskId: task.id,
            agentId: agent.id,
            activityType: 'updated',
            message: `${agent.name} reported run completion`,
            metadata: {
              runId: dispatchRunId,
              waitResult,
            },
          });
          run(
            'UPDATE lead_task_delegations SET status = ?, updated_at = ? WHERE id = ?',
            ['completed', new Date().toISOString(), latestDelegation.id],
          );
          run(
            'UPDATE lead_task_intake SET status = ?, updated_at = ? WHERE task_id = ?',
            ['monitoring', new Date().toISOString(), task.id],
          );
          touchTaskUpdatedAt(task.id);
        } catch (waitErr) {
          clearInterval(timer);
          logTaskActivity({
            taskId: task.id,
            agentId: agent.id,
            activityType: 'status_changed',
            message: `${agent.name} run monitor stopped before completion`,
            metadata: {
              runId: dispatchRunId,
              error: waitErr instanceof Error ? waitErr.message : String(waitErr),
            },
          });
          run(
            'UPDATE lead_task_delegations SET status = ?, last_error = ?, updated_at = ? WHERE id = ?',
            [
              'failed',
              waitErr instanceof Error ? waitErr.message : String(waitErr),
              new Date().toISOString(),
              latestDelegation.id,
            ],
          );
          run(
            'UPDATE lead_task_intake SET status = ?, updated_at = ? WHERE task_id = ?',
            ['blocked', new Date().toISOString(), task.id],
          );
          touchTaskUpdatedAt(task.id);
        }
      })().catch((err) => {
        console.error('Run monitor failed:', err);
      });

      return NextResponse.json({
        success: true,
        task_id: task.id,
        agent_id: agent.id,
        session_id: session.openclaw_session_id,
        message: 'Task dispatched to agent'
      });
    } catch (err) {
      console.error('Failed to send message to agent:', err);
      return NextResponse.json(
        { error: `Failed to send task to agent: ${err instanceof Error ? err.message : 'Unknown error'}` },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Failed to dispatch task:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to dispatch task' },
      { status: 500 }
    );
  }
}
