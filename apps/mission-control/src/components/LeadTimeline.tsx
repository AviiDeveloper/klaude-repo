'use client';

import { useEffect, useState } from 'react';
import type { LeadDecisionLog } from '@/lib/types';

interface LeadTimelineProps {
  taskId: string;
}

function formatDetails(detailsJson?: string): string[] {
  if (!detailsJson) return [];
  try {
    const parsed = JSON.parse(detailsJson) as Record<string, unknown>;
    return Object.entries(parsed).slice(0, 10).map(([key, value]) => `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`);
  } catch {
    return [detailsJson];
  }
}

export function LeadTimeline({ taskId }: LeadTimelineProps) {
  const [logs, setLogs] = useState<LeadDecisionLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/lead/tasks/${taskId}/decision-log`);
      if (!res.ok) {
        const payload = await res.json().catch(() => ({ error: 'Failed to load lead timeline' }));
        throw new Error(payload.error || 'Failed to load lead timeline');
      }
      const data = (await res.json()) as { logs?: LeadDecisionLog[] };
      setLogs(data.logs || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load lead timeline');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void load();
    const interval = setInterval(() => {
      void load();
    }, 8000);
    return () => clearInterval(interval);
  }, [taskId]);

  if (isLoading && logs.length === 0) {
    return <div className="text-sm text-mc-text-secondary">Loading lead timeline...</div>;
  }
  if (error) {
    return <div className="text-sm text-mc-accent-red">{error}</div>;
  }
  if (logs.length === 0) {
    return <div className="text-sm text-mc-text-secondary">No lead decisions logged yet.</div>;
  }

  return (
    <div className="space-y-2">
      {logs.map((log) => (
        <div key={log.id} className="rounded border border-mc-border bg-mc-bg p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">{log.summary}</p>
            <span className="text-[11px] text-mc-text-secondary">{new Date(log.created_at).toLocaleString()}</span>
          </div>
          <p className="text-xs text-mc-text-secondary mt-1">
            {log.decision_type} • {log.actor_type}
            {log.actor_id ? `:${log.actor_id}` : ''}
          </p>
          {formatDetails(log.details_json).length > 0 ? (
            <div className="mt-2 text-xs text-mc-text-secondary space-y-1">
              {formatDetails(log.details_json).map((line, index) => (
                <p key={`${log.id}-${index}`} className="font-mono break-all">{line}</p>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
