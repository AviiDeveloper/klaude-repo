import { NextRequest, NextResponse } from 'next/server';
import { resolveUserFromRequest } from '@/lib/auth';
import { queryOne } from '@/lib/db';
import type { LeadDetail } from '@/lib/types';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = resolveUserFromRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Auth required', code: 'AUTH_REQUIRED' }, { status: 401 });
  }

  const row = queryOne<Record<string, unknown>>(
    `SELECT
      la.*,
      json_extract(la.notes, '$.business_name') as business_name,
      json_extract(la.notes, '$.business_type') as business_type,
      json_extract(la.notes, '$.address') as address,
      json_extract(la.notes, '$.postcode') as postcode,
      json_extract(la.notes, '$.phone') as phone,
      json_extract(la.notes, '$.email') as email,
      json_extract(la.notes, '$.website_url') as website_url,
      json_extract(la.notes, '$.google_rating') as google_rating,
      json_extract(la.notes, '$.google_review_count') as google_review_count,
      json_extract(la.notes, '$.has_website') as has_website,
      json_extract(la.notes, '$.website_quality_score') as website_quality_score,
      json_extract(la.notes, '$.description') as description,
      json_extract(la.notes, '$.services') as services_json,
      json_extract(la.notes, '$.pain_points') as pain_points_json,
      json_extract(la.notes, '$.opening_hours') as opening_hours_json,
      json_extract(la.notes, '$.best_reviews') as best_reviews_json,
      json_extract(la.notes, '$.brand_colours') as brand_colours_json,
      json_extract(la.notes, '$.logo_filename') as logo_filename,
      json_extract(la.notes, '$.gallery_filenames') as gallery_filenames_json,
      json_extract(la.notes, '$.demo_site_html') as demo_site_html,
      json_extract(la.notes, '$.demo_site_domain') as demo_site_domain,
      json_extract(la.notes, '$.demo_site_qa_score') as demo_site_qa_score,
      json_extract(la.notes, '$.trust_badges') as trust_badges_json,
      json_extract(la.notes, '$.avoid_topics') as avoid_topics_json,
      json_extract(la.notes, '$.hero_headline') as hero_headline,
      json_extract(la.notes, '$.cta_text') as cta_text,
      json_extract(la.notes, '$.user_notes') as user_notes
    FROM lead_assignments la
    WHERE la.id = ? AND la.user_id = ?`,
    params.id, auth.user_id,
  );

  if (!row) {
    return NextResponse.json({ error: 'Lead not found', code: 'NOT_FOUND' }, { status: 404 });
  }

  const safeJsonParse = <T>(val: unknown, fallback: T): T => {
    if (!val || typeof val !== 'string') return fallback;
    try { return JSON.parse(val) as T; } catch { return fallback; }
  };

  const lead: LeadDetail = {
    assignment_id: row.id as string,
    assignment_status: (row.status as LeadDetail['assignment_status']) ?? 'new',
    assigned_at: row.assigned_at as string,
    lead_id: row.lead_id as string,
    business_name: (row.business_name as string) ?? 'Unknown',
    business_type: row.business_type as string | null,
    address: row.address as string | null,
    postcode: row.postcode as string | null,
    phone: row.phone as string | null,
    email: row.email as string | null,
    website_url: row.website_url as string | null,
    google_rating: row.google_rating as number | null,
    google_review_count: row.google_review_count as number | null,
    has_website: !!(row.has_website),
    website_quality_score: row.website_quality_score as number | null,
    description: row.description as string | null,
    services: safeJsonParse<string[]>(row.services_json, []),
    pain_points: safeJsonParse<string[]>(row.pain_points_json, []),
    opening_hours: safeJsonParse<string[]>(row.opening_hours_json, []),
    best_reviews: safeJsonParse(row.best_reviews_json, []),
    brand_colours: safeJsonParse(row.brand_colours_json, null),
    logo_filename: row.logo_filename as string | null,
    gallery_filenames: safeJsonParse<string[]>(row.gallery_filenames_json, []),
    demo_site_html: row.demo_site_html as string | null,
    demo_site_domain: row.demo_site_domain as string | null,
    demo_site_qa_score: row.demo_site_qa_score as number | null,
    has_demo_site: !!(row.demo_site_domain),
    trust_badges: safeJsonParse<string[]>(row.trust_badges_json, []),
    avoid_topics: safeJsonParse<string[]>(row.avoid_topics_json, []),
    hero_headline: row.hero_headline as string | null,
    cta_text: row.cta_text as string | null,
    notes: row.user_notes as string | null,
    commission_amount: row.commission_amount as number | null,
    visited_at: row.visited_at as string | null,
    pitched_at: row.pitched_at as string | null,
    sold_at: row.sold_at as string | null,
    follow_up_at: row.follow_up_at as string | null,
    follow_up_note: row.follow_up_note as string | null,
    contact_name: row.contact_name as string | null,
    contact_role: row.contact_role as string | null,
  };

  return NextResponse.json({ data: lead });
}
