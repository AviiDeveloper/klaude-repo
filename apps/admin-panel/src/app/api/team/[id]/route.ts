import { NextRequest, NextResponse } from 'next/server';
import { resolveAdminFromRequest } from '@/lib/admin-auth';
import { queryOne, run } from '@/lib/db';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = resolveAdminFromRequest(req);
  if (!admin || admin.role === 'viewer') {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const body = await req.json();
  const updates: string[] = [];
  const values: unknown[] = [];

  const allowedFields: Record<string, string> = {
    name: 'name', email: 'email', phone: 'phone',
    area_postcode: 'area_postcode', commission_rate: 'commission_rate',
    max_active_leads: 'max_active_leads', user_status: 'user_status',
    active: 'active',
  };

  for (const [key, col] of Object.entries(allowedFields)) {
    if (body[key] !== undefined) {
      updates.push(`${col} = ?`);
      values.push(body[key]);
    }
  }

  if (body.area_postcodes !== undefined) {
    updates.push('area_postcodes_json = ?');
    values.push(JSON.stringify(body.area_postcodes));
  }

  if (updates.length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  updates.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(params.id);

  run(`UPDATE sales_users SET ${updates.join(', ')} WHERE id = ?`, ...values);
  return NextResponse.json({ data: { ok: true } });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = resolveAdminFromRequest(req);
  if (!admin || admin.role !== 'owner') {
    return NextResponse.json({ error: 'Only owners can delete users' }, { status: 403 });
  }

  // Soft delete — deactivate, don't remove
  run('UPDATE sales_users SET active = 0, user_status = ?, updated_at = ? WHERE id = ?',
    'inactive', new Date().toISOString(), params.id);
  return NextResponse.json({ data: { ok: true } });
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = resolveAdminFromRequest(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = queryOne<Record<string, unknown>>('SELECT * FROM sales_users WHERE id = ?', params.id);
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ data: user });
}
