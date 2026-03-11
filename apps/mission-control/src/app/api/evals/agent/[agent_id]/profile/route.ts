import { NextResponse } from 'next/server';
import { queryAll, queryOne } from '@/lib/db';
import type { AgentEvalRun, AgentPerformanceProfile } from '@/lib/types';

interface RouteParams {
  params: Promise<{ agent_id: string }>;
}

export const dynamic = 'force-dynamic';

// GET /api/evals/agent/:agent_id/profile
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { agent_id } = await params;
    const profile = queryOne<AgentPerformanceProfile>(
      'SELECT * FROM agent_performance_profiles WHERE agent_id = ?',
      [agent_id],
    );

    const recentRuns = queryAll<AgentEvalRun>(
      `SELECT * FROM agent_eval_runs
       WHERE agent_id = ?
       ORDER BY evaluated_at DESC
       LIMIT 20`,
      [agent_id],
    );

    return NextResponse.json({
      profile: profile || null,
      recent_runs: recentRuns,
    });
  } catch (error) {
    console.error('Failed to load agent eval profile:', error);
    return NextResponse.json({ error: 'Failed to load agent eval profile' }, { status: 500 });
  }
}
