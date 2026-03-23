import { NextRequest, NextResponse } from 'next/server';
import { createSalesUser, loginUser } from '@/lib/auth';
import { queryOne } from '@/lib/db';

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
  const phone = body.phone?.trim() || undefined;

  // Validate
  if (!name || name.length < 2) {
    return NextResponse.json({ error: 'Name must be at least 2 characters' }, { status: 400 });
  }
  if (!pin || !/^\d{4,6}$/.test(pin)) {
    return NextResponse.json({ error: 'PIN must be 4-6 digits' }, { status: 400 });
  }
  if (!area_postcode || area_postcode.length < 2) {
    return NextResponse.json({ error: 'Area postcode is required' }, { status: 400 });
  }

  // Check uniqueness
  const existing = queryOne<{ id: string }>('SELECT id FROM sales_users WHERE LOWER(name) = LOWER(?)', name);
  if (existing) {
    return NextResponse.json({ error: 'That name is already taken' }, { status: 409 });
  }

  // Create user
  try {
    createSalesUser(name, pin, { area_postcode, phone });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
  }

  // Auto-login
  const result = loginUser(name, pin);
  if (!result) {
    return NextResponse.json({ error: 'Account created but login failed' }, { status: 500 });
  }

  // Set cookie
  const response = NextResponse.json({ data: { user: result.user, token: result.token } });
  response.cookies.set('sd_session', result.token, {
    httpOnly: true,
    secure: false, // HTTP over Tailscale
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  return response;
}
