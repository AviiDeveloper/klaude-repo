import { NextRequest, NextResponse } from 'next/server';
import { loginAdmin, COOKIE_NAME } from '@/lib/admin-auth';

export async function POST(req: NextRequest) {
  const { name, password } = await req.json();
  if (!name || !password) {
    return NextResponse.json({ error: 'Username and password required', code: 'MISSING_FIELDS' }, { status: 400 });
  }

  const result = loginAdmin(name, password);
  if (!result) {
    return NextResponse.json({ error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' }, { status: 401 });
  }

  const response = NextResponse.json({ data: result });
  response.cookies.set(COOKIE_NAME, result.token, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60,
    path: '/',
  });
  return response;
}
