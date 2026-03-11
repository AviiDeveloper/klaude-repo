import { NextRequest, NextResponse } from 'next/server';
import { getEvalSpecById, updateEvalSpec } from '@/lib/evals';
import type { UpdateEvalSpecRequest } from '@/lib/types';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export const dynamic = 'force-dynamic';

// GET /api/evals/specs/:id
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const spec = getEvalSpecById(id);
    if (!spec) return NextResponse.json({ error: 'Eval spec not found' }, { status: 404 });
    return NextResponse.json(spec);
  } catch (error) {
    console.error('Failed to fetch eval spec:', error);
    return NextResponse.json({ error: 'Failed to fetch eval spec' }, { status: 500 });
  }
}

// PATCH /api/evals/specs/:id
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body: UpdateEvalSpecRequest = await request.json();
    const updated = updateEvalSpec(id, {
      taskType: body.task_type,
      criteria: body.criteria,
      rubric: body.rubric,
    });
    if (!updated) return NextResponse.json({ error: 'Eval spec not found' }, { status: 404 });
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Failed to update eval spec:', error);
    return NextResponse.json({ error: 'Failed to update eval spec' }, { status: 500 });
  }
}
