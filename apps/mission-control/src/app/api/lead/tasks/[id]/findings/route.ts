import { NextRequest, NextResponse } from 'next/server';
import { queryOne, run } from '@/lib/db';
import { createFinding, evaluateDelegationOutcome } from '@/lib/lead-orchestrator';
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
      agent_id?: string;
      summary?: string;
      evidence?: unknown;
      risk_level?: 'low' | 'medium' | 'high' | 'critical';
      recommendation?: string;
    };

    if (!body.agent_id || !body.summary) {
      return NextResponse.json({ error: 'agent_id and summary are required' }, { status: 400 });
    }

    const task = queryOne<Task>('SELECT * FROM tasks WHERE id = ?', [id]);
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }
    const workspaceId = body.workspace_id || task.workspace_id || 'default';

    const finding = createFinding({
      workspaceId,
      taskId: id,
      agentId: body.agent_id,
      summary: body.summary,
      evidence: body.evidence,
      riskLevel: body.risk_level,
      recommendation: body.recommendation,
    });

    run('UPDATE lead_task_delegations SET status = ?, updated_at = ? WHERE task_id = ? AND delegated_to_agent_id = ?', [
      'completed',
      new Date().toISOString(),
      id,
      body.agent_id,
    ]);

    const evaluation = evaluateDelegationOutcome({
      workspaceId,
      taskId: id,
      agentId: body.agent_id,
    });

    return NextResponse.json({
      finding_id: finding.id,
      status: finding.status,
      evaluation: {
        run_id: evaluation.eval_run.id,
        score: evaluation.eval_run.quality_score,
        status: evaluation.eval_run.status,
        confidence: evaluation.eval_run.confidence,
        fault_attribution: evaluation.eval_run.fault_attribution,
        action: evaluation.action,
      },
    });
  } catch (error) {
    console.error('Failed to submit lead finding:', error);
    return NextResponse.json({ error: 'Failed to submit lead finding' }, { status: 500 });
  }
}
