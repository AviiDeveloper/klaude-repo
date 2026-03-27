import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db';
import { validateAdminToken } from '@/lib/admin-auth';

export async function POST(req: NextRequest) {
  const token = req.cookies.get('admin_token')?.value;
  if (!token || !validateAdminToken(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const businessName = formData.get('business_name') as string;
  const category = formData.get('category') as string || 'other';
  const city = formData.get('city') as string || '';
  const postcode = formData.get('postcode') as string || '';

  if (!file || !businessName) {
    return NextResponse.json({ error: 'File and business name required' }, { status: 400 });
  }

  const sb = getSupabase();

  // Create slug from business name
  const slug = businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  // Upload HTML to Supabase Storage
  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const storagePath = `${slug}.html`;

  const { error: uploadError } = await sb.storage
    .from('demo-sites')
    .upload(storagePath, fileBuffer, {
      contentType: 'text/html',
      upsert: true,
    });

  if (uploadError) {
    return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 });
  }

  // Get public URL
  const { data: urlData } = sb.storage.from('demo-sites').getPublicUrl(storagePath);

  // Create business profile
  const { data: profile, error: profileError } = await sb
    .from('business_profiles')
    .insert({
      business_name: businessName,
      category,
      city: city || null,
      postcode_prefix: postcode || null,
      website_url: urlData.publicUrl,
    })
    .select()
    .single();

  if (profileError) {
    return NextResponse.json({ error: `Profile creation failed: ${profileError.message}` }, { status: 500 });
  }

  return NextResponse.json({
    data: {
      profile,
      demo_domain: slug,
      storage_url: urlData.publicUrl,
    }
  });
}
