import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import {
  buildWorkspaceSnapshot,
  generateCodexPlan,
  type WorkspacePerformanceSnapshot,
} from '@/lib/mission-planner';

export const dynamic = 'force-dynamic';

function parseHorizonDays(input: unknown): number {
  const parsed = Number(input);
  if (!Number.isFinite(parsed)) {
    return 2;
  }
  return Math.min(14, Math.max(1, Math.floor(parsed)));
}

function validateObjective(input: unknown): string | null {
  if (input === undefined || input === null) {
    return 'Plan the next shift cycle to reduce backlog and improve throughput.';
  }
  if (typeof input !== 'string') {
    return null;
  }
  const trimmed = input.trim();
  if (trimmed.length === 0 || trimmed.length > 600) {
    return null;
  }
  return trimmed;
}

async function resolveWorkspace(idOrSlug: string): Promise<{ id: string; name: string; slug: string } | null> {
  const db = getDb();
  const workspace = db
    .prepare('SELECT id, name, slug FROM workspaces WHERE id = ? OR slug = ?')
    .get(idOrSlug, idOrSlug) as { id: string; name: string; slug: string } | undefined;

  return workspace ?? null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const workspace = await resolveWorkspace(id);
  if (!workspace) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  const snapshot = buildWorkspaceSnapshot(workspace.id);
  const codexModel = process.env.MISSION_CONTROL_CODEX_MODEL || 'codex5.3';
  const codexConfigured = Boolean(process.env.OPENAI_API_KEY);

  return NextResponse.json({
    workspace,
    snapshot,
    codex: {
      configured: codexConfigured,
      model: codexModel,
    },
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const workspace = await resolveWorkspace(id);
  if (!workspace) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  let body: { objective?: unknown; horizonDays?: unknown } = {};
  try {
    body = (await request.json()) as { objective?: unknown; horizonDays?: unknown };
  } catch {
    body = {};
  }

  const objective = validateObjective(body.objective);
  if (!objective) {
    return NextResponse.json({ error: 'objective must be a non-empty string up to 600 characters' }, { status: 400 });
  }

  const horizonDays = parseHorizonDays(body.horizonDays);
  const snapshot = buildWorkspaceSnapshot(workspace.id);
  const result = await generateCodexPlan({
    objective,
    horizonDays,
    snapshot,
  });

  return NextResponse.json({
    workspace,
    objective,
    horizonDays,
    snapshot,
    recommendation: result.plan,
    source: result.source,
    model: result.model,
    warning: result.warning,
    generatedAt: new Date().toISOString(),
  });
}

export type CodexPlannerResponse = {
  workspace: { id: string; name: string; slug: string };
  snapshot: WorkspacePerformanceSnapshot;
  codex?: { configured: boolean; model: string };
  objective?: string;
  horizonDays?: number;
  recommendation?: {
    summary: string;
    schedule: Array<{ window: string; action: string; rationale: string }>;
    performanceChecks: Array<{ metric: string; target: string; cadence: string }>;
    risks: string[];
    nextActions: string[];
  };
  source?: 'codex' | 'fallback';
  model?: string;
  warning?: string;
  generatedAt?: string;
};
