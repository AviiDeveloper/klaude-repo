import { NextRequest, NextResponse } from 'next/server';
import { buildLeadMemoryPacket } from '@/lib/lead-orchestrator';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const workspaceId = request.nextUrl.searchParams.get('workspace_id') || 'default';
    const taskId = request.nextUrl.searchParams.get('task_id') || undefined;

    const packet = buildLeadMemoryPacket({
      workspaceId,
      taskId,
    });

    return NextResponse.json({
      workspace_id: workspaceId,
      task_id: taskId || null,
      packet,
    });
  } catch (error) {
    console.error('Failed to build lead memory packet:', error);
    return NextResponse.json({ error: 'Failed to build lead memory packet' }, { status: 500 });
  }
}
