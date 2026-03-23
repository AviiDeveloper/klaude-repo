import { NextRequest, NextResponse } from 'next/server';
import { resolveAdminFromRequest } from '@/lib/admin-auth';
import { queryAll, run } from '@/lib/db';
import { randomUUID } from 'crypto';
import { createHash } from 'crypto';

const SD_SECRET = process.env.SD_SECRET || 'sales-dashboard-dev-secret-change-in-production';
function hashPin(pin: string) { return createHash('sha256').update(`${SD_SECRET}:${pin}`).digest('hex'); }

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
      id: r.id,
      name: r.name,
      email: r.email,
      phone: r.phone,
      area_postcode: r.area_postcode,
      area_postcodes_json: r.area_postcodes_json,
      max_active_leads: r.max_active_leads ?? 20,
      user_status: r.user_status ?? 'available',
      commission_rate: r.commission_rate ?? 0.1,
      active: r.active === 1,
      last_active_at: r.last_active_at,
      created_at: r.created_at,
      active_leads: r.active_leads,
      total_visits: r.total_visits,
      total_pitches: r.total_pitches,
      total_sales: r.total_sales,
      total_commission: r.total_commission,
      conversion_rate: totalAssigned > 0 ? ((r.total_sales as number) / totalAssigned * 100) : 0,
    };
  });

  return NextResponse.json({ data: members });
}

export async function POST(req: NextRequest) {
  const admin = resolveAdminFromRequest(req);
  if (!admin || admin.role === 'viewer') {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const body = await req.json();
  const { name, pin, email, phone, area_postcode, area_postcodes, commission_rate, max_active_leads } = body;

  if (!name || !pin) {
    return NextResponse.json({ error: 'Name and PIN required' }, { status: 400 });
  }

  const id = randomUUID();
  const now = new Date().toISOString();
  const pinHash = hashPin(pin);

  try {
    run(
      `INSERT INTO sales_users (id, name, pin_hash, email, phone, area_postcode, area_postcodes_json, commission_rate, max_active_leads, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id, name, pinHash, email ?? null, phone ?? null, area_postcode ?? null,
      area_postcodes ? JSON.stringify(area_postcodes) : null,
      commission_rate ?? 0.1, max_active_leads ?? 20, now, now,
    );
    return NextResponse.json({ data: { id, name } }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('UNIQUE')) return NextResponse.json({ error: 'User already exists' }, { status: 409 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
