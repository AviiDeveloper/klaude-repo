import { NextRequest, NextResponse } from 'next/server';
import { queryOne, run } from '@/lib/db';

// GET — public endpoint: get demo link info (no auth required — customer-facing)
export async function GET(req: NextRequest, { params }: { params: { code: string } }) {
  const { code } = params;

  const link = queryOne<Record<string, unknown>>(
    "SELECT * FROM demo_links WHERE code = ?", code
  );

  if (!link) return NextResponse.json({ error: 'Demo not found' }, { status: 404 });

  // Check expiry
  if (link.expires_at && new Date(link.expires_at as string) < new Date()) {
    run("UPDATE demo_links SET status = 'expired' WHERE id = ?", link.id);
    return NextResponse.json({ error: 'This demo link has expired' }, { status: 410 });
  }

  // Increment view count
  run(
    "UPDATE demo_links SET views = views + 1, last_viewed_at = ?, status = CASE WHEN status = 'active' THEN 'viewed' ELSE status END WHERE id = ?",
    new Date().toISOString(), link.id
  );

  return NextResponse.json({
    data: {
      business_name: link.business_name,
      demo_domain: link.demo_domain,
      status: link.status,
      salesperson_id: link.user_id,
    }
  });
}

// POST — public endpoint: customer expresses interest (no auth required)
export async function POST(req: NextRequest, { params }: { params: { code: string } }) {
  const { code } = params;
  const body = await req.json();

  const link = queryOne<Record<string, unknown>>(
    "SELECT * FROM demo_links WHERE code = ?", code
  );

  if (!link) return NextResponse.json({ error: 'Demo not found' }, { status: 404 });

  // Check expiry
  if (link.expires_at && new Date(link.expires_at as string) < new Date()) {
    return NextResponse.json({ error: 'This demo link has expired' }, { status: 410 });
  }

  const { name, phone, email, message } = body;

  if (!name || !phone) {
    return NextResponse.json({ error: 'Name and phone are required' }, { status: 400 });
  }

  // Update link with customer info
  run(
    `UPDATE demo_links SET
      status = 'interested',
      customer_name = ?,
      customer_phone = ?,
      customer_email = ?,
      customer_message = ?,
      interested_at = ?
    WHERE id = ?`,
    name, phone, email ?? null, message ?? null,
    new Date().toISOString(), link.id
  );

  // Log activity for the salesman
  const activityId = require('crypto').randomUUID();
  run(
    `INSERT INTO sales_activity_log (id, user_id, lead_id, assignment_id, action, notes, created_at)
     VALUES (?, ?, ?, ?, 'customer_interested', ?, ?)`,
    activityId, link.user_id, link.lead_id, link.assignment_id,
    `Customer ${name} (${phone}) expressed interest via demo link`,
    new Date().toISOString()
  );

  return NextResponse.json({
    data: { success: true, message: 'Thank you! We\'ll be in touch shortly.' }
  });
}
