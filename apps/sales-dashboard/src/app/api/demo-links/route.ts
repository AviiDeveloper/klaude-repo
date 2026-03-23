import { NextRequest, NextResponse } from 'next/server';
import { queryAll, queryOne, run } from '@/lib/db';
import { verifyAuth } from '@/lib/auth';
import crypto from 'crypto';

// POST — create a shareable demo link for a lead
export async function POST(req: NextRequest) {
  const user = verifyAuth(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { assignment_id } = await req.json();
  if (!assignment_id) return NextResponse.json({ error: 'assignment_id required' }, { status: 400 });

  // Get assignment details
  const assignment = queryOne<Record<string, unknown>>(
    "SELECT la.*, la.notes as notes_raw FROM lead_assignments la WHERE la.id = ? AND la.user_id = ?",
    assignment_id, user.user_id
  );
  if (!assignment) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });

  // Parse lead data from notes
  let leadData: Record<string, unknown> = {};
  try { leadData = JSON.parse((assignment.notes_raw as string) ?? '{}'); } catch { /* */ }

  // Check if link already exists for this assignment
  const existing = queryOne<Record<string, unknown>>(
    "SELECT * FROM demo_links WHERE assignment_id = ? AND status IN ('active', 'viewed')",
    assignment_id
  );
  if (existing) {
    return NextResponse.json({ data: { link: existing, url: `/demo/${existing.code}` } });
  }

  // Generate unique short code
  const code = crypto.randomBytes(6).toString('base64url'); // 8 chars, URL-safe
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days

  run(
    `INSERT INTO demo_links (id, code, assignment_id, user_id, lead_id, business_name, demo_domain, status, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
    id, code, assignment_id, user.user_id,
    assignment.lead_id as string,
    (leadData.business_name as string) ?? 'Business',
    (leadData.demo_site_domain as string) ?? null,
    expiresAt, now
  );

  const link = queryOne<Record<string, unknown>>("SELECT * FROM demo_links WHERE id = ?", id);
  return NextResponse.json({ data: { link, url: `/demo/${code}` } });
}

// GET — list all demo links for current user
export async function GET(req: NextRequest) {
  const user = verifyAuth(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const links = queryAll<Record<string, unknown>>(
    "SELECT * FROM demo_links WHERE user_id = ? ORDER BY created_at DESC",
    user.user_id
  );

  return NextResponse.json({ data: { links } });
}
