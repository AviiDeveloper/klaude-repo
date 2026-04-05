import { NextRequest, NextResponse } from 'next/server';
import { getRecentActivity } from '@/lib/pulse/scanner';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const days = Math.min(Math.max(parseInt(searchParams.get('days') || '7', 10) || 7, 1), 30);

  try {
    const data = getRecentActivity(days);
    return NextResponse.json(data);
  } catch (err) {
    console.error('[Pulse] Failed to scan activity:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Activity scan failed' },
      { status: 500 }
    );
  }
}
