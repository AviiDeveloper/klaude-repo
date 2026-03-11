import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { queryOne, run } from '@/lib/db';
import { createApprovalRequest, ensureLeadAgent } from '@/lib/lead-orchestrator';
import type { Task } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = (await request.json()) as {
      workspace_id?: string;
      recommendation?: string;
      risks?: string[];
      decision_options?: string[];
      finding_id?: string;
      requested_by_agent_id?: string;
    };

    if (!body.recommendation || body.recommendation.trim().length < 4) {
      return NextResponse.json({ error: 'recommendation is required' }, { status: 400 });
    }

    const task = queryOne<Task>('SELECT * FROM tasks WHERE id = ?', [id]);
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }
    const workspaceId = body.workspace_id || task.workspace_id || 'default';
    const lead = ensureLeadAgent(workspaceId);

    const created = createApprovalRequest({
      workspaceId,
      taskId: id,
      requestedByAgentId: body.requested_by_agent_id || lead.id,
      recommendation: body.recommendation.trim(),
      risks: Array.isArray(body.risks) ? body.risks.filter(Boolean) : [],
      decisionOptions:
        Array.isArray(body.decision_options) && body.decision_options.length > 0
          ? body.decision_options
          : ['approve', 'deny'],
      findingId: body.finding_id,
    });

    run(
      `INSERT INTO events (id, type, task_id, agent_id, message, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        'lead_approval_requested',
        id,
        lead.id,
        'Lead requested operator approval',
        JSON.stringify({ approval_request_id: created.id }),
        new Date().toISOString(),
      ],
    );

    return NextResponse.json({
      approval_request_id: created.id,
      status: created.status,
      outbound_event: {
        event_type: 'system.lead_approval_request',
        task_id: id,
        approval_request_id: created.id,
      },
    });
  } catch (error) {
    console.error('Failed to create lead approval request:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create lead approval request' },
      { status: 500 },
    );
  }
}
