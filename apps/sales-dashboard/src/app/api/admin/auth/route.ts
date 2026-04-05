import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { hashPassword } from '@/lib/admin-auth';

const ADMIN_SECRET = process.env.SD_SECRET || 'sales-dashboard-dev-secret-change-in-production';

function createAdminToken(): string {
  const payload = { role: 'admin', exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60 };
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', ADMIN_SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}

export async function POST(req: NextRequest) {
  const { password } = await req.json();

  const configuredPassword = process.env.ADMIN_PASSWORD;
  if (!configuredPassword) {
    return NextResponse.json({ error: 'Admin auth not configured' }, { status: 503 });
  }

  const a = Buffer.from(hashPassword(password), 'hex');
  const b = Buffer.from(hashPassword(configuredPassword), 'hex');
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
  }

  const token = createAdminToken();
  const response = NextResponse.json({ success: true });
  response.cookies.set('admin_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60,
    path: '/',
  });

  return response;
}
