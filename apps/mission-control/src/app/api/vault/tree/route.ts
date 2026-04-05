import { NextResponse } from 'next/server';
import { getTree } from '@/lib/vault/indexer';

export async function GET() {
  try {
    const tree = getTree();
    return NextResponse.json({ collections: tree });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load vault tree' },
      { status: 500 }
    );
  }
}
