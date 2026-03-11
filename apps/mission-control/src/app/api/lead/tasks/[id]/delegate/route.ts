import { NextRequest, NextResponse } from 'next/server';
import { queryOne, run } from '@/lib/db';
import { delegateTask, ensureLeadAgent, intakeTask } from '@/lib/lead-orchestrator';
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
      delegated_to_agent_id?: string;
      rationale?: string;
      expected_output_contract?: string;
      timeout_ms?: number;
      retry_limit?: number;
    };

    const task = queryOne<Task>('SELECT * FROM tasks WHERE id = ?', [id]);
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }
    const workspaceId = body.workspace_id || task.workspace_id || 'default';
    const lead = ensureLeadAgent(workspaceId);

    intakeTask({ taskId: id, workspaceId });
    run('UPDATE lead_task_intake SET status = ?, updated_at = ? WHERE task_id = ?', [
      'triage',
      new Date().toISOString(),
      id,
    ]);

    const result = delegateTask({
      taskId: id,
      workspaceId,
      delegatedByAgentId: lead.id,
      delegatedToAgentId: body.delegated_to_agent_id,
      rationale: body.rationale,
      expectedOutputContract: body.expected_output_contract,
      timeoutMs: body.timeout_ms,
      retryLimit: body.retry_limit,
    });

    return NextResponse.json({
      delegation: result.delegation,
      selected_agent: result.selected,
      score_reasons: result.scoreReasons,
    });
  } catch (error) {
    console.error('Failed to delegate task:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delegate task' },
      { status: 500 },
    );
  }
}
