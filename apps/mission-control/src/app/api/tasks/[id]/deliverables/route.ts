/**
 * Task Deliverables API
 * Endpoints for managing task deliverables (files, URLs, artifacts)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { broadcast } from '@/lib/events';
import { existsSync } from 'fs';
import { requireAgentApiToken } from '@/lib/agent-api-auth';
import { isPathWithinBase, resolvePath } from '@/lib/path-security';
import type { TaskDeliverable } from '@/lib/types';

const ALLOWED_DELIVERABLE_TYPES = new Set(['file', 'url', 'artifact']);
const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 4000;
const MAX_PATH_LENGTH = 2000;

/**
 * GET /api/tasks/[id]/deliverables
 * Retrieve all deliverables for a task
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const taskId = params.id;
    const db = getDb();

    const deliverables = db.prepare(`
      SELECT *
      FROM task_deliverables
      WHERE task_id = ?
      ORDER BY created_at DESC
    `).all(taskId) as TaskDeliverable[];

    return NextResponse.json(deliverables);
  } catch (error) {
    console.error('Error fetching deliverables:', error);
    return NextResponse.json(
      { error: 'Failed to fetch deliverables' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tasks/[id]/deliverables
 * Add a new deliverable to a task
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authError = requireAgentApiToken(request);
    if (authError) {
      return authError;
    }

    const taskId = params.id;
    const body = await request.json() as {
      deliverable_type?: unknown;
      title?: unknown;
      path?: unknown;
      description?: unknown;
    };
    
    const { deliverable_type, title, path, description } = body;

    if (typeof deliverable_type !== 'string' || typeof title !== 'string') {
      return NextResponse.json(
        { error: 'deliverable_type and title are required' },
        { status: 400 }
      );
    }

    const normalizedType = deliverable_type.trim().toLowerCase();
    const normalizedTitle = title.trim();
    const normalizedDescription = typeof description === 'string' ? description.trim() : null;
    const rawPath = typeof path === 'string' ? path.trim() : '';

    if (!ALLOWED_DELIVERABLE_TYPES.has(normalizedType)) {
      return NextResponse.json({ error: 'Invalid deliverable_type' }, { status: 400 });
    }
    if (normalizedTitle.length === 0 || normalizedTitle.length > MAX_TITLE_LENGTH) {
      return NextResponse.json(
        { error: `title must be between 1 and ${MAX_TITLE_LENGTH} characters` },
        { status: 400 },
      );
    }
    if (normalizedDescription && normalizedDescription.length > MAX_DESCRIPTION_LENGTH) {
      return NextResponse.json(
        { error: `description must be <= ${MAX_DESCRIPTION_LENGTH} characters` },
        { status: 400 },
      );
    }
    if (rawPath.length > MAX_PATH_LENGTH) {
      return NextResponse.json({ error: `path must be <= ${MAX_PATH_LENGTH} characters` }, { status: 400 });
    }
    if (rawPath.includes('\0')) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    if ((normalizedType === 'file' || normalizedType === 'url') && rawPath.length === 0) {
      return NextResponse.json({ error: 'path is required for file and url deliverables' }, { status: 400 });
    }

    if (normalizedType === 'url') {
      try {
        const parsed = new URL(rawPath);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          return NextResponse.json({ error: 'URL deliverables must use http or https' }, { status: 400 });
        }
      } catch {
        return NextResponse.json({ error: 'Invalid URL for url deliverable' }, { status: 400 });
      }
    }

    // Validate file existence for file deliverables
    let fileExists = true;
    let normalizedPath = rawPath;
    if (normalizedType === 'file') {
      const expandedPath = resolvePath(rawPath);
      const allowedBases = [
        process.env.PROJECTS_PATH || '~/Documents/Shared/projects',
        process.env.WORKSPACE_BASE_PATH || '~/Documents/Shared',
      ].map(resolvePath);

      const isAllowedPath = allowedBases.some((base) => isPathWithinBase(expandedPath, base));
      if (!isAllowedPath) {
        return NextResponse.json(
          { error: 'File path is outside allowed workspace/project directories' },
          { status: 403 },
        );
      }

      normalizedPath = expandedPath;
      fileExists = existsSync(expandedPath);
      if (!fileExists) {
        console.warn(`[DELIVERABLE] Warning: File does not exist: ${expandedPath}`);
      }
    }

    const db = getDb();
    const taskExists = db.prepare('SELECT id FROM tasks WHERE id = ?').get(taskId) as { id: string } | undefined;
    if (!taskExists) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }
    const id = crypto.randomUUID();

    // Insert deliverable
    db.prepare(`
      INSERT INTO task_deliverables (id, task_id, deliverable_type, title, path, description)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      id,
      taskId,
      normalizedType,
      normalizedTitle,
      rawPath.length > 0 ? rawPath : null,
      normalizedDescription
    );

    // Get the created deliverable
    const deliverable = db.prepare(`
      SELECT *
      FROM task_deliverables
      WHERE id = ?
    `).get(id) as TaskDeliverable;

    // Broadcast to SSE clients
    broadcast({
      type: 'deliverable_added',
      payload: deliverable,
    });

    // Return with warning if file doesn't exist
    if (normalizedType === 'file' && !fileExists) {
      return NextResponse.json(
        {
          ...deliverable,
          warning: `File does not exist at path: ${normalizedPath}. Please create the file.`
        },
        { status: 201 }
      );
    }

    return NextResponse.json(deliverable, { status: 201 });
  } catch (error) {
    console.error('Error creating deliverable:', error);
    return NextResponse.json(
      { error: 'Failed to create deliverable' },
      { status: 500 }
    );
  }
}
