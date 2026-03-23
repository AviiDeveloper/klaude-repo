import { NextRequest, NextResponse } from 'next/server';
import { resolveUserFromRequest } from '@/lib/auth';
import { queryOne } from '@/lib/db';
import type { SalesStats } from '@/lib/types';

export async function GET(req: NextRequest) {
  const auth = resolveUserFromRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Auth required', code: 'AUTH_REQUIRED' }, { status: 401 });
  }

  const row = queryOne<Record<string, unknown>>(
    `SELECT
      COUNT(*) as total_assigned,
      SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) as new_count,
      SUM(CASE WHEN status = 'visited' THEN 1 ELSE 0 END) as visited_count,
      SUM(CASE WHEN status = 'pitched' THEN 1 ELSE 0 END) as pitched_count,
      SUM(CASE WHEN status = 'sold' THEN 1 ELSE 0 END) as sold_count,
      SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_count,
      SUM(CASE WHEN visited_at >= date('now') THEN 1 ELSE 0 END) as visits_today,
      SUM(CASE WHEN pitched_at >= date('now') THEN 1 ELSE 0 END) as pitches_today,
      SUM(CASE WHEN sold_at >= date('now') THEN 1 ELSE 0 END) as sales_today,
      SUM(COALESCE(commission_amount, 0)) as total_commission
    FROM lead_assignments
    WHERE user_id = ?`,
    auth.user_id,
  );

  const stats: SalesStats = {
    total_assigned: (row?.total_assigned as number) ?? 0,
    new_count: (row?.new_count as number) ?? 0,
    visited_count: (row?.visited_count as number) ?? 0,
    pitched_count: (row?.pitched_count as number) ?? 0,
    sold_count: (row?.sold_count as number) ?? 0,
    rejected_count: (row?.rejected_count as number) ?? 0,
    visits_today: (row?.visits_today as number) ?? 0,
    pitches_today: (row?.pitches_today as number) ?? 0,
    sales_today: (row?.sales_today as number) ?? 0,
    total_commission: (row?.total_commission as number) ?? 0,
  };

  return NextResponse.json({ data: stats });
}
