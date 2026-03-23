import { NextRequest, NextResponse } from 'next/server';
import { resolveAdminFromRequest } from '@/lib/admin-auth';
import { queryAll } from '@/lib/db';

export async function GET(req: NextRequest) {
  const admin = resolveAdminFromRequest(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const area = searchParams.get('area');
  const assigned = searchParams.get('assigned'); // 'true', 'false', or null (all)
  const search = searchParams.get('q');

  let sql = `
    SELECT
      la.id as assignment_id, la.lead_id, la.status, la.assigned_at, la.notes,
      la.commission_amount, la.visited_at, la.pitched_at, la.sold_at,
      su.name as assigned_to_name, su.id as assigned_to_id
    FROM lead_assignments la
    LEFT JOIN sales_users su ON su.id = la.user_id
    WHERE 1=1
  `;
  const params: unknown[] = [];

  if (status) { sql += ' AND la.status = ?'; params.push(status); }
  if (search) { sql += ' AND la.notes LIKE ?'; params.push(`%${search}%`); }

  sql += ' ORDER BY la.created_at DESC LIMIT 200';

  const rows = queryAll<Record<string, unknown>>(sql, ...params);

  // Parse business info from notes JSON
  const leads = rows.map((r) => {
    let biz: Record<string, unknown> = {};
    try { biz = JSON.parse(r.notes as string ?? '{}'); } catch { /* */ }
    return {
      assignment_id: r.assignment_id,
      lead_id: r.lead_id,
      business_name: biz.business_name ?? 'Unknown',
      business_type: biz.business_type ?? null,
      postcode: biz.postcode ?? null,
      phone: biz.phone ?? null,
      google_rating: biz.google_rating ?? null,
      google_review_count: biz.google_review_count ?? null,
      status: r.status,
      assigned_to_name: r.assigned_to_name,
      assigned_to_id: r.assigned_to_id,
      assigned_at: r.assigned_at,
      demo_site_domain: biz.demo_site_domain ?? null,
      commission_amount: r.commission_amount,
    };
  });

  return NextResponse.json({ data: leads });
}
