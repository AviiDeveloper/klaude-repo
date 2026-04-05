import { NextResponse } from 'next/server';
import { getGraphData } from '@/lib/vault/indexer';

export async function GET() {
  try {
    const graph = getGraphData();
    return NextResponse.json(graph);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to build graph' },
      { status: 500 }
    );
  }
}
