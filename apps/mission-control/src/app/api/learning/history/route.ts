import { NextRequest, NextResponse } from 'next/server';
import { listLearningHistory } from '@/lib/learning';

export const dynamic = 'force-dynamic';

// GET /api/learning/history?workspace_id=...
export async function GET(request: NextRequest) {
  try {
    const workspaceId = request.nextUrl.searchParams.get('workspace_id') || 'default';
    return NextResponse.json({ history: listLearningHistory(workspaceId) });
  } catch (error) {
    console.error('Failed to load learning history:', error);
    return NextResponse.json({ error: 'Failed to load learning history' }, { status: 500 });
  }
}
