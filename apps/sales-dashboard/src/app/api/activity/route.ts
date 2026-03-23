import { NextRequest, NextResponse } from 'next/server';
import { resolveUserFromRequest } from '@/lib/auth';
import { queryAll } from '@/lib/db';

export async function GET(req: NextRequest) {
  const auth = resolveUserFromRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Auth required', code: 'AUTH_REQUIRED' }, { status: 401 });
  }

  const rows = queryAll<Record<string, unknown>>(
    `SELECT
      sal.action,
      sal.notes,
      sal.created_at,
      json_extract(la.notes, '$.business_name') as business_name
    FROM sales_activity_log sal
    LEFT JOIN lead_assignments la ON la.id = sal.assignment_id
    WHERE sal.user_id = ?
    ORDER BY sal.created_at DESC
    LIMIT 50`,
    auth.user_id,
  );

  const activity = rows.map((r) => ({
    action: r.action as string,
    notes: r.notes as string | null,
    business_name: r.business_name as string | null,
    created_at: r.created_at as string,
  }));

  return NextResponse.json({ data: activity });
}
