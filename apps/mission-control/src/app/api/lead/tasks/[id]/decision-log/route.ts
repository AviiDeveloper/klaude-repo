import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';
import { listTaskDecisionLog } from '@/lib/lead-orchestrator';
import type { Task } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const task = queryOne<Task>('SELECT * FROM tasks WHERE id = ?', [id]);
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }
    const logs = listTaskDecisionLog(id);
    return NextResponse.json({ task_id: id, count: logs.length, logs });
  } catch (error) {
    console.error('Failed to fetch lead decision log:', error);
    return NextResponse.json({ error: 'Failed to fetch lead decision log' }, { status: 500 });
  }
}
