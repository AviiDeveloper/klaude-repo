import { NextRequest, NextResponse } from 'next/server';
import { getFileContent } from '@/lib/vault/indexer';
import { getCollection } from '@/lib/vault/collections';
import { isPathWithinBase, hasPathTraversal } from '@/lib/path-security';
import path from 'path';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const collection = searchParams.get('collection');
  const filePath = searchParams.get('path');

  if (!collection || !filePath) {
    return NextResponse.json({ error: 'Missing collection or path parameter' }, { status: 400 });
  }

  if (hasPathTraversal(filePath)) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }

  const col = getCollection(collection);
  if (!col) {
    return NextResponse.json({ error: 'Unknown collection' }, { status: 400 });
  }

  const fullPath = path.join(col.basePath, filePath);
  if (!isPathWithinBase(fullPath, col.basePath)) {
    return NextResponse.json({ error: 'Path outside collection' }, { status: 403 });
  }

  try {
    const result = getFileContent(collection, filePath);
    if (!result) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to read file' },
      { status: 500 }
    );
  }
}
