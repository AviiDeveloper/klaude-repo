/**
 * File Download API
 * Returns file content over HTTP from the server filesystem.
 * This enables remote agents to read files from
 * the Mission Control server.
 */

import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, existsSync, statSync } from 'fs';
import path from 'path';
import { requireAgentApiToken } from '@/lib/agent-api-auth';
import { hasPathTraversal, isPathWithinBase, resolvePath } from '@/lib/path-security';

// Base directory for all project files - must match upload endpoint
// Set via PROJECTS_PATH env var (e.g., ~/projects or /var/www/projects)
const PROJECTS_BASE = (process.env.PROJECTS_PATH || '~/projects').replace(/^~/, process.env.HOME || '');
export const dynamic = 'force-dynamic';

// MIME types for common file extensions
const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.htm': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.xml': 'application/xml',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
};

/**
 * GET /api/files/download?path=...
 * Download a file from the projects directory
 *
 * Query params:
 *   - path: Full path (must be under PROJECTS_BASE)
 *   - relativePath: Path relative to PROJECTS_BASE (alternative to path)
 *   - raw: If 'true', returns raw file content; otherwise returns JSON wrapper
 */
export async function GET(request: NextRequest) {
  try {
    const authError = requireAgentApiToken(request);
    if (authError) {
      return authError;
    }

    const searchParams = request.nextUrl.searchParams;
    const fullPathParam = searchParams.get('path');
    const relativePathParam = searchParams.get('relativePath');
    const raw = searchParams.get('raw') === 'true';
    const basePath = resolvePath(PROJECTS_BASE);

    // Determine the target path
    let targetPath: string;

    if (fullPathParam) {
      // Full path provided - validate it's under PROJECTS_BASE
      const normalizedPath = resolvePath(fullPathParam);
      if (!isPathWithinBase(normalizedPath, basePath)) {
        return NextResponse.json(
          { error: 'Access denied: path must be within projects directory' },
          { status: 403 }
        );
      }
      targetPath = normalizedPath;
    } else if (relativePathParam) {
      // Relative path provided
      const normalizedRelative = path.normalize(relativePathParam);
      if (
        normalizedRelative.includes('\0') ||
        path.isAbsolute(normalizedRelative) ||
        hasPathTraversal(relativePathParam)
      ) {
        return NextResponse.json(
          { error: 'Invalid path: must be relative and cannot traverse upward' },
          { status: 400 }
        );
      }
      targetPath = resolvePath(path.join(basePath, normalizedRelative));
      if (!isPathWithinBase(targetPath, basePath)) {
        return NextResponse.json(
          { error: 'Access denied: path must be within projects directory' },
          { status: 403 },
        );
      }
    } else {
      return NextResponse.json(
        { error: 'Either path or relativePath query parameter is required' },
        { status: 400 }
      );
    }

    // Check file exists
    if (!existsSync(targetPath)) {
      return NextResponse.json(
        { error: 'File not found', path: targetPath },
        { status: 404 }
      );
    }

    // Check it's a file, not a directory
    const stats = statSync(targetPath);
    if (stats.isDirectory()) {
      return NextResponse.json(
        { error: 'Path is a directory, not a file', path: targetPath },
        { status: 400 }
      );
    }

    // Determine content type
    const ext = path.extname(targetPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const isText = contentType.startsWith('text/') ||
                   contentType === 'application/json' ||
                   contentType === 'application/javascript' ||
                   contentType === 'application/xml';

    // Read file
    const content = readFileSync(targetPath, isText ? 'utf-8' : undefined);

    console.log(`[FILE DOWNLOAD] Read: ${targetPath} (${stats.size} bytes)`);

    // Return raw content or JSON wrapper
    if (raw) {
      return new NextResponse(content, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Content-Length': String(stats.size),
        },
      });
    }

    // JSON response with metadata
    return NextResponse.json({
      success: true,
      path: targetPath,
      relativePath: path.relative(basePath, targetPath),
      size: stats.size,
      contentType,
      content: isText ? content : Buffer.from(content).toString('base64'),
      encoding: isText ? 'utf-8' : 'base64',
      modifiedAt: stats.mtime.toISOString(),
    });
  } catch (error) {
    console.error('Error downloading file:', error);
    return NextResponse.json(
      { error: 'Failed to download file', details: String(error) },
      { status: 500 }
    );
  }
}
