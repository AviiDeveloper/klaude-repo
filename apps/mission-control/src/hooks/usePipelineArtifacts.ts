'use client';

import { useState, useEffect, useCallback } from 'react';

const MC_API = process.env.NEXT_PUBLIC_MC_API_URL || 'http://127.0.0.1:4317';

export interface PipelineArtifact {
  id: string;
  run_id: string;
  node_id: string;
  kind: string;
  value_json: Record<string, unknown>;
  created_at: string;
}

export interface PipelineRun {
  id: string;
  pipeline_definition_id: string;
  status: string;
  trigger: string;
  started_at: string;
  ended_at?: string;
}

export function usePipelineArtifacts(pipelineNodeIds: string[] | undefined) {
  const [artifacts, setArtifacts] = useState<PipelineArtifact[]>([]);
  const [latestRun, setLatestRun] = useState<PipelineRun | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const key = pipelineNodeIds?.join(',') ?? '';

  const refresh = useCallback(async () => {
    if (!pipelineNodeIds || pipelineNodeIds.length === 0) {
      setArtifacts([]);
      setLatestRun(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const runsRes = await fetch(`${MC_API}/api/job-runs`, { signal: AbortSignal.timeout(5000) });
      if (!runsRes.ok) {
        if (runsRes.status === 429) throw new Error('Runtime is rate-limited — wait a moment and retry');
        throw new Error(`Runtime returned ${runsRes.status}`);
      }
      const { runs } = await runsRes.json();

      const sorted = (runs ?? []).sort(
        (a: PipelineRun, b: PipelineRun) =>
          new Date(b.started_at).getTime() - new Date(a.started_at).getTime(),
      );

      // Find latest run that has completed (or is running)
      const latest = sorted.find(
        (r: PipelineRun) => r.status === 'completed' || r.status === 'failed' || r.status === 'running',
      );

      if (!latest) {
        setLatestRun(null);
        setArtifacts([]);
        setLoading(false);
        return;
      }

      const detailRes = await fetch(`${MC_API}/api/job-runs/${latest.id}`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!detailRes.ok) throw new Error(`Failed to fetch run ${latest.id}`);
      const detail = await detailRes.json();

      const allArtifacts: PipelineArtifact[] = detail.artifacts ?? [];
      const matched = allArtifacts.filter((a) => pipelineNodeIds.includes(a.node_id));

      setLatestRun(latest);
      setArtifacts(matched);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('timeout') || msg.includes('fetch')) {
        setError('Pipeline runtime unavailable (port 4317)');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [key]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { artifacts, latestRun, loading, error, refresh };
}
