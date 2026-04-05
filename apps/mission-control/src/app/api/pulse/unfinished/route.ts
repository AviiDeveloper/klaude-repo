import { NextResponse } from 'next/server';
import { getUnfinishedWork } from '@/lib/pulse/scanner';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = getUnfinishedWork();
    return NextResponse.json(data);
  } catch (err) {
    console.error('[Pulse] Failed to scan unfinished work:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Scan failed' },
      { status: 500 }
    );
  }
}
