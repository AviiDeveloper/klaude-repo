import { NextRequest, NextResponse } from 'next/server';
import { resolveAdminFromRequest } from '@/lib/admin-auth';
import { queryOne, queryAll } from '@/lib/db';

export async function GET(req: NextRequest) {
  const admin = resolveAdminFromRequest(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const totals = queryOne<Record<string, number>>(`
    SELECT
      (SELECT COUNT(*) FROM sales_users WHERE active = 1) as total_salespeople,
      (SELECT COUNT(*) FROM sales_users WHERE active = 1 AND last_active_at > datetime('now', '-24 hours')) as active_salespeople,
      (SELECT COUNT(*) FROM lead_assignments) as total_leads,
      (SELECT COUNT(*) FROM lead_assignments WHERE status = 'visited') as total_visits,
      (SELECT COUNT(*) FROM lead_assignments WHERE status = 'pitched') as total_pitches,
      (SELECT COUNT(*) FROM lead_assignments WHERE status = 'sold') as total_sales,
      COALESCE((SELECT SUM(commission_amount) FROM lead_assignments WHERE status = 'sold'), 0) as total_revenue,
      (SELECT COUNT(*) FROM lead_assignments WHERE visited_at > date('now', '-7 days')) as visits_this_week,
      (SELECT COUNT(*) FROM lead_assignments WHERE sold_at > date('now', '-7 days')) as sales_this_week,
      COALESCE((SELECT SUM(commission_amount) FROM lead_assignments WHERE sold_at > date('now', '-7 days')), 0) as revenue_this_week
  `);

  const totalAssigned = (totals?.total_visits ?? 0) + (totals?.total_pitches ?? 0) + (totals?.total_sales ?? 0);

  // Conversion funnel
  const funnel = queryOne<Record<string, number>>(`
    SELECT
      COUNT(*) as assigned,
      SUM(CASE WHEN status IN ('visited','pitched','sold') THEN 1 ELSE 0 END) as visited,
      SUM(CASE WHEN status IN ('pitched','sold') THEN 1 ELSE 0 END) as pitched,
      SUM(CASE WHEN status = 'sold' THEN 1 ELSE 0 END) as sold,
      SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected
    FROM lead_assignments
  `);

  // Alerts
  const alerts: Array<{ type: string; message: string }> = [];

  const inactiveSalespeople = queryAll<{ name: string }>(`
    SELECT name FROM sales_users
    WHERE active = 1 AND (last_active_at < datetime('now', '-3 days') OR last_active_at IS NULL)
  `);
  for (const sp of inactiveSalespeople) {
    alerts.push({ type: 'warning', message: `${sp.name} hasn't been active for 3+ days` });
  }

  const multiRejected = queryAll<{ lead_id: string; cnt: number }>(`
    SELECT lead_id, COUNT(*) as cnt FROM lead_assignments
    WHERE status = 'rejected' GROUP BY lead_id HAVING cnt >= 2
  `);
  for (const r of multiRejected) {
    alerts.push({ type: 'danger', message: `Lead ${r.lead_id} rejected by ${r.cnt} salespeople — review needed` });
  }

  return NextResponse.json({
    data: {
      stats: {
        ...totals,
        conversion_rate: totalAssigned > 0 ? ((totals?.total_sales ?? 0) / totalAssigned * 100) : 0,
      },
      funnel,
      alerts,
    },
  });
}
