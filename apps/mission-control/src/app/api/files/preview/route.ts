/**
 * File Preview API
 * Serves local files for preview (HTML only for security)
 */

import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { isPathWithinBase, resolvePath } from '@/lib/path-security';

export async function GET(request: NextRequest) {
  const filePath = request.nextUrl.searchParams.get('path');

  if (!filePath) {
    return NextResponse.json({ error: 'path is required' }, { status: 400 });
  }

  // Only allow HTML files
  if (!filePath.endsWith('.html') && !filePath.endsWith('.htm')) {
    return NextResponse.json({ error: 'Only HTML files can be previewed' }, { status: 400 });
  }

  // Expand tilde and normalize
  const normalizedPath = resolvePath(filePath);

  // Security check - only allow paths from environment config
  const allowedPaths = [
    process.env.WORKSPACE_BASE_PATH || '~/Documents/Shared',
    process.env.PROJECTS_PATH || '~/Documents/Shared/projects',
  ].map(resolvePath);

  const isAllowed = allowedPaths.some((allowed) => isPathWithinBase(normalizedPath, allowed));

  if (!isAllowed) {
    return NextResponse.json({ error: 'Path not allowed' }, { status: 403 });
  }

  if (!existsSync(normalizedPath)) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  try {
    const content = readFileSync(normalizedPath, 'utf-8');
    return new NextResponse(content, {
      headers: {
        'Content-Type': 'text/html',
      },
    });
  } catch (error) {
    console.error('[FILE] Error reading file:', error);
    return NextResponse.json({ error: 'Failed to read file' }, { status: 500 });
  }
}
