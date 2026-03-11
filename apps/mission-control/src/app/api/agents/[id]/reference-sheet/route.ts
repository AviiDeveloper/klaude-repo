import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { queryOne, queryAll, run, transaction } from '@/lib/db';
import { normalizeLifecycleState, validateReferenceSheetTransition } from '@/lib/reference-sheet-lifecycle';
import type { Agent, AgentReferenceSheet, AgentReferenceSheetTransition } from '@/lib/types';

type LifecycleAction = 'create' | 'version' | 'revise' | 'archive';

interface LifecycleBody {
  action?: LifecycleAction;
  sheet_id?: string;
  title?: string;
  markdown?: string;
  metadata?: unknown;
  reason?: string;
  actor?: string;
}

function parseMetadata(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function mergeMetadataWithAudit(
  currentMetadata: string | null | undefined,
  audit: Record<string, unknown>,
  incoming: unknown,
): string {
  let base: Record<string, unknown> = {};
  if (currentMetadata) {
    try {
      const parsed = JSON.parse(currentMetadata);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        base = parsed as Record<string, unknown>;
      }
    } catch {
      base = {};
    }
  }
  const incomingParsed = parseMetadata(incoming);
  return JSON.stringify({
    ...base,
    ...incomingParsed,
    lifecycle: audit,
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const query = new URL(request.url).searchParams;
    const includeHistory = query.get('history') === 'true';
    const includeArchived = query.get('include_archived') === 'true';
    const includeTransitions = query.get('transitions') === 'true';

    const agent = queryOne<Agent>('SELECT * FROM agents WHERE id = ?', [id]);
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    if (includeHistory) {
      const sheets = queryAll<AgentReferenceSheet>(
        `SELECT * FROM agent_reference_sheets
         WHERE agent_id = ?
           AND (? = 1 OR COALESCE(lifecycle_state, 'active') != 'archived')
         ORDER BY version DESC`,
        [id, includeArchived ? 1 : 0],
      );
      const transitions = includeTransitions
        ? queryAll<AgentReferenceSheetTransition>(
            `SELECT * FROM agent_reference_sheet_transitions
             WHERE agent_id = ?
             ORDER BY created_at DESC`,
            [id],
          )
        : [];
      return NextResponse.json({ agent_id: id, sheets, transitions });
    }

    const latest = queryOne<AgentReferenceSheet>(
      `SELECT * FROM agent_reference_sheets
       WHERE agent_id = ?
         AND (? = 1 OR COALESCE(lifecycle_state, 'active') != 'archived')
       ORDER BY
         CASE WHEN COALESCE(lifecycle_state, 'active') = 'active' THEN 0 ELSE 1 END,
         version DESC
       LIMIT 1`,
      [id, includeArchived ? 1 : 0],
    );

    return NextResponse.json({ agent_id: id, latest: latest || null });
  } catch (error) {
    console.error('Failed to fetch agent reference sheet:', error);
    return NextResponse.json({ error: 'Failed to fetch reference sheet' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: agentId } = await params;
    const body = (await request.json()) as LifecycleBody;
    const action = body.action;
    if (!action || (action !== 'create' && action !== 'version' && action !== 'revise')) {
      return NextResponse.json({ error: 'action must be create, version, or revise' }, { status: 400 });
    }

    const agent = queryOne<Agent>('SELECT * FROM agents WHERE id = ?', [agentId]);
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    const now = new Date().toISOString();
    const actor = (body.actor || 'operator').trim();
    const reason = (body.reason || '').trim() || `${action} requested`;
    const title = (body.title || '').trim();
    const markdown = (body.markdown || '').trim();
    if (!title || !markdown) {
      return NextResponse.json({ error: 'title and markdown are required' }, { status: 400 });
    }

    const sheets = queryAll<AgentReferenceSheet>(
      `SELECT * FROM agent_reference_sheets WHERE agent_id = ? ORDER BY version DESC`,
      [agentId],
    );
    const hasSheets = sheets.length > 0;
    const currentMaxVersion = sheets[0]?.version || 0;
    const baseSheet = body.sheet_id
      ? queryOne<AgentReferenceSheet>(
          `SELECT * FROM agent_reference_sheets WHERE id = ? AND agent_id = ?`,
          [body.sheet_id, agentId],
        )
      : sheets.find((sheet) => normalizeLifecycleState(sheet.lifecycle_state) !== 'archived') || sheets[0];

    const transitionCheck = validateReferenceSheetTransition({
      action,
      hasExistingSheets: hasSheets,
      currentState: baseSheet?.lifecycle_state || null,
    });
    if (!transitionCheck.ok) {
      return NextResponse.json({ error: transitionCheck.message || 'Invalid lifecycle transition' }, { status: 409 });
    }
    if (action !== 'create' && !baseSheet) {
      return NextResponse.json({ error: 'A base reference sheet is required for this action' }, { status: 400 });
    }

    const nextId = uuidv4();
    const nextVersion = currentMaxVersion + 1;
    const toState = transitionCheck.toState || 'active';

    transaction(() => {
      if (toState === 'active') {
        const activeSheets = queryAll<AgentReferenceSheet>(
          `SELECT * FROM agent_reference_sheets
           WHERE agent_id = ? AND COALESCE(lifecycle_state, 'active') = 'active'`,
          [agentId],
        );
        for (const activeSheet of activeSheets) {
          run(
            `UPDATE agent_reference_sheets
             SET lifecycle_state = 'archived',
                 archived_at = ?,
                 updated_at = ?
             WHERE id = ?`,
            [now, now, activeSheet.id],
          );
          run(
            `INSERT INTO agent_reference_sheet_transitions
             (id, sheet_id, agent_id, transition_type, from_state, to_state, actor, reason, metadata, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              uuidv4(),
              activeSheet.id,
              agentId,
              'archive',
              'active',
              'archived',
              actor,
              `Superseded by ${action} v${nextVersion}`,
              JSON.stringify({ superseded_by: nextId, action }),
              now,
            ],
          );
        }
      }

      const lifecycleAudit = {
        action,
        state: toState,
        actor,
        reason,
        transitioned_at: now,
        from_sheet_id: baseSheet?.id || null,
      };
      const mergedMetadata = mergeMetadataWithAudit(baseSheet?.metadata, lifecycleAudit, body.metadata);

      run(
        `INSERT INTO agent_reference_sheets
         (id, agent_id, version, title, markdown, lifecycle_state, lifecycle_action, parent_sheet_id, archived_at, metadata, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          nextId,
          agentId,
          nextVersion,
          title,
          markdown,
          toState,
          action,
          baseSheet?.id || null,
          toState === 'archived' ? now : null,
          mergedMetadata,
          now,
          now,
        ],
      );

      run(
        `INSERT INTO agent_reference_sheet_transitions
         (id, sheet_id, agent_id, transition_type, from_state, to_state, actor, reason, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          nextId,
          agentId,
          action,
          baseSheet?.lifecycle_state ? normalizeLifecycleState(baseSheet.lifecycle_state) : null,
          toState,
          actor,
          reason,
          JSON.stringify({ parent_sheet_id: baseSheet?.id || null }),
          now,
        ],
      );
    });

    const sheet = queryOne<AgentReferenceSheet>(`SELECT * FROM agent_reference_sheets WHERE id = ?`, [nextId]);
    return NextResponse.json({ agent_id: agentId, sheet }, { status: 201 });
  } catch (error) {
    console.error('Failed to create/version/revise reference sheet:', error);
    return NextResponse.json({ error: 'Failed to mutate reference sheet lifecycle' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: agentId } = await params;
    const body = (await request.json()) as LifecycleBody;
    if (body.action !== 'archive') {
      return NextResponse.json({ error: 'PATCH only supports archive action' }, { status: 400 });
    }
    if (!body.sheet_id) {
      return NextResponse.json({ error: 'sheet_id is required for archive' }, { status: 400 });
    }

    const agent = queryOne<Agent>('SELECT * FROM agents WHERE id = ?', [agentId]);
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    const sheet = queryOne<AgentReferenceSheet>(
      `SELECT * FROM agent_reference_sheets WHERE id = ? AND agent_id = ?`,
      [body.sheet_id, agentId],
    );
    if (!sheet) {
      return NextResponse.json({ error: 'Reference sheet not found' }, { status: 404 });
    }

    const transitionCheck = validateReferenceSheetTransition({
      action: 'archive',
      hasExistingSheets: true,
      currentState: sheet.lifecycle_state || null,
    });
    if (!transitionCheck.ok) {
      return NextResponse.json({ error: transitionCheck.message || 'Invalid lifecycle transition' }, { status: 409 });
    }

    const now = new Date().toISOString();
    const actor = (body.actor || 'operator').trim();
    const reason = (body.reason || '').trim() || 'archive requested';
    const lifecycleAudit = {
      action: 'archive',
      state: 'archived',
      actor,
      reason,
      transitioned_at: now,
    };
    const metadata = mergeMetadataWithAudit(sheet.metadata, lifecycleAudit, body.metadata);

    transaction(() => {
      run(
        `UPDATE agent_reference_sheets
         SET lifecycle_state = 'archived',
             archived_at = ?,
             metadata = ?,
             updated_at = ?
         WHERE id = ?`,
        [now, metadata, now, sheet.id],
      );
      run(
        `INSERT INTO agent_reference_sheet_transitions
         (id, sheet_id, agent_id, transition_type, from_state, to_state, actor, reason, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          sheet.id,
          agentId,
          'archive',
          normalizeLifecycleState(sheet.lifecycle_state),
          'archived',
          actor,
          reason,
          JSON.stringify({ archived_sheet_id: sheet.id }),
          now,
        ],
      );
    });

    const updated = queryOne<AgentReferenceSheet>(`SELECT * FROM agent_reference_sheets WHERE id = ?`, [sheet.id]);
    return NextResponse.json({ agent_id: agentId, sheet: updated });
  } catch (error) {
    console.error('Failed to archive reference sheet:', error);
    return NextResponse.json({ error: 'Failed to archive reference sheet' }, { status: 500 });
  }
}
