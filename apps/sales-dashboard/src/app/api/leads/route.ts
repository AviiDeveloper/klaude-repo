import { NextRequest, NextResponse } from 'next/server';
import { resolveUserFromRequest } from '@/lib/auth';
import { queryAll } from '@/lib/db';
import type { LeadCard } from '@/lib/types';

export async function GET(req: NextRequest) {
  const auth = resolveUserFromRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Auth required', code: 'AUTH_REQUIRED' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const search = searchParams.get('search');

  let sql = `
    SELECT
      la.id as assignment_id,
      la.status as assignment_status,
      la.assigned_at,
      la.lead_id,
      la.notes,
      la.commission_amount,
      la.visited_at,
      la.pitched_at,
      la.sold_at,
      COALESCE(json_extract(la.notes, '$.business_name'), la.lead_id) as business_name,
      json_extract(la.notes, '$.business_type') as business_type,
      json_extract(la.notes, '$.address') as address,
      json_extract(la.notes, '$.postcode') as postcode,
      json_extract(la.notes, '$.phone') as phone,
      json_extract(la.notes, '$.google_rating') as google_rating,
      json_extract(la.notes, '$.google_review_count') as google_review_count,
      json_extract(la.notes, '$.has_website') as has_website,
      json_extract(la.notes, '$.website_quality_score') as website_quality_score,
      json_extract(la.notes, '$.demo_site_domain') as demo_site_domain
    FROM lead_assignments la
    WHERE la.user_id = ?
  `;
  const params: unknown[] = [auth.user_id];

  if (status && status !== 'all') {
    sql += ' AND la.status = ?';
    params.push(status);
  }

  if (search) {
    sql += ` AND json_extract(la.notes, '$.business_name') LIKE ?`;
    params.push(`%${search}%`);
  }

  sql += `
    ORDER BY
      CASE la.status
        WHEN 'new' THEN 1
        WHEN 'visited' THEN 2
        WHEN 'pitched' THEN 3
        WHEN 'sold' THEN 4
        WHEN 'rejected' THEN 5
      END,
      la.assigned_at DESC
  `;

  const rows = queryAll<Record<string, unknown>>(sql, ...params);

  const leads: LeadCard[] = rows.map((r) => ({
    assignment_id: r.assignment_id as string,
    assignment_status: (r.assignment_status as LeadCard['assignment_status']) ?? 'new',
    assigned_at: r.assigned_at as string,
    lead_id: r.lead_id as string,
    business_name: (r.business_name as string) ?? 'Unknown Business',
    business_type: r.business_type as string | null,
    address: r.address as string | null,
    postcode: r.postcode as string | null,
    phone: r.phone as string | null,
    google_rating: r.google_rating as number | null,
    google_review_count: r.google_review_count as number | null,
    has_website: !!(r.has_website),
    website_quality_score: r.website_quality_score as number | null,
    has_demo_site: !!(r.demo_site_domain),
    demo_site_domain: r.demo_site_domain as string | null,
  }));

  return NextResponse.json({ data: leads });
}
