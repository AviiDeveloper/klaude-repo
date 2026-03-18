import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

// GET /api/outreach/campaigns - List campaigns
export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const workspaceId = request.nextUrl.searchParams.get('workspace_id') ?? 'default';
    const status = request.nextUrl.searchParams.get('status');

    let query = 'SELECT * FROM outreach_campaigns WHERE workspace_id = ?';
    const params: string[] = [workspaceId];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC';

    const campaigns = db.prepare(query).all(...params);
    return NextResponse.json(campaigns);
  } catch (error) {
    console.error('Failed to fetch campaigns:', error);
    return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 });
  }
}

// POST /api/outreach/campaigns - Create a campaign
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, target_vertical, target_location, workspace_id, config } = body;

    if (!name || !target_vertical || !target_location) {
      return NextResponse.json(
        { error: 'name, target_vertical, and target_location are required' },
        { status: 400 },
      );
    }

    const db = getDb();
    const id = crypto.randomUUID();
    const wsId = workspace_id ?? 'default';

    db.prepare(`
      INSERT INTO outreach_campaigns (id, workspace_id, name, target_vertical, target_location, config_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, wsId, name, target_vertical, target_location, config ? JSON.stringify(config) : null);

    const campaign = db.prepare('SELECT * FROM outreach_campaigns WHERE id = ?').get(id);
    return NextResponse.json(campaign, { status: 201 });
  } catch (error) {
    console.error('Failed to create campaign:', error);
    return NextResponse.json({ error: 'Failed to create campaign' }, { status: 500 });
  }
}
