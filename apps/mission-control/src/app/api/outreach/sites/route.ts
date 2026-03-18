import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

// GET /api/outreach/sites - List generated sites
export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const campaignId = request.nextUrl.searchParams.get('campaign_id');
    const status = request.nextUrl.searchParams.get('status');
    const limit = Number(request.nextUrl.searchParams.get('limit') ?? '50');

    let query = `
      SELECT s.id, s.lead_id, s.campaign_id, s.template_id, s.site_name, s.domain,
             s.status, s.lighthouse_score, s.approved_by, s.approved_at, s.deployed_at,
             s.created_at, s.updated_at,
             l.business_name, l.business_type
      FROM generated_sites s
      LEFT JOIN outreach_leads l ON l.id = s.lead_id
      WHERE 1=1
    `;
    const params: (string | number)[] = [];

    if (campaignId) {
      query += ' AND s.campaign_id = ?';
      params.push(campaignId);
    }
    if (status) {
      query += ' AND s.status = ?';
      params.push(status);
    }

    query += ' ORDER BY s.created_at DESC LIMIT ?';
    params.push(limit);

    const sites = db.prepare(query).all(...params);
    return NextResponse.json(sites);
  } catch (error) {
    console.error('Failed to fetch sites:', error);
    return NextResponse.json({ error: 'Failed to fetch sites' }, { status: 500 });
  }
}
