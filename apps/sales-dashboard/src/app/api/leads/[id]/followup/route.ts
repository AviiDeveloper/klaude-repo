import { NextRequest, NextResponse } from 'next/server';
import { resolveUserFromRequest } from '@/lib/auth';
import { run, queryOne } from '@/lib/db';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = resolveUserFromRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Auth required', code: 'AUTH_REQUIRED' }, { status: 401 });
  }

  const body = await req.json() as {
    follow_up_at?: string | null;
    follow_up_note?: string | null;
    contact_name?: string | null;
    contact_role?: string | null;
  };

  // Verify ownership
  const assignment = queryOne<{ id: string }>(
    'SELECT id FROM lead_assignments WHERE id = ? AND user_id = ?',
    params.id, auth.user_id,
  );

  if (!assignment) {
    return NextResponse.json({ error: 'Lead not found', code: 'NOT_FOUND' }, { status: 404 });
  }

  // Build SET clause dynamically
  const updates: string[] = [];
  const values: unknown[] = [];

  if ('follow_up_at' in body) {
    updates.push('follow_up_at = ?');
    values.push(body.follow_up_at ?? null);
  }
  if ('follow_up_note' in body) {
    updates.push('follow_up_note = ?');
    values.push(body.follow_up_note ?? null);
  }
  if ('contact_name' in body) {
    updates.push('contact_name = ?');
    values.push(body.contact_name ?? null);
  }
  if ('contact_role' in body) {
    updates.push('contact_role = ?');
    values.push(body.contact_role ?? null);
  }

  if (updates.length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  updates.push("updated_at = datetime('now')");
  values.push(params.id);

  run(`UPDATE lead_assignments SET ${updates.join(', ')} WHERE id = ?`, ...values);

  return NextResponse.json({ data: { success: true } });
}
