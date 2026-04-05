import { NextResponse } from 'next/server';
import { buildIndex } from '@/lib/vault/indexer';

export async function POST() {
  try {
    buildIndex();
    return NextResponse.json({ ok: true, message: 'Index rebuilt' });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to rebuild index' },
      { status: 500 }
    );
  }
}
