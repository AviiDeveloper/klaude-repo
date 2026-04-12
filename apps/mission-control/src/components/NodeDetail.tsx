'use client';

import { useState } from 'react';
import {
  Clock, Cpu, DollarSign, RotateCcw, SkipForward, ChevronDown, ChevronRight,
  CheckCircle, AlertTriangle, Lightbulb, ShieldAlert, Star,
} from 'lucide-react';
import type { PipelineNode } from './PipelineGraph';

// ── Types ──

interface CriticScore {
  agent_id: string;
  node_id: string;
  iteration: number;
  score: number;
  prediction: string;
  model_version: string;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
}

interface NodeArtifact {
  id: string;
  node_id: string;
  kind: string;
  value_json: Record<string, unknown>;
  created_at: string;
}

interface Props {
  node: PipelineNode;
  artifacts: NodeArtifact[];
  criticScores: CriticScore[];
  onRetry: (nodeId: string) => void;
  onOverride: (nodeId: string, reason: string) => void;
}

function formatDuration(startedAt?: string, endedAt?: string): string {
  if (!startedAt) return 'Not started';
  const start = new Date(startedAt).getTime();
  const end = endedAt ? new Date(endedAt).getTime() : Date.now();
  const sec = Math.round((end - start) / 1000);
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${sec % 60}s`;
  return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
}

function ScoreBar({ score, label }: { score: number; label: string }) {
  const colour = score >= 0.7 ? 'bg-mc-accent-green' : score >= 0.4 ? 'bg-mc-accent-yellow' : 'bg-mc-accent-red';
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-mc-text-secondary w-16">{label}</span>
      <div className="flex-1 h-2 bg-mc-bg-tertiary rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${colour}`} style={{ width: `${score * 100}%` }} />
      </div>
      <span className="text-xs font-mono text-mc-text w-8 text-right">{(score * 100).toFixed(0)}%</span>
    </div>
  );
}

function CollapsibleJSON({ data, label }: { data: unknown; label: string }) {
  const [open, setOpen] = useState(false);
  const json = JSON.stringify(data, null, 2);
  const lines = json.split('\n').length;

  return (
    <div className="border border-mc-border rounded">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-mc-text-secondary hover:bg-mc-bg-tertiary"
      >
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        <span>{label}</span>
        <span className="ml-auto text-mc-text-secondary">{lines} lines</span>
      </button>
      {open && (
        <pre className="px-3 py-2 text-[11px] text-mc-text overflow-auto max-h-64 border-t border-mc-border bg-mc-bg font-mono">
          {json.length > 5000 ? json.slice(0, 5000) + '\n...(truncated)' : json}
        </pre>
      )}
    </div>
  );
}

// ── Component ──

