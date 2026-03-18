import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

// GET /api/outreach/sites/:id - Get site with full HTML output
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const db = getDb();
    const site = db.prepare('SELECT * FROM generated_sites WHERE id = ?').get(id);

    if (!site) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    return NextResponse.json(site);
  } catch (error) {
    console.error('Failed to fetch site:', error);
    return NextResponse.json({ error: 'Failed to fetch site' }, { status: 500 });
  }
}

// PATCH /api/outreach/sites/:id - Update site status (approve/reject)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const db = getDb();

    const existing = db.prepare('SELECT * FROM generated_sites WHERE id = ?').get(id);
    if (!existing) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    const updates: string[] = [];
    const values: unknown[] = [];

    if (body.status !== undefined) {
      updates.push('status = ?');
      values.push(body.status);

      if (body.status === 'approved') {
        updates.push('approved_by = ?', "approved_at = datetime('now')");
        values.push(body.approved_by ?? 'operator');
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    updates.push("updated_at = datetime('now')");
    values.push(id);

    db.prepare(`UPDATE generated_sites SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const updated = db.prepare('SELECT * FROM generated_sites WHERE id = ?').get(id);
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Failed to update site:', error);
    return NextResponse.json({ error: 'Failed to update site' }, { status: 500 });
  }
}
