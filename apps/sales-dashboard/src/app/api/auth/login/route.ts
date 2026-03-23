import { NextRequest, NextResponse } from 'next/server';
import { loginUser } from '@/lib/auth';

const TOKEN_EXPIRY_DAYS = 30;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { name?: string; pin?: string };

    if (!body.name || !body.pin) {
      return NextResponse.json(
        { error: 'Name and PIN are required', code: 'MISSING_FIELDS' },
        { status: 400 },
      );
    }

    const result = loginUser(body.name.trim(), body.pin.trim());

    if (!result) {
      return NextResponse.json(
        { error: 'Invalid name or PIN', code: 'INVALID_CREDENTIALS' },
        { status: 401 },
      );
    }

    // Build response with token for mobile clients
    const response = NextResponse.json({
      data: {
        user: result.user,
        token: result.token,
      },
    });

    // Set cookie on the response for web clients
    // secure: false because we serve over HTTP via Tailscale (not HTTPS)
    response.cookies.set('sd_session', result.token, {
      httpOnly: true,
      secure: false,
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
