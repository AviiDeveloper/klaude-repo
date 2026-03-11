/**
 * Task Activities API
 * Endpoints for logging and retrieving task activities
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { broadcast } from '@/lib/events';
import { requireAgentApiToken } from '@/lib/agent-api-auth';
import type { TaskActivity } from '@/lib/types';

const ALLOWED_ACTIVITY_TYPES = new Set([
  'spawned',
  'updated',
  'completed',
  'file_created',
  'status_changed',
  'test_passed',
  'test_failed',
]);
const MAX_MESSAGE_LENGTH = 2000;
const MAX_METADATA_CHARS = 10000;

/**
 * GET /api/tasks/[id]/activities
 * Retrieve all activities for a task
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const taskId = params.id;
    const db = getDb();

    // Get activities with agent info
    const activities = db.prepare(`
      SELECT 
        a.*,
        ag.id as agent_id,
        ag.name as agent_name,
        ag.avatar_emoji as agent_avatar_emoji
      FROM task_activities a
      LEFT JOIN agents ag ON a.agent_id = ag.id
      WHERE a.task_id = ?
      ORDER BY a.created_at DESC
    `).all(taskId) as any[];

    // Transform to include agent object
    const result: TaskActivity[] = activities.map(row => ({
      id: row.id,
      task_id: row.task_id,
      agent_id: row.agent_id,
      activity_type: row.activity_type,
      message: row.message,
      metadata: row.metadata,
      created_at: row.created_at,
      agent: row.agent_id ? {
        id: row.agent_id,
        name: row.agent_name,
        avatar_emoji: row.agent_avatar_emoji,
        role: '',
        status: 'working' as const,
        is_master: false,
        workspace_id: 'default',
        description: '',
        created_at: '',
        updated_at: '',
      } : undefined,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching activities:', error);
    return NextResponse.json(
      { error: 'Failed to fetch activities' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tasks/[id]/activities
 * Log a new activity for a task
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
      activity_type?: unknown;
      message?: unknown;
      agent_id?: unknown;
      metadata?: unknown;
    };
    
    const { activity_type, message, agent_id, metadata } = body;

    if (typeof activity_type !== 'string' || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'activity_type and message are required' },
        { status: 400 }
      );
    }

    const normalizedType = activity_type.trim().toLowerCase();
    const normalizedMessage = message.trim();
    if (!ALLOWED_ACTIVITY_TYPES.has(normalizedType)) {
      return NextResponse.json({ error: 'Invalid activity_type' }, { status: 400 });
    }
    if (normalizedMessage.length === 0 || normalizedMessage.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json(
        { error: `message must be between 1 and ${MAX_MESSAGE_LENGTH} characters` },
        { status: 400 },
      );
    }
    if (agent_id !== undefined && agent_id !== null && typeof agent_id !== 'string') {
      return NextResponse.json({ error: 'agent_id must be a string when provided' }, { status: 400 });
    }
    if (metadata !== undefined && metadata !== null) {
      if (typeof metadata !== 'object' || Array.isArray(metadata)) {
        return NextResponse.json({ error: 'metadata must be an object when provided' }, { status: 400 });
      }
      const serializedMetadata = JSON.stringify(metadata);
      if (serializedMetadata.length > MAX_METADATA_CHARS) {
        return NextResponse.json(
          { error: `metadata is too large. Max ${MAX_METADATA_CHARS} characters.` },
          { status: 400 },
        );
      }
    }

    const db = getDb();
    const taskExists = db.prepare('SELECT id FROM tasks WHERE id = ?').get(taskId) as { id: string } | undefined;
    if (!taskExists) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }
    const id = crypto.randomUUID();

    // Insert activity
    db.prepare(`
      INSERT INTO task_activities (id, task_id, agent_id, activity_type, message, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      id,
      taskId,
      typeof agent_id === 'string' ? agent_id : null,
      normalizedType,
      normalizedMessage,
      metadata ? JSON.stringify(metadata) : null
    );

    // Get the created activity with agent info
    const activity = db.prepare(`
      SELECT 
        a.*,
        ag.id as agent_id,
        ag.name as agent_name,
        ag.avatar_emoji as agent_avatar_emoji
      FROM task_activities a
      LEFT JOIN agents ag ON a.agent_id = ag.id
      WHERE a.id = ?
    `).get(id) as any;

    const result: TaskActivity = {
      id: activity.id,
      task_id: activity.task_id,
      agent_id: activity.agent_id,
      activity_type: activity.activity_type,
      message: activity.message,
      metadata: activity.metadata,
      created_at: activity.created_at,
      agent: activity.agent_id ? {
        id: activity.agent_id,
        name: activity.agent_name,
        avatar_emoji: activity.agent_avatar_emoji,
        role: '',
        status: 'working' as const,
        is_master: false,
        workspace_id: 'default',
        description: '',
        created_at: '',
        updated_at: '',
      } : undefined,
    };

    // Broadcast to SSE clients
    broadcast({
      type: 'activity_logged',
      payload: result,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error creating activity:', error);
    return NextResponse.json(
      { error: 'Failed to create activity' },
      { status: 500 }
    );
  }
}
