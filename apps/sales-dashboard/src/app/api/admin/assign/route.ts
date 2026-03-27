import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db';
import { validateAdminToken } from '@/lib/admin-auth';
import { randomUUID } from 'crypto';

export async function POST(req: NextRequest) {
  const token = req.cookies.get('admin_token')?.value;
  if (!token || !validateAdminToken(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { salesperson_id, business_profile_id } = await req.json();

  if (!salesperson_id || !business_profile_id) {
    return NextResponse.json({ error: 'salesperson_id and business_profile_id required' }, { status: 400 });
  }

  const sb = getSupabase();

  // Get business profile
  const { data: profile } = await sb
    .from('business_profiles')
    .select('*')
    .eq('id', business_profile_id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: 'Business profile not found' }, { status: 404 });
  }

  // Get demo domain slug from website_url
  const slug = profile.business_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  // Create lead assignment with business data in notes JSON
  const assignmentId = randomUUID();
  const leadId = randomUUID();

  const notes = JSON.stringify({
    business_name: profile.business_name,
    business_type: profile.category,
    address: profile.city || '',
    postcode: profile.postcode_prefix || '',
    phone: profile.phone || '',
    email: profile.email || '',
    has_website: false,
    demo_site_domain: slug,
    google_rating: null,
    google_review_count: null,
  });

  const { error } = await sb.from('lead_assignments').insert({
    id: assignmentId,
    lead_id: leadId,
    user_id: salesperson_id,
    status: 'new',
    notes,
  });

  if (error) {
    return NextResponse.json({ error: `Assignment failed: ${error.message}` }, { status: 500 });
  }

  // Log activity
  await sb.from('sales_activity_log').insert({
    id: randomUUID(),
    user_id: salesperson_id,
    lead_id: leadId,
    assignment_id: assignmentId,
    action: 'lead_assigned',
    notes: `Assigned ${profile.business_name} by admin`,
  });

  return NextResponse.json({
    data: {
      assignment_id: assignmentId,
      business_name: profile.business_name,
      demo_domain: slug,
    }
  });
}
