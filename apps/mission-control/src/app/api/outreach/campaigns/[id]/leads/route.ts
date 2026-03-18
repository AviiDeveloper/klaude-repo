import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

// GET /api/outreach/campaigns/:id/leads - List leads for a campaign
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const db = getDb();
    const status = request.nextUrl.searchParams.get('status');
    const limit = Number(request.nextUrl.searchParams.get('limit') ?? '100');
    const offset = Number(request.nextUrl.searchParams.get('offset') ?? '0');

    let query = `
      SELECT l.*,
             p.google_rating as profile_google_rating,
             p.google_review_count as profile_review_count,
             p.pain_points_json as profile_pain_points,
             p.has_ssl as profile_has_ssl,
             p.is_mobile_friendly as profile_is_mobile_friendly,
             p.website_tech_stack as profile_tech_stack
      FROM outreach_leads l
      LEFT JOIN outreach_lead_profiles p ON p.lead_id = l.id
      WHERE l.campaign_id = ?
    `;
    const queryParams: (string | number)[] = [id];

    if (status) {
      query += ' AND l.status = ?';
      queryParams.push(status);
    }

    query += ' ORDER BY l.quality_score DESC, l.created_at DESC LIMIT ? OFFSET ?';
    queryParams.push(limit, offset);

    const leads = db.prepare(query).all(...queryParams);

    const total = db.prepare(
      'SELECT COUNT(*) as count FROM outreach_leads WHERE campaign_id = ?' +
      (status ? ' AND status = ?' : ''),
    ).get(...(status ? [id, status] : [id])) as { count: number };

    return NextResponse.json({ leads, total: total.count, limit, offset });
  } catch (error) {
    console.error('Failed to fetch leads:', error);
    return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 });
  }
}
