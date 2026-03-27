import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db';

// GET — get demo info by assignment ID (for direct preview, no demo link needed)
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  const sb = getSupabase();

  // Try as demo_links code first
  const { data: link } = await sb
    .from('demo_links')
    .select('business_name, demo_domain, status, user_id')
    .eq('code', id)
    .single();

  if (link) {
    return NextResponse.json({
      data: {
        business_name: link.business_name,
        demo_domain: link.demo_domain,
        status: link.status,
        salesperson_id: link.user_id,
      }
    });
  }

  // Try as assignment ID
  const { data: assignment } = await sb
    .from('lead_assignments')
    .select('id, user_id, notes')
    .eq('id', id)
    .single();

  if (assignment) {
    let notes: Record<string, unknown> = {};
    try { notes = JSON.parse(assignment.notes ?? '{}'); } catch { /* */ }

    return NextResponse.json({
      data: {
        business_name: (notes.business_name as string) ?? 'Business',
        demo_domain: (notes.demo_site_domain as string) ?? null,
        status: 'active',
        salesperson_id: assignment.user_id,
      }
    });
  }

  return NextResponse.json({ error: 'Demo not found' }, { status: 404 });
}
