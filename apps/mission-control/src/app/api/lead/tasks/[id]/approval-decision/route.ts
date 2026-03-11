import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { queryOne, run } from '@/lib/db';
import { isOperatorAuthorized } from '@/lib/lead-auth';
import { resolveApprovalRequest } from '@/lib/lead-orchestrator';
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
      approval_request_id?: string;
      operator_id?: string;
      decision?: 'approved' | 'denied';
      rationale?: string;
    };

    if (!body.approval_request_id || !body.operator_id || !body.decision) {
      return NextResponse.json(
        { error: 'approval_request_id, operator_id, and decision are required' },
        { status: 400 },
      );
    }

    const task = queryOne<Task>('SELECT * FROM tasks WHERE id = ?', [id]);
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }
    const workspaceId = body.workspace_id || task.workspace_id || 'default';

    if (!isOperatorAuthorized(workspaceId, body.operator_id)) {
      return NextResponse.json({ error: 'Operator not authorized for Lead control' }, { status: 403 });
    }

    const resolved = resolveApprovalRequest({
      workspaceId,
      taskId: id,
      approvalRequestId: body.approval_request_id,
      operatorId: body.operator_id,
      decision: body.decision,
      rationale: body.rationale,
    });

    run(
      `INSERT INTO events (id, type, task_id, message, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        'lead_approval_resolved',
        id,
        `Operator ${body.decision} lead approval`,
        JSON.stringify({
          approval_request_id: body.approval_request_id,
          operator_id: body.operator_id,
          rationale: body.rationale || null,
        }),
        new Date().toISOString(),
      ],
    );

    return NextResponse.json({
      approval_request_id: resolved.id,
      status: resolved.status,
      outbound_event: {
        event_type: 'system.lead_status',
        task_id: id,
        status: resolved.status,
      },
    });
  } catch (error) {
    console.error('Failed to resolve lead approval decision:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to resolve lead approval decision' },
      { status: 500 },
    );
  }
}
