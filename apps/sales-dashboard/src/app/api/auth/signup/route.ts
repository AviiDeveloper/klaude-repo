import { NextRequest, NextResponse } from 'next/server';
import { createHash, createHmac, randomUUID } from 'crypto';
import { getSupabaseServer } from '@/lib/supabase';

const SD_SECRET = process.env.SD_SECRET || 'sales-dashboard-dev-secret-change-in-production';
const TOKEN_EXPIRY_DAYS = 30;

function hashPin(pin: string): string {
  return createHash('sha256').update(`${SD_SECRET}:${pin}`).digest('hex');
}

function createToken(payload: { user_id: string; name: string; exp: number }): string {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', SD_SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    name?: string;
    pin?: string;
    area_postcode?: string;
    phone?: string;
  };

  const name = body.name?.trim();
  const pin = body.pin?.trim();
  const area_postcode = body.area_postcode?.trim().toUpperCase();
  const phone = body.phone?.trim() || null;

  if (!name || name.length < 2) {
    return NextResponse.json({ error: 'Name must be at least 2 characters' }, { status: 400 });
  }
  if (!pin || !/^\d{4,6}$/.test(pin)) {
    return NextResponse.json({ error: 'PIN must be 4-6 digits' }, { status: 400 });
  }
  if (!area_postcode || area_postcode.length < 2) {
    return NextResponse.json({ error: 'Area is required' }, { status: 400 });
  }

  const sb = getSupabaseServer();

  // Check uniqueness
  const { data: existing } = await sb
    .from('sales_users')
    .select('id')
    .ilike('name', name)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: 'That name is already taken' }, { status: 409 });
  }

  const id = randomUUID();
  const pin_hash = hashPin(pin);

  const { error: insertError } = await sb.from('sales_users').insert({
    id,
    name,
    pin_hash,
    phone,
    area_postcode,
    commission_rate: 0.1,
    active: true,
  });

  if (insertError) {
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
  }

  const exp = Math.floor(Date.now() / 1000) + TOKEN_EXPIRY_DAYS * 24 * 60 * 60;
  const token = createToken({ user_id: id, name, exp });

  const response = NextResponse.json({
    data: {
      user: { id, name, phone, area_postcode, commission_rate: 0.1, active: true },
      token,
    },
  });

  response.cookies.set('sd_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: TOKEN_EXPIRY_DAYS * 24 * 60 * 60,
  });

  return response;
}
