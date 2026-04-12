'use client';

import { formatDistanceToNow } from 'date-fns';
import { CheckCircle, XCircle, Loader2, Ban, Clock } from 'lucide-react';

interface PipelineRun {
  id: string;
  pipeline_definition_id: string;
  trigger: string;
  status: string;
  started_at: string;
  ended_at?: string;
  error_message?: string;
}

interface Props {
  runs: PipelineRun[];
  selectedRunId: string | null;
  onSelectRun: (runId: string) => void;
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'completed': return <CheckCircle className="w-3.5 h-3.5 text-mc-accent-green" />;
    case 'failed': return <XCircle className="w-3.5 h-3.5 text-mc-accent-red" />;
    case 'running': return <Loader2 className="w-3.5 h-3.5 text-mc-accent animate-spin" />;
    case 'blocked': return <Ban className="w-3.5 h-3.5 text-mc-accent-yellow" />;
    default: return <Clock className="w-3.5 h-3.5 text-mc-text-secondary" />;
  }
}

function formatDuration(startedAt: string, endedAt?: string): string {
  if (!endedAt) return 'running...';
  const sec = Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000);
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${sec % 60}s`;
  return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
}

export function PipelineRunList({ runs, selectedRunId, onSelectRun }: Props) {
  if (runs.length === 0) {
    return (
      <div className="p-4 text-center text-mc-text-secondary text-xs">
        No pipeline runs yet. Click &quot;Run Pipeline&quot; to start.
      </div>
    );
  }

  return (
    <div className="space-y-1 p-2">
      <div className="text-[10px] text-mc-text-secondary uppercase tracking-wider px-2 mb-2">
        Recent Runs ({runs.length})
      </div>
      {runs.map((run) => (
        <button
          key={run.id}
          onClick={() => onSelectRun(run.id)}
          className={`w-full text-left px-3 py-2 rounded text-xs transition-colors ${
            run.id === selectedRunId
              ? 'bg-mc-accent/15 border border-mc-accent/30'
              : 'hover:bg-mc-bg-tertiary border border-transparent'
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <StatusIcon status={run.status} />
            <span className="text-mc-text font-medium truncate flex-1">
              {run.pipeline_definition_id}
            </span>
          </div>
          <div className="flex items-center justify-between text-mc-text-secondary">
            <span>{formatDistanceToNow(new Date(run.started_at), { addSuffix: true })}</span>
            <span className="font-mono">{formatDuration(run.started_at, run.ended_at)}</span>
          </div>
          <div className="text-[10px] text-mc-text-secondary mt-0.5 font-mono truncate">
            {run.id.slice(0, 8)}... ({run.trigger})
          </div>
        </button>
      ))}
    </div>
  );
}
