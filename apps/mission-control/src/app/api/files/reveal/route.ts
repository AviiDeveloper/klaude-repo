/**
 * File Reveal API
 * Opens a file's location in Finder (macOS) or Explorer (Windows)
 */

import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import path from 'path';
import { isPathWithinBase, resolvePath } from '@/lib/path-security';

const execFileAsync = promisify(execFile);

export async function POST(request: NextRequest) {
  try {
    const { filePath } = await request.json();

    if (!filePath || typeof filePath !== 'string') {
      return NextResponse.json({ error: 'filePath is required' }, { status: 400 });
    }

    // Security: Ensure path is within allowed directories (from env config)
    const allowedPaths = [
      process.env.WORKSPACE_BASE_PATH || '~/Documents/Shared',
      process.env.PROJECTS_PATH || '~/Documents/Shared/projects',
    ].map(resolvePath);

    const normalizedPath = resolvePath(filePath);
    const isAllowed = allowedPaths.some((allowed) => isPathWithinBase(normalizedPath, allowed));

    if (!isAllowed) {
      console.warn(`[FILE] Blocked access to: ${filePath}`);
      return NextResponse.json(
        { error: 'Path not in allowed directories' },
        { status: 403 }
      );
    }

    // Check if file/directory exists
    if (!existsSync(normalizedPath)) {
      return NextResponse.json(
        { error: 'File or directory not found', path: normalizedPath },
        { status: 404 }
      );
    }

    // Open in Finder (macOS) - reveal the file
    const platform = process.platform;
    if (platform === 'darwin') {
      await execFileAsync('open', ['-R', normalizedPath]);
    } else if (platform === 'win32') {
      await execFileAsync('explorer', [`/select,${normalizedPath}`]);
    } else {
      await execFileAsync('xdg-open', [path.dirname(normalizedPath)]);
    }

    console.log(`[FILE] Revealed: ${normalizedPath}`);
    return NextResponse.json({ success: true, path: normalizedPath });
  } catch (error) {
    console.error('[FILE] Error revealing file:', error);
    return NextResponse.json(
      { error: 'Failed to reveal file' },
      { status: 500 }
    );
  }
}
