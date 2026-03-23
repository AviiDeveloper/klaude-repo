import { NextRequest, NextResponse } from 'next/server';
import { resolveAdminFromRequest } from '@/lib/admin-auth';
import { queryAll } from '@/lib/db';

// Read-only — salespeople self-register via the Sales app
export async function GET(req: NextRequest) {
  const admin = resolveAdminFromRequest(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const team = queryAll<Record<string, unknown>>(`
    SELECT
      su.*,
      (SELECT COUNT(*) FROM lead_assignments la WHERE la.user_id = su.id AND la.status IN ('new','visited','pitched')) as active_leads,
      (SELECT COUNT(*) FROM lead_assignments la WHERE la.user_id = su.id AND la.status = 'visited') as total_visits,
      (SELECT COUNT(*) FROM lead_assignments la WHERE la.user_id = su.id AND la.status = 'pitched') as total_pitches,
      (SELECT COUNT(*) FROM lead_assignments la WHERE la.user_id = su.id AND la.status = 'sold') as total_sales,
      COALESCE((SELECT SUM(la.commission_amount) FROM lead_assignments la WHERE la.user_id = su.id AND la.status = 'sold'), 0) as total_commission
    FROM sales_users su
    ORDER BY su.active DESC, su.name ASC
  `);

  const members = team.map((r) => {
    const totalAssigned = (r.total_visits as number) + (r.total_pitches as number) + (r.total_sales as number) + (r.active_leads as number);
    return {
      id: r.id, name: r.name, area_postcode: r.area_postcode,
      user_status: r.user_status ?? 'available', active: r.active === 1,
      last_active_at: r.last_active_at,
      active_leads: r.active_leads, total_visits: r.total_visits,
      total_sales: r.total_sales, total_commission: r.total_commission,
      conversion_rate: totalAssigned > 0 ? ((r.total_sales as number) / totalAssigned * 100) : 0,
    };
  });

  return NextResponse.json({ data: members });
}