export function NodeDetail({ node, artifacts, criticScores, onRetry, onOverride }: Props) {
  const [overrideReason, setOverrideReason] = useState('');
  const [showOverride, setShowOverride] = useState(false);

  const nodeScores = criticScores.filter((s) => s.node_id === node.node_id);
  const nodeArtifacts = artifacts.filter((a) => a.node_id === node.node_id);
  const bestScore = nodeScores.length > 0 ? Math.max(...nodeScores.map((s) => s.score)) : undefined;

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      {/* Header */}
      <div>
        <h3 className="text-lg font-bold text-mc-text">{node.node_id}</h3>
        <p className="text-xs text-mc-text-secondary font-mono">{node.agent_id}</p>
      </div>

      {/* Status + Timing */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-mc-bg-tertiary rounded p-2.5">
          <div className="text-[10px] text-mc-text-secondary uppercase mb-1">Status</div>
          <div className={`text-sm font-bold capitalize ${
            node.status === 'completed' ? 'text-mc-accent-green' :
            node.status === 'failed' ? 'text-mc-accent-red' :
            node.status === 'running' ? 'text-mc-accent' :
            'text-mc-text-secondary'
          }`}>
            {node.status.replace('_', ' ')}
          </div>
        </div>
        <div className="bg-mc-bg-tertiary rounded p-2.5">
          <div className="text-[10px] text-mc-text-secondary uppercase mb-1">Duration</div>
          <div className="text-sm font-mono text-mc-text">
            {formatDuration(node.started_at, node.ended_at)}
          </div>
        </div>
        <div className="bg-mc-bg-tertiary rounded p-2.5">
          <div className="text-[10px] text-mc-text-secondary uppercase mb-1">Attempts</div>
          <div className="text-sm font-mono text-mc-text">{node.attempts}</div>
        </div>
        {bestScore !== undefined && (
          <div className="bg-mc-bg-tertiary rounded p-2.5">
            <div className="text-[10px] text-mc-text-secondary uppercase mb-1">Critic Score</div>
            <div className={`text-sm font-bold ${
              bestScore >= 0.7 ? 'text-mc-accent-green' :
              bestScore >= 0.4 ? 'text-mc-accent-yellow' :
              'text-mc-accent-red'
            }`}>
              {(bestScore * 100).toFixed(0)}%
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {node.last_error && (
        <div className="bg-mc-accent-red/10 border border-mc-accent-red/30 rounded p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <AlertTriangle className="w-3.5 h-3.5 text-mc-accent-red" />
            <span className="text-xs font-bold text-mc-accent-red uppercase">Error</span>
          </div>
          <p className="text-xs text-mc-text font-mono">{node.last_error.slice(0, 300)}</p>
        </div>
      )}

      {/* Critic Evaluations */}
      {nodeScores.length > 0 && (
        <div>
          <h4 className="text-xs font-bold text-mc-text-secondary uppercase mb-2 flex items-center gap-1.5">
            <Star className="w-3.5 h-3.5" /> Critic Evaluations ({nodeScores.length})
          </h4>
          <div className="space-y-3">
            {nodeScores.map((score) => (
              <div key={`${score.node_id}-${score.iteration}`} className="bg-mc-bg-tertiary rounded p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-mc-text-secondary">Iteration {score.iteration}</span>
                  <span className={`text-xs font-bold ${
                    score.prediction === 'likely_close' ? 'text-mc-accent-green' :
                    score.prediction === 'unlikely_close' ? 'text-mc-accent-red' :
                    'text-mc-accent-yellow'
                  }`}>
                    {score.prediction.replace('_', ' ')}
                  </span>
                </div>
                <ScoreBar score={score.score} label="Score" />
                {score.strengths.length > 0 && (
                  <div>
                    <div className="text-[10px] text-mc-accent-green uppercase mb-1 flex items-center gap-1">
                      <CheckCircle className="w-2.5 h-2.5" /> Strengths
                    </div>
                    {score.strengths.map((s, i) => (
                      <p key={i} className="text-[11px] text-mc-text ml-3.5">- {s}</p>
                    ))}
                  </div>
                )}
                {score.weaknesses.length > 0 && (
                  <div>
                    <div className="text-[10px] text-mc-accent-red uppercase mb-1 flex items-center gap-1">
                      <ShieldAlert className="w-2.5 h-2.5" /> Weaknesses
                    </div>
                    {score.weaknesses.map((w, i) => (
                      <p key={i} className="text-[11px] text-mc-text ml-3.5">- {w}</p>
                    ))}
                  </div>
                )}
                {score.suggestions.length > 0 && (
                  <div>
                    <div className="text-[10px] text-mc-accent-yellow uppercase mb-1 flex items-center gap-1">
                      <Lightbulb className="w-2.5 h-2.5" /> Suggestions
                    </div>
                    {score.suggestions.map((s, i) => (
                      <p key={i} className="text-[11px] text-mc-text ml-3.5">- {s}</p>
                    ))}
                  </div>
                )}
                <div className="text-[9px] text-mc-text-secondary font-mono">{score.model_version}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Artifacts */}
      {nodeArtifacts.length > 0 && (
        <div>
          <h4 className="text-xs font-bold text-mc-text-secondary uppercase mb-2">
            Artifacts ({nodeArtifacts.length})
          </h4>
          <div className="space-y-2">
            {nodeArtifacts.map((a) => (
              <CollapsibleJSON key={a.id} data={a.value_json} label={`${a.kind} — ${a.created_at}`} />
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      {(node.status === 'failed' || node.status === 'blocked' || node.status === 'awaiting_approval') && (
        <div className="border-t border-mc-border pt-3 space-y-2">
          <button
            onClick={() => onRetry(node.node_id)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-mc-accent/20 border border-mc-accent text-mc-accent rounded hover:bg-mc-accent/30 text-sm font-medium"
          >
            <RotateCcw className="w-4 h-4" /> Retry Node
          </button>

          {!showOverride ? (
            <button
              onClick={() => setShowOverride(true)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-mc-accent-yellow/10 border border-mc-accent-yellow/30 text-mc-accent-yellow rounded hover:bg-mc-accent-yellow/20 text-sm"
            >
              <SkipForward className="w-4 h-4" /> Override / Skip
            </button>
          ) : (
            <div className="space-y-2">
              <input
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Reason for override..."
                className="w-full px-3 py-2 bg-mc-bg border border-mc-border rounded text-sm text-mc-text placeholder-mc-text-secondary"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => { onOverride(node.node_id, overrideReason || 'Manual override'); setShowOverride(false); }}
                  className="flex-1 px-3 py-1.5 bg-mc-accent-yellow/20 border border-mc-accent-yellow text-mc-accent-yellow rounded text-xs font-medium"
                >
                  Confirm Override
                </button>
                <button
                  onClick={() => setShowOverride(false)}
                  className="px-3 py-1.5 border border-mc-border text-mc-text-secondary rounded text-xs"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
