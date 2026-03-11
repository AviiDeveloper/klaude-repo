import { NextRequest, NextResponse } from 'next/server';
import { getLatestLearningQuestion } from '@/lib/learning';

export const dynamic = 'force-dynamic';

// GET /api/learning/questions/latest?workspace_id=...
export async function GET(request: NextRequest) {
  try {
    const workspaceId = request.nextUrl.searchParams.get('workspace_id') || 'default';
    const question = getLatestLearningQuestion(workspaceId);
    return NextResponse.json({ question: question || null });
  } catch (error) {
    console.error('Failed to load latest learning question:', error);
    return NextResponse.json({ error: 'Failed to load latest learning question' }, { status: 500 });
  }
}
