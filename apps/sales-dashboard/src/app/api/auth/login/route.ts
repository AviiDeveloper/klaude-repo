import { NextRequest, NextResponse } from 'next/server';
import { createHash, createHmac } from 'crypto';
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
  try {
    const body = await req.json() as { name?: string; pin?: string };

    if (!body.name || !body.pin) {
      return NextResponse.json(
        { error: 'Name and PIN are required', code: 'MISSING_FIELDS' },
        { status: 400 },
      );
    }

    const sb = getSupabaseServer();
    const pinHash = hashPin(body.pin.trim());

    const { data: user } = await sb
      .from('sales_users')
      .select('*')
      .ilike('name', body.name.trim())
      .eq('pin_hash', pinHash)
      .eq('active', true)
      .maybeSingle();

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid name or PIN', code: 'INVALID_CREDENTIALS' },
        { status: 401 },
      );
    }

    // Update last active
    await sb.from('sales_users').update({ last_active_at: new Date().toISOString() }).eq('id', user.id);

    const exp = Math.floor(Date.now() / 1000) + TOKEN_EXPIRY_DAYS * 24 * 60 * 60;
    const token = createToken({ user_id: user.id, name: user.name, exp });

    const response = NextResponse.json({ data: { user, token } });
    response.cookies.set('sd_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: TOKEN_EXPIRY_DAYS * 24 * 60 * 60,
      path: '/',
    });

    return response;
  } catch (err) {
    console.error('[Auth] Login error:', err);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 },
    );
  }
}
