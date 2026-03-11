import { NextRequest, NextResponse } from 'next/server';
import { createEvalSpec, listEvalSpecs } from '@/lib/evals';
import type { CreateEvalSpecRequest } from '@/lib/types';

export const dynamic = 'force-dynamic';

// GET /api/evals/specs?workspace_id=default&agent_id=...
export async function GET(request: NextRequest) {
  try {
    const workspaceId = request.nextUrl.searchParams.get('workspace_id') || 'default';
    const agentId = request.nextUrl.searchParams.get('agent_id') || undefined;
    return NextResponse.json(listEvalSpecs(workspaceId, agentId));
  } catch (error) {
    console.error('Failed to list eval specs:', error);
    return NextResponse.json({ error: 'Failed to list eval specs' }, { status: 500 });
  }
}

// POST /api/evals/specs
export async function POST(request: NextRequest) {
  try {
    const body: CreateEvalSpecRequest = await request.json();
    if (!body.task_type || body.task_type.trim().length < 2) {
      return NextResponse.json({ error: 'task_type is required' }, { status: 400 });
    }

    const created = createEvalSpec({
      workspaceId: body.workspace_id || 'default',
      agentId: body.agent_id || null,
      taskType: body.task_type.trim(),
      criteria: body.criteria ?? {},
      rubric: body.rubric ?? {},
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('Failed to create eval spec:', error);
    return NextResponse.json({ error: 'Failed to create eval spec' }, { status: 500 });
  }
}
