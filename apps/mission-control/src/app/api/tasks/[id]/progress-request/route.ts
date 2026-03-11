import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { queryOne, run } from '@/lib/db';
import { getOpenClawClient } from '@/lib/openclaw/client';
import type { Task, Agent, OpenClawSession } from '@/lib/types';

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface ProgressRequestBody {
  message?: string;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as ProgressRequestBody;

    const task = queryOne<Task>('SELECT * FROM tasks WHERE id = ?', [id]);
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }
    if (!task.assigned_agent_id) {
      return NextResponse.json({ error: 'Task has no assigned agent' }, { status: 400 });
    }

    const agent = queryOne<Agent>('SELECT * FROM agents WHERE id = ?', [task.assigned_agent_id]);
    if (!agent) {
      return NextResponse.json({ error: 'Assigned agent not found' }, { status: 404 });
    }

    const session = queryOne<OpenClawSession>(
      'SELECT * FROM openclaw_sessions WHERE agent_id = ? AND status = ? ORDER BY updated_at DESC LIMIT 1',
      [agent.id, 'active'],
    );
    if (!session) {
      return NextResponse.json(
        { error: 'No active OpenClaw session for assigned agent' },
        { status: 404 },
      );
    }

    const client = getOpenClawClient();
    if (!client.isConnected()) {
      await client.connect();
    }

    const prompt =
      typeof body.message === 'string' && body.message.trim().length > 0
        ? body.message.trim()
        : 'Provide a concise progress update for this task now: what is done, what is in-progress, blockers, and ETA.';

    const sessionKey = `agent:main:${session.openclaw_session_id}`;
    const requestId = `progress-request-${task.id}-${Date.now()}`;
    await client.call('chat.send', {
      sessionKey,
      message: `[Mission Control Progress Request]\nTask: ${task.title}\nTask ID: ${task.id}\n\n${prompt}`,
      idempotencyKey: requestId,
    });

    const now = new Date().toISOString();
    run(
      `INSERT INTO task_activities (id, task_id, agent_id, activity_type, message, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        task.id,
        agent.id,
        'updated',
        `Progress update requested from ${agent.name}`,
        JSON.stringify({ requestId, sessionKey }),
        now,
      ],
    );

    run(
      `INSERT INTO events (id, type, agent_id, task_id, message, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [uuidv4(), 'message_sent', agent.id, task.id, `Asked ${agent.name} for progress update`, now],
    );

    return NextResponse.json({ success: true, task_id: task.id, agent_id: agent.id, request_id: requestId });
  } catch (error) {
    console.error('Failed to request progress update:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to request progress update' },
      { status: 500 },
    );
  }
}

