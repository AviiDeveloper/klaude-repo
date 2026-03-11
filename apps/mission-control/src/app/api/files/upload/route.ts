/**
 * File Upload API
 * Accepts file content over HTTP and saves it to the server filesystem.
 * This enables remote agents to create files on
 * the Mission Control server.
 */

import { NextRequest, NextResponse } from 'next/server';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';
import { requireAgentApiToken } from '@/lib/agent-api-auth';
import { hasPathTraversal, isPathWithinBase, resolvePath } from '@/lib/path-security';

// Base directory for all uploaded project files
// Set via PROJECTS_PATH env var (e.g., ~/projects or /var/www/projects)
const PROJECTS_BASE = (process.env.PROJECTS_PATH || '~/projects').replace(/^~/, process.env.HOME || '');
const MAX_UPLOAD_BYTES = Number(process.env.MISSION_CONTROL_MAX_UPLOAD_BYTES || '1048576');
const ALLOWED_ENCODINGS = new Set<BufferEncoding>(['utf-8', 'utf8', 'ascii', 'latin1', 'base64']);

interface UploadRequest {
  // Path relative to PROJECTS_BASE (e.g., "dashboard-redesign/index.html")
  relativePath: string;
  // File content (text)
  content: string;
  // Optional: encoding (default: utf-8)
  encoding?: BufferEncoding;
}

/**
 * POST /api/files/upload
 * Upload a file to the server
 */
export async function POST(request: NextRequest) {
  try {
    const authError = requireAgentApiToken(request);
    if (authError) {
      return authError;
    }

    const body: UploadRequest = await request.json();
    const { relativePath, content, encoding = 'utf-8' } = body;

    if (!relativePath || content === undefined) {
      return NextResponse.json(
        { error: 'relativePath and content are required' },
        { status: 400 }
      );
    }

    if (typeof relativePath !== 'string' || relativePath.trim().length === 0 || relativePath.length > 300) {
      return NextResponse.json(
        { error: 'relativePath must be a non-empty string up to 300 characters' },
        { status: 400 }
      );
    }

    if (typeof content !== 'string') {
      return NextResponse.json({ error: 'content must be a string' }, { status: 400 });
    }

    if (!ALLOWED_ENCODINGS.has(encoding)) {
      return NextResponse.json({ error: 'Unsupported encoding' }, { status: 400 });
    }

    const sizeBytes = Buffer.byteLength(content, encoding);
    if (sizeBytes > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: `File too large. Max allowed is ${MAX_UPLOAD_BYTES} bytes.` },
        { status: 413 },
      );
    }

    const normalizedPath = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, '');
    if (
      hasPathTraversal(relativePath) ||
      path.isAbsolute(normalizedPath) ||
      normalizedPath.includes('\0') ||
      normalizedPath === '.'
    ) {
      return NextResponse.json(
        { error: 'Invalid path: must be relative and cannot traverse upward' },
        { status: 400 }
      );
    }

    // Build full path
    const basePath = resolvePath(PROJECTS_BASE);
    const fullPath = resolvePath(path.join(basePath, normalizedPath));
    if (!isPathWithinBase(fullPath, basePath)) {
      return NextResponse.json({ error: 'Invalid path: outside projects directory' }, { status: 403 });
    }

    // Ensure base directory exists
    if (!existsSync(basePath)) {
      mkdirSync(basePath, { recursive: true });
    }

    // Ensure parent directory exists
    const parentDir = path.dirname(fullPath);
    if (!existsSync(parentDir)) {
      mkdirSync(parentDir, { recursive: true });
    }

    // Write the file
    writeFileSync(fullPath, content, { encoding });

    console.log(`[FILE UPLOAD] Created: ${fullPath}`);

    return NextResponse.json({
      success: true,
      path: fullPath,
      relativePath: normalizedPath,
      size: sizeBytes,
    }, { status: 201 });
  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json(
      { error: 'Failed to upload file', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * GET /api/files/upload
 * Get info about the upload endpoint
 */
export async function GET() {
  return NextResponse.json({
    description: 'File upload endpoint for remote agents',
    basePath: PROJECTS_BASE,
    usage: {
      method: 'POST',
      body: {
        relativePath: 'project-name/filename.html',
        content: '<html>...</html>',
        encoding: 'utf-8 (optional)',
      },
    },
  });
}
