import { NextRequest, NextResponse } from 'next/server';
import { resolveAdminFromRequest } from '@/lib/admin-auth';

export async function GET(req: NextRequest) {
  const admin = resolveAdminFromRequest(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 });
  return NextResponse.json({ data: admin });
}
