import { NextRequest, NextResponse } from 'next/server';
import { createHash, createHmac } from 'crypto';
import { queryOne, run } from '@/lib/db';
import { checkRateLimit } from '@/lib/rate-limit';

const SD_SECRET = process.env.SD_SECRET || 'sales-dashboard-dev-secret-change-in-production';
const TOKEN_EXPIRY_DAYS = 30;

function hashPin(pin: string): string {
  return createHash('sha256').update(`${SD_SECRET}:${pin}`).digest('hex');
}

/** Also accept plain SHA256(pin) for backward compat with pipeline-created users */
function hashPinPlain(pin: string): string {
  return createHash('sha256').update(pin).digest('hex');
}

function createToken(payload: { user_id: string; name: string; exp: number }): string {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', SD_SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Too many requests, please try again later', code: 'RATE_LIMITED' },
        { status: 429 },
      );
    }

    const body = await req.json() as { name?: string; username?: string; pin?: string };
    const name = body.name ?? body.username;

    if (!name || !body.pin) {
      return NextResponse.json(
        { error: 'Name and PIN are required', code: 'MISSING_FIELDS' },
        { status: 400 },
      );
    }

    const pinHash = hashPin(body.pin.trim());
    const pinHashPlain = hashPinPlain(body.pin.trim());

    // Query local SQLite (source of truth for pipeline-created users)
    const user = queryOne<{
      id: string; name: string; pin_hash: string; email: string | null;
      phone: string | null; area_postcode: string | null; commission_rate: number;
      active: number;
    }>(
      `SELECT * FROM sales_users
       WHERE name = ? COLLATE NOCASE AND active = 1
       AND (pin_hash = ? OR pin_hash = ?)
       LIMIT 1`,
      name.trim(), pinHash, pinHashPlain,
    );

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid name or PIN', code: 'INVALID_CREDENTIALS' },
        { status: 401 },
      );
    }

    // Update last active
    run(
      'UPDATE sales_users SET last_active_at = ? WHERE id = ?',
      new Date().toISOString(), user.id,
    );

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
