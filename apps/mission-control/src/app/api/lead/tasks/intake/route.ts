import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';
import { ensureLeadAgent, intakeTask } from '@/lib/lead-orchestrator';
import type { Task } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      task_id?: string;
      workspace_id?: string;
      triage_summary?: string;
    };

    if (!body.task_id) {
      return NextResponse.json({ error: 'task_id is required' }, { status: 400 });
    }

    const task = queryOne<Task>('SELECT * FROM tasks WHERE id = ?', [body.task_id]);
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const workspaceId = body.workspace_id || task.workspace_id || 'default';
    const lead = ensureLeadAgent(workspaceId);
    const queueItem = intakeTask({
      taskId: task.id,
      workspaceId,
      triageSummary: body.triage_summary,
    });

    return NextResponse.json({ lead_agent: lead, queue_item: queueItem });
  } catch (error) {
    console.error('Failed to intake task:', error);
    return NextResponse.json({ error: 'Failed to intake task' }, { status: 500 });
  }
}
