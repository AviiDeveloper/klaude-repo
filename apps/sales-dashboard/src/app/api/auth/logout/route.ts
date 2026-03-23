import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ data: { success: true } });
  response.cookies.set('sd_session', '', {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });
  return response;
}
