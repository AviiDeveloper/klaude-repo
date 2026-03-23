import { NextRequest, NextResponse } from 'next/server';
import { resolveUserFromRequest } from '@/lib/auth';
import { run, queryOne, transaction } from '@/lib/db';
import { randomUUID } from 'crypto';
import type { AssignmentStatus } from '@/lib/types';

const VALID_TRANSITIONS: Record<string, AssignmentStatus[]> = {
  new: ['visited', 'rejected'],
  visited: ['pitched', 'rejected'],
  pitched: ['sold', 'rejected', 'visited'], // can revisit
  sold: [], // terminal
  rejected: ['new'], // can reopen
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = resolveUserFromRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Auth required', code: 'AUTH_REQUIRED' }, { status: 401 });
  }

  const body = await req.json() as {
    status: AssignmentStatus;
    notes?: string;
    commission_amount?: number;
    rejection_reason?: string;
    location_lat?: number;
    location_lng?: number;
  };

  if (!body.status) {
    return NextResponse.json({ error: 'Status is required', code: 'MISSING_STATUS' }, { status: 400 });
  }

  // Verify assignment belongs to user
  const assignment = queryOne<Record<string, unknown>>(
    'SELECT id, status, lead_id FROM lead_assignments WHERE id = ? AND user_id = ?',
    params.id, auth.user_id,
  );

  if (!assignment) {
    return NextResponse.json({ error: 'Assignment not found', code: 'NOT_FOUND' }, { status: 404 });
  }

  const currentStatus = assignment.status as string;
  const allowed = VALID_TRANSITIONS[currentStatus] ?? [];
  if (!allowed.includes(body.status)) {
    return NextResponse.json(
      { error: `Cannot transition from '${currentStatus}' to '${body.status}'`, code: 'INVALID_TRANSITION' },
      { status: 400 },
    );
  }

  transaction(() => {
    // Update assignment
    const now = new Date().toISOString();
    const timestampCol = `${body.status}_at`;
    const validCols = ['visited_at', 'pitched_at', 'sold_at', 'rejected_at'];

    run(
      `UPDATE lead_assignments SET
        status = ?,
        ${validCols.includes(timestampCol) ? `${timestampCol} = ?,` : ''}
        ${body.notes ? 'notes = json_set(COALESCE(notes, "{}"), "$.user_notes", ?),' : ''}
        ${body.commission_amount ? 'commission_amount = ?,' : ''}
        ${body.rejection_reason ? 'rejection_reason = ?,' : ''}
        ${body.location_lat ? 'location_lat = ?,' : ''}
        ${body.location_lng ? 'location_lng = ?,' : ''}
        updated_at = ?
      WHERE id = ?`.replace(/,\s*WHERE/, ' WHERE'), // clean trailing comma
      ...[
        body.status,
        ...(validCols.includes(timestampCol) ? [now] : []),
        ...(body.notes ? [body.notes] : []),
        ...(body.commission_amount ? [body.commission_amount] : []),
        ...(body.rejection_reason ? [body.rejection_reason] : []),
        ...(body.location_lat ? [body.location_lat] : []),
        ...(body.location_lng ? [body.location_lng] : []),
        now,
        params.id,
      ],
    );

    // Log activity
    run(
      `INSERT INTO sales_activity_log (id, user_id, lead_id, assignment_id, action, notes, location_lat, location_lng)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      randomUUID(), auth.user_id, assignment.lead_id, params.id,
      `status_${body.status}`, body.notes ?? null,
      body.location_lat ?? null, body.location_lng ?? null,
    );
  });

  return NextResponse.json({ data: { success: true, status: body.status } });
}
