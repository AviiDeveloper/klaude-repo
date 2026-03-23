import { NextRequest, NextResponse } from 'next/server';
import { resolveUserFromRequest } from '@/lib/auth';
import { queryOne } from '@/lib/db';
import type { SalesUser } from '@/lib/types';

export async function GET(req: NextRequest) {
  const auth = resolveUserFromRequest(req);
  if (!auth) {
    return NextResponse.json(
      { error: 'Not authenticated', code: 'AUTH_REQUIRED' },
      { status: 401 },
    );
  }

  const row = queryOne<Record<string, unknown>>(
    'SELECT id, name, email, phone, area_postcode, commission_rate, device_type, last_active_at, created_at FROM sales_users WHERE id = ?',
    auth.user_id,
  );

  if (!row) {
    return NextResponse.json(
      { error: 'User not found', code: 'USER_NOT_FOUND' },
      { status: 404 },
    );
  }

  const user: SalesUser = {
    id: row.id as string,
    name: row.name as string,
    email: row.email as string | null,
    phone: row.phone as string | null,
    area_postcode: row.area_postcode as string | null,
    commission_rate: (row.commission_rate as number) ?? 0.1,
    active: true,
    device_type: (row.device_type as SalesUser['device_type']) ?? null,
    last_active_at: row.last_active_at as string | null,
    created_at: row.created_at as string,
  };

  return NextResponse.json({ data: user });
}
