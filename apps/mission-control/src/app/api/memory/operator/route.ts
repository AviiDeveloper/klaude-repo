import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { queryOne, run } from '@/lib/db';
import type { OperatorProfile, Workspace } from '@/lib/types';

export const dynamic = 'force-dynamic';

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function serializeProfile(profile: OperatorProfile | undefined, workspaceId: string) {
  return {
    workspace_id: workspaceId,
    profile: profile || null,
  };
}

// GET /api/memory/operator?workspace_id=default
export async function GET(request: NextRequest) {
  try {
    const workspaceId = request.nextUrl.searchParams.get('workspace_id') || 'default';
    const profile = queryOne<OperatorProfile>(
      'SELECT * FROM operator_profiles WHERE workspace_id = ?',
      [workspaceId],
    );

    return NextResponse.json(serializeProfile(profile, workspaceId));
  } catch (error) {
    console.error('Failed to fetch operator profile:', error);
    return NextResponse.json({ error: 'Failed to fetch operator profile' }, { status: 500 });
  }
}

// PUT /api/memory/operator
// Body: { workspace_id?: string, operator_name?: string, ... }
export async function PUT(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<OperatorProfile> & { workspace_id?: string };
    const workspaceId = (body.workspace_id || 'default').trim();

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspace_id is required' }, { status: 400 });
    }

    const workspace = queryOne<Workspace>('SELECT * FROM workspaces WHERE id = ?', [workspaceId]);
    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    const now = new Date().toISOString();
    const payload = {
      operator_name: normalizeOptionalString(body.operator_name),
      identity_summary: normalizeOptionalString(body.identity_summary),
      strategic_goals: normalizeOptionalString(body.strategic_goals),
      communication_preferences: normalizeOptionalString(body.communication_preferences),
      approval_preferences: normalizeOptionalString(body.approval_preferences),
      risk_preferences: normalizeOptionalString(body.risk_preferences),
      budget_preferences: normalizeOptionalString(body.budget_preferences),
      schedule_preferences: normalizeOptionalString(body.schedule_preferences),
      tool_preferences: normalizeOptionalString(body.tool_preferences),
      escalation_preferences: normalizeOptionalString(body.escalation_preferences),
      memory_notes: normalizeOptionalString(body.memory_notes),
      metadata: normalizeOptionalString(body.metadata),
    };

    const existing = queryOne<OperatorProfile>(
      'SELECT * FROM operator_profiles WHERE workspace_id = ?',
      [workspaceId],
    );

    if (existing) {
      run(
        `UPDATE operator_profiles
         SET operator_name = ?,
             identity_summary = ?,
             strategic_goals = ?,
             communication_preferences = ?,
             approval_preferences = ?,
             risk_preferences = ?,
             budget_preferences = ?,
             schedule_preferences = ?,
             tool_preferences = ?,
             escalation_preferences = ?,
             memory_notes = ?,
             metadata = ?,
             updated_at = ?
         WHERE workspace_id = ?`,
        [
          payload.operator_name,
          payload.identity_summary,
          payload.strategic_goals,
          payload.communication_preferences,
          payload.approval_preferences,
          payload.risk_preferences,
          payload.budget_preferences,
          payload.schedule_preferences,
          payload.tool_preferences,
          payload.escalation_preferences,
          payload.memory_notes,
          payload.metadata,
          now,
          workspaceId,
        ],
      );
    } else {
      run(
        `INSERT INTO operator_profiles (
          id,
          workspace_id,
          operator_name,
          identity_summary,
          strategic_goals,
          communication_preferences,
          approval_preferences,
          risk_preferences,
          budget_preferences,
          schedule_preferences,
          tool_preferences,
          escalation_preferences,
          memory_notes,
          metadata,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          workspaceId,
          payload.operator_name,
          payload.identity_summary,
          payload.strategic_goals,
          payload.communication_preferences,
          payload.approval_preferences,
          payload.risk_preferences,
          payload.budget_preferences,
          payload.schedule_preferences,
          payload.tool_preferences,
          payload.escalation_preferences,
          payload.memory_notes,
          payload.metadata,
          now,
          now,
        ],
      );
    }

    const updated = queryOne<OperatorProfile>(
      'SELECT * FROM operator_profiles WHERE workspace_id = ?',
      [workspaceId],
    );

    return NextResponse.json(serializeProfile(updated, workspaceId));
  } catch (error) {
    console.error('Failed to update operator profile:', error);
    return NextResponse.json({ error: 'Failed to update operator profile' }, { status: 500 });
  }
}
