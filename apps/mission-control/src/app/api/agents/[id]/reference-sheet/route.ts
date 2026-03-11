import { NextResponse } from 'next/server';
import { queryOne, queryAll } from '@/lib/db';
import type { Agent, AgentReferenceSheet } from '@/lib/types';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const includeHistory = new URL(request.url).searchParams.get('history') === 'true';

    const agent = queryOne<Agent>('SELECT * FROM agents WHERE id = ?', [id]);
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    if (includeHistory) {
      const sheets = queryAll<AgentReferenceSheet>(
        `SELECT * FROM agent_reference_sheets WHERE agent_id = ? ORDER BY version DESC`,
        [id],
      );
      return NextResponse.json({ agent_id: id, sheets });
    }

    const latest = queryOne<AgentReferenceSheet>(
      `SELECT * FROM agent_reference_sheets WHERE agent_id = ? ORDER BY version DESC LIMIT 1`,
      [id],
    );

    return NextResponse.json({ agent_id: id, latest: latest || null });
  } catch (error) {
    console.error('Failed to fetch agent reference sheet:', error);
    return NextResponse.json({ error: 'Failed to fetch reference sheet' }, { status: 500 });
  }
}
