import { NextRequest, NextResponse } from 'next/server';
import { scoreLearningAnswer } from '@/lib/learning';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export const dynamic = 'force-dynamic';

// POST /api/learning/questions/:id/answer
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = (await request.json()) as {
      workspace_id?: string;
      operator_id?: string;
      answer_text?: string;
    };

    if (!body.answer_text || body.answer_text.trim().length < 8) {
      return NextResponse.json({ error: 'answer_text is required (min 8 chars)' }, { status: 400 });
    }

    const result = scoreLearningAnswer({
      questionId: id,
      workspaceId: body.workspace_id || 'default',
      operatorId: body.operator_id,
      answerText: body.answer_text,
    });

    return NextResponse.json(
      {
        result_record: result,
        ...result,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Failed to score learning answer:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to score learning answer' },
      { status: 500 },
    );
  }
}
