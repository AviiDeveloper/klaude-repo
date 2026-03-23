import { NextRequest, NextResponse } from 'next/server';
import { resolveAdminFromRequest } from '@/lib/admin-auth';
import { run, queryOne, transaction } from '@/lib/db';
import { randomUUID } from 'crypto';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = resolveAdminFromRequest(req);
  if (!admin || admin.role === 'viewer') {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const { user_id } = await req.json();
  if (!user_id) return NextResponse.json({ error: 'user_id required' }, { status: 400 });

  const leadId = params.id;
  const now = new Date().toISOString();

  try {
    transaction(() => {
      // Check for existing active assignment
      const existing = queryOne<{ id: string }>(
        "SELECT id FROM lead_assignments WHERE lead_id = ? AND status NOT IN ('rejected')", leadId
      );
      if (existing) throw new Error('ALREADY_ASSIGNED');

      const assignId = randomUUID();
      run(
        `INSERT INTO lead_assignments (id, lead_id, user_id, status, assigned_at, created_at, updated_at)
         VALUES (?, ?, ?, 'new', ?, ?, ?)`,
        assignId, leadId, user_id, now, now, now,
      );

      run(
        `INSERT INTO sales_activity_log (id, user_id, lead_id, assignment_id, action, notes, created_at)
         VALUES (?, ?, ?, ?, 'manual_assigned', ?, ?)`,
        randomUUID(), user_id, leadId, assignId, `Manually assigned by admin ${admin.name}`, now,
      );
    });

    return NextResponse.json({ data: { ok: true } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === 'ALREADY_ASSIGNED') {
      return NextResponse.json({ error: 'Lead already assigned' }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
