import { NextRequest, NextResponse } from 'next/server';
import { queryAll } from '@/lib/db';
import {
  ensureLeadAgent,
  listLeadApprovals,
  listLeadQueue,
} from '@/lib/lead-orchestrator';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const workspaceId = request.nextUrl.searchParams.get('workspace_id') || 'default';
    const lead = ensureLeadAgent(workspaceId);
    const queue = listLeadQueue(workspaceId);
    const approvals = listLeadApprovals(workspaceId);
    const commands = queryAll<{
      id: string;
      operator_id: string;
      command: string;
      created_at: string;
    }>(
      `SELECT id, operator_id, command, created_at
       FROM lead_operator_commands
       WHERE workspace_id = ?
       ORDER BY created_at DESC
       LIMIT 20`,
      [workspaceId],
    );

    return NextResponse.json({
      workspace_id: workspaceId,
      lead_agent: lead,
      queue,
      approvals,
      operator_commands: commands,
    });
  } catch (error) {
    console.error('Failed to fetch lead queue:', error);
    return NextResponse.json({ error: 'Failed to fetch lead queue' }, { status: 500 });
  }
}
