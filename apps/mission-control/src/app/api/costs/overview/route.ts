import { NextRequest, NextResponse } from 'next/server';
import { getCostOverview } from '@/lib/cost-observability';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const workspaceId = request.nextUrl.searchParams.get('workspace_id')?.trim() || undefined;
    const overview = getCostOverview(workspaceId);
    return NextResponse.json(overview);
  } catch (error) {
    console.error('Failed to load cost overview:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load cost overview' },
      { status: 500 },
    );
  }
}
