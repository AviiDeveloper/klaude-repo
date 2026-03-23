import { NextRequest, NextResponse } from 'next/server';
import { loginUser, setSessionCookie } from '@/lib/auth';

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

    // Set cookie for web clients
    setSessionCookie(result.token);

    // Return token for mobile clients
    return NextResponse.json({
      data: {
        user: result.user,
        token: result.token,
      },
    });
  } catch (err) {
    console.error('[Auth] Login error:', err);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 },
    );
  }
}
