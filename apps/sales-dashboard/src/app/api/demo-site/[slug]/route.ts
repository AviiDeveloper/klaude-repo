import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

// Proxy demo site HTML from Supabase Storage — avoids CSP/X-Frame-Options issues
export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const { slug } = params;

  // Try Supabase Storage first
  const storageUrl = `${SUPABASE_URL}/storage/v1/object/public/demo-sites/${slug}.html`;
  const res = await fetch(storageUrl);

  if (!res.ok) {
    return new NextResponse('Demo site not found', { status: 404 });
  }

  const html = await res.text();

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
