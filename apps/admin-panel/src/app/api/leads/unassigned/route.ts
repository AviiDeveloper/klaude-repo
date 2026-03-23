import { NextRequest, NextResponse } from 'next/server';
import { resolveAdminFromRequest } from '@/lib/admin-auth';
import { queryAll } from '@/lib/db';

export async function GET(req: NextRequest) {
  const admin = resolveAdminFromRequest(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Leads that exist in activity log as auto_assigned failures or never assigned
  // For now, we track unassigned leads as those with no active assignment
  const unassigned = queryAll<Record<string, unknown>>(`
    SELECT sal.lead_id, sal.notes, sal.created_at
    FROM sales_activity_log sal
    WHERE sal.action = 'auto_assigned'
      AND sal.lead_id NOT IN (
        SELECT la.lead_id FROM lead_assignments la WHERE la.status NOT IN ('rejected')
      )
    ORDER BY sal.created_at DESC
    LIMIT 100
  `);

  return NextResponse.json({ data: unassigned });
}
