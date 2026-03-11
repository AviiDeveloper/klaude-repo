import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';
import { runTaskEvaluation } from '@/lib/evals';
import type { RunEvalRequest } from '@/lib/types';

export const dynamic = 'force-dynamic';

// POST /api/evals/run
export async function POST(request: NextRequest) {
  try {
    const body: RunEvalRequest = await request.json();
    if (!body.task_id) {
      return NextResponse.json({ error: 'task_id is required' }, { status: 400 });
    }

    const workspaceId = body.workspace_id || 'default';
    const task = queryOne<{ id: string; assigned_agent_id?: string | null }>(
      'SELECT id, assigned_agent_id FROM tasks WHERE id = ? AND workspace_id = ?',
      [body.task_id, workspaceId],
    );
    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

    let agentId = body.agent_id || task.assigned_agent_id || undefined;
    if (!agentId) {
      const latestDelegation = queryOne<{ delegated_to_agent_id?: string | null }>(
        `SELECT delegated_to_agent_id FROM lead_task_delegations
         WHERE task_id = ?
         ORDER BY created_at DESC
         LIMIT 1`,
        [body.task_id],
      );
      agentId = latestDelegation?.delegated_to_agent_id || undefined;
    }

    if (!agentId) {
      return NextResponse.json(
        { error: 'agent_id could not be resolved for evaluation' },
        { status: 400 },
      );
    }

    const result = runTaskEvaluation({
      workspaceId,
      taskId: body.task_id,
      agentId,
      delegationId: body.delegation_id,
      evalSpecId: body.eval_spec_id,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Failed to run evaluation:', error);
    return NextResponse.json({ error: 'Failed to run evaluation' }, { status: 500 });
  }
}
