import { NextResponse } from 'next/server';
import { getRecentAuditLogs, getAuditStats, ensureAuditSchema } from '@/lib/audit-logger';

export async function GET(request: Request): Promise<NextResponse> {
  ensureAuditSchema();

  const url = new URL(request.url);
  const action = url.searchParams.get('action') || 'logs';
  const limit = parseInt(url.searchParams.get('limit') || '50', 10);
  const component = url.searchParams.get('component') || undefined;
  const level = url.searchParams.get('level') || undefined;
  const taskId = url.searchParams.get('task_id') || undefined;

  if (action === 'stats') {
    const days = parseInt(url.searchParams.get('days') || '1', 10);
    const stats = getAuditStats(days);
    return NextResponse.json(stats);
  }

  const logs = getRecentAuditLogs(limit, { component, level, taskId });
  return NextResponse.json({ count: logs.length, logs });
}
