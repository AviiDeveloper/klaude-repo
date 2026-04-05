import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import type { ChecklistItem, ChecklistStatus } from '@/lib/pulse/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = getDb();
    const items = db.prepare('SELECT * FROM launch_checklist ORDER BY app, created_at').all() as ChecklistItem[];

    // Group by app
    const byApp: Record<string, ChecklistItem[]> = {};
    for (const item of items) {
      if (!byApp[item.app]) byApp[item.app] = [];
      byApp[item.app].push(item);
    }

    return NextResponse.json({ checklist: byApp });
  } catch (err) {
    console.error('[Pulse] Failed to load checklist:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load checklist' },
      { status: 500 }
    );
  }
}

const VALID_STATUSES = new Set<ChecklistStatus>(['pending', 'done', 'blocked']);

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, status, notes } = body as { id?: string; status?: string; notes?: string };

    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    if (status && !VALID_STATUSES.has(status as ChecklistStatus)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const db = getDb();

    if (status && notes !== undefined) {
      db.prepare("UPDATE launch_checklist SET status=?, notes=?, updated_at=datetime('now') WHERE id=?").run(status, notes, id);
    } else if (status) {
      db.prepare("UPDATE launch_checklist SET status=?, updated_at=datetime('now') WHERE id=?").run(status, id);
    } else if (notes !== undefined) {
      db.prepare("UPDATE launch_checklist SET notes=?, updated_at=datetime('now') WHERE id=?").run(notes, id);
    }

    const updated = db.prepare('SELECT * FROM launch_checklist WHERE id=?').get(id) as ChecklistItem | undefined;
    if (!updated) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (err) {
    console.error('[Pulse] Failed to update checklist:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Update failed' },
      { status: 500 }
    );
  }
}
