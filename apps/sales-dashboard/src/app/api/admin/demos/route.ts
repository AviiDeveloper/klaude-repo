import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db';
import { validateAdminToken } from '@/lib/admin-auth';

export async function GET(req: NextRequest) {
  const token = req.cookies.get('admin_token')?.value;
  if (!token || !validateAdminToken(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sb = getSupabase();
  const { data, error } = await sb
    .from('business_profiles')
    .select('id, business_name, category, city, postcode_prefix, created_at')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}
