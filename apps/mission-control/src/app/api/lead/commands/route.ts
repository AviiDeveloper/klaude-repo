import { NextRequest, NextResponse } from 'next/server';
import { isOperatorAuthorized } from '@/lib/lead-auth';
import { recordLeadOperatorCommand } from '@/lib/lead-orchestrator';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      workspace_id?: string;
      task_id?: string;
      operator_id?: string;
      command?: string;
      metadata?: Record<string, unknown>;
      event_type?: string;
    };

    if (!body.operator_id || !body.command) {
      return NextResponse.json({ error: 'operator_id and command are required' }, { status: 400 });
    }
    const workspaceId = body.workspace_id || 'default';

    if (!isOperatorAuthorized(workspaceId, body.operator_id)) {
      return NextResponse.json({ error: 'Operator not authorized for Lead control' }, { status: 403 });
    }

    recordLeadOperatorCommand({
      workspaceId,
      taskId: body.task_id,
      operatorId: body.operator_id,
      command: body.command,
      metadata: {
        ...(body.metadata || {}),
        inbound_event: body.event_type || 'openclaw.lead_command',
      },
    });

    return NextResponse.json({
      accepted: true,
      inbound_event: body.event_type || 'openclaw.lead_command',
      outbound_event: 'system.lead_status',
    });
  } catch (error) {
    console.error('Failed to process lead command:', error);
    return NextResponse.json({ error: 'Failed to process lead command' }, { status: 500 });
  }
}
