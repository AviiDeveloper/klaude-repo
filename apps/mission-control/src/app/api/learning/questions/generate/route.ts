import { NextRequest, NextResponse } from 'next/server';
import { generateLearningQuestion } from '@/lib/learning';

export const dynamic = 'force-dynamic';

// POST /api/learning/questions/generate
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      workspace_id?: string;
      source_type?: 'git_diff' | 'decision_log' | 'manual';
      source_ref?: string;
      prompt_context?: string;
    };

    const question = generateLearningQuestion({
      workspaceId: body.workspace_id || 'default',
      sourceType: body.source_type,
      sourceRef: body.source_ref,
      promptContext: body.prompt_context,
    });

    return NextResponse.json(
      {
        question_record: question,
        ...question,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Failed to generate learning question:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate learning question' },
      { status: 500 },
    );
  }
}
