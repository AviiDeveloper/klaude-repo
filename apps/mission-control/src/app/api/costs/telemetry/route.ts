import { NextRequest, NextResponse } from 'next/server';
import { queryAll } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const workspaceId = request.nextUrl.searchParams.get('workspace_id')?.trim();
    const limitRaw = Number(request.nextUrl.searchParams.get('limit') || '100');
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(500, Math.floor(limitRaw))) : 100;

    const rows = workspaceId
      ? queryAll(
          `SELECT art.*
             FROM ai_request_telemetry art
             LEFT JOIN openclaw_sessions os ON os.openclaw_session_id = art.session_id
             LEFT JOIN agents a ON a.id = os.agent_id
            WHERE a.workspace_id = ?
            ORDER BY art.created_at DESC
            LIMIT ?`,
          [workspaceId, limit],
        )
      : queryAll(
          `SELECT *
             FROM ai_request_telemetry
            ORDER BY created_at DESC
            LIMIT ?`,
          [limit],
        );

    return NextResponse.json({
      count: rows.length,
      limit,
      workspace_id: workspaceId || null,
      records: rows,
    });
  } catch (error) {
    console.error('Failed to load telemetry records:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load telemetry records' },
      { status: 500 },
    );
  }
}
