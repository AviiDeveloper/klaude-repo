import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

// GET /api/outreach/campaigns/:id - Get campaign details
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const db = getDb();
    const campaign = db.prepare('SELECT * FROM outreach_campaigns WHERE id = ?').get(id);

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Include lead stats
    const stats = db.prepare(`
      SELECT
        COUNT(*) as total_leads,
        SUM(CASE WHEN status = 'qualified' THEN 1 ELSE 0 END) as qualified,
        SUM(CASE WHEN status = 'contacted' THEN 1 ELSE 0 END) as contacted,
        SUM(CASE WHEN status = 'converted' THEN 1 ELSE 0 END) as converted,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected
      FROM outreach_leads WHERE campaign_id = ?
    `).get(id) as Record<string, number>;

    return NextResponse.json({ ...campaign as Record<string, unknown>, stats });
  } catch (error) {
    console.error('Failed to fetch campaign:', error);
    return NextResponse.json({ error: 'Failed to fetch campaign' }, { status: 500 });
  }
}

// PATCH /api/outreach/campaigns/:id - Update campaign
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const db = getDb();

    const existing = db.prepare('SELECT * FROM outreach_campaigns WHERE id = ?').get(id);
    if (!existing) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    const updates: string[] = [];
    const values: unknown[] = [];

    for (const field of ['name', 'target_vertical', 'target_location', 'status'] as const) {
      if (body[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(body[field]);
      }
    }

    if (body.config !== undefined) {
      updates.push('config_json = ?');
      values.push(JSON.stringify(body.config));
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    updates.push("updated_at = datetime('now')");
    values.push(id);

    db.prepare(`UPDATE outreach_campaigns SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const updated = db.prepare('SELECT * FROM outreach_campaigns WHERE id = ?').get(id);
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Failed to update campaign:', error);
    return NextResponse.json({ error: 'Failed to update campaign' }, { status: 500 });
  }
}
