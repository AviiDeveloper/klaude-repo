import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

// GET /api/outreach/templates - List available site templates
export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const vertical = request.nextUrl.searchParams.get('vertical');

    let query = 'SELECT id, name, vertical, template_type, conversions, impressions, created_at FROM site_templates';
    const params: string[] = [];

    if (vertical) {
      query += ' WHERE vertical = ?';
      params.push(vertical);
    }

    query += ' ORDER BY conversions DESC, name';
    const templates = db.prepare(query).all(...params);
    return NextResponse.json(templates);
  } catch (error) {
    console.error('Failed to fetch templates:', error);
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 });
  }
}
