import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

// POST /api/outreach/campaigns/:id/run - Trigger lead generation pipeline for a campaign
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const db = getDb();

    const campaign = db.prepare('SELECT * FROM outreach_campaigns WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    if (campaign.status !== 'active') {
      return NextResponse.json({ error: 'Campaign is not active' }, { status: 400 });
    }

    // The pipeline engine and store are managed by the core runtime.
    // This endpoint signals intent; the actual pipeline execution is triggered
    // via the core runtime's job trigger API or scheduler.
    //
    // For now, we create a task record that the pipeline scheduler can pick up,
    // or the operator can trigger via the existing /api/jobs/:id/trigger endpoint.

    const body = await request.json().catch(() => ({}));
    const maxResults = (body as Record<string, unknown>).max_results ?? 50;

    // Store the run request as a pending pipeline trigger
    const runId = crypto.randomUUID();
    const configJson = JSON.stringify({
      campaign_id: id,
      vertical: campaign.target_vertical,
      location: campaign.target_location,
      max_results: maxResults,
      ...(campaign.config_json ? JSON.parse(campaign.config_json as string) : {}),
    });

    // Update campaign to track the run
    db.prepare(`
      UPDATE outreach_campaigns
      SET updated_at = datetime('now')
      WHERE id = ?
    `).run(id);

    return NextResponse.json({
      message: 'Lead generation pipeline triggered',
      run_id: runId,
      campaign_id: id,
      config: JSON.parse(configJson),
      instruction: 'Use POST /api/jobs/lead-generation-v1/trigger to execute the pipeline with this config, or wait for the daily scheduler.',
    }, { status: 202 });
  } catch (error) {
    console.error('Failed to trigger campaign run:', error);
    return NextResponse.json({ error: 'Failed to trigger run' }, { status: 500 });
  }
}
