import { NextRequest, NextResponse } from 'next/server';
import { buildMemoryPacket, formatMemoryPacketForPrompt } from '@/lib/memory/packet';

export const dynamic = 'force-dynamic';

// GET /api/memory/packet?workspace_id=default&task_id=...&agent_id=...
export async function GET(request: NextRequest) {
  try {
    const workspaceId = request.nextUrl.searchParams.get('workspace_id') || 'default';
    const taskId = request.nextUrl.searchParams.get('task_id') || undefined;
    const agentId = request.nextUrl.searchParams.get('agent_id') || undefined;

    const packet = buildMemoryPacket({
      workspaceId,
      taskId,
      agentId,
    });

    return NextResponse.json({
      packet,
      prompt_context: formatMemoryPacketForPrompt(packet),
    });
  } catch (error) {
    console.error('Failed to build memory packet:', error);
    return NextResponse.json({ error: 'Failed to build memory packet' }, { status: 500 });
  }
}
