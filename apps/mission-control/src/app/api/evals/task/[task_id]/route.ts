import { NextResponse } from 'next/server';
import { queryAll } from '@/lib/db';
import type { AgentEvalRun } from '@/lib/types';

interface RouteParams {
  params: Promise<{ task_id: string }>;
}

export const dynamic = 'force-dynamic';

// GET /api/evals/task/:task_id
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { task_id } = await params;
    const runs = queryAll<AgentEvalRun & { agent_name?: string | null; spec_task_type?: string | null }>(
      `SELECT
         r.*,
         a.name as agent_name,
         s.task_type as spec_task_type
       FROM agent_eval_runs r
       LEFT JOIN agents a ON a.id = r.agent_id
       LEFT JOIN agent_eval_specs s ON s.id = r.eval_spec_id
       WHERE r.task_id = ?
       ORDER BY r.evaluated_at DESC`,
      [task_id],
    );

    return NextResponse.json(runs);
  } catch (error) {
    console.error('Failed to load task evals:', error);
    return NextResponse.json({ error: 'Failed to load task evals' }, { status: 500 });
  }
}
