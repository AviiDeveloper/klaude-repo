'use client';

import { useMemo } from 'react';
import {
  Search, Scan, Palette, Brain, CheckCircle, FileText, Code, Shield, UserCheck,
  Loader2, AlertTriangle, Clock, Ban, Lock, RotateCcw,
} from 'lucide-react';

// ── Types ──

export interface PipelineNode {
  node_id: string;
  agent_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'blocked' | 'awaiting_approval';
  depends_on: string[];
  attempts: number;
  started_at?: string;
  ended_at?: string;
  last_error?: string;
  critic_score?: number;
  reflection_iterations?: number;
}

interface Props {
  nodes: PipelineNode[];
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
}

// ── Agent icon mapping ──

const AGENT_ICONS: Record<string, typeof Search> = {
  'lead-scout-agent': Search,
  'lead-profiler-agent': Scan,
  'brand-analyser-agent': Palette,
  'brand-intelligence-agent': Brain,
  'lead-qualifier-agent': CheckCircle,
  'brief-generator-agent': FileText,
  'site-composer-agent': Code,
  'site-qa-agent': Shield,
  'lead-assigner-agent': UserCheck,
};

const AGENT_LABELS: Record<string, string> = {
  'lead-scout-agent': 'Scout',
  'lead-profiler-agent': 'Profiler',
  'brand-analyser-agent': 'Brand',
  'brand-intelligence-agent': 'Intelligence',
  'lead-qualifier-agent': 'Qualifier',
  'brief-generator-agent': 'Brief',
  'site-composer-agent': 'Composer',
  'site-qa-agent': 'QA',
  'lead-assigner-agent': 'Assigner',
};

const STATUS_COLOURS: Record<string, { bg: string; border: string; text: string; glow?: string }> = {
  pending: { bg: 'bg-mc-bg-tertiary', border: 'border-mc-border', text: 'text-mc-text-secondary' },
  running: { bg: 'bg-mc-accent/10', border: 'border-mc-accent', text: 'text-mc-accent', glow: 'shadow-[0_0_12px_rgba(88,166,255,0.3)]' },
  completed: { bg: 'bg-mc-accent-green/10', border: 'border-mc-accent-green', text: 'text-mc-accent-green' },
  failed: { bg: 'bg-mc-accent-red/10', border: 'border-mc-accent-red', text: 'text-mc-accent-red' },
  blocked: { bg: 'bg-mc-accent-yellow/10', border: 'border-mc-accent-yellow', text: 'text-mc-accent-yellow' },
  awaiting_approval: { bg: 'bg-mc-accent-purple/10', border: 'border-mc-accent-purple', text: 'text-mc-accent-purple' },
};

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'running': return <Loader2 className="w-3.5 h-3.5 animate-spin" />;
    case 'completed': return <CheckCircle className="w-3.5 h-3.5" />;
    case 'failed': return <AlertTriangle className="w-3.5 h-3.5" />;
    case 'blocked': return <Ban className="w-3.5 h-3.5" />;
    case 'awaiting_approval': return <Lock className="w-3.5 h-3.5" />;
    default: return <Clock className="w-3.5 h-3.5" />;
  }
}

function formatDuration(startedAt?: string, endedAt?: string): string {
  if (!startedAt) return '';
  const start = new Date(startedAt).getTime();
  const end = endedAt ? new Date(endedAt).getTime() : Date.now();
  const sec = Math.round((end - start) / 1000);
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}m ${sec % 60}s`;
}

// ── Layout: compute x,y positions for DAG ──

/**
 * Layout pipeline nodes in a strict left-to-right flow.
 * Uses a predefined order matching the pipeline's logical sequence
 * rather than computing depth from dependencies (which breaks for
 * nodes like assigner that depend on many earlier nodes).
 */
function layoutNodes(nodes: PipelineNode[]): Map<string, { x: number; y: number; col: number }> {
  const positions = new Map<string, { x: number; y: number; col: number }>();

  // Define the canonical pipeline order — each group is a column
  const PIPELINE_ORDER: string[][] = [
    ['scout'],
    ['profile'],
    ['brand-analyse'],
    ['brand-intelligence'],
    ['qualify'],
    ['brief'],
    ['compose'],
    ['qa'],
    ['assign'],
  ];

  const NODE_W = 160;
  const NODE_H = 80;
  const GAP_X = 32;
  const GAP_Y = 16;
  const PADDING = 24;

  // Place nodes that match the canonical order
  const placed = new Set<string>();
  for (let col = 0; col < PIPELINE_ORDER.length; col++) {
    const ids = PIPELINE_ORDER[col].filter((id) => nodes.some((n) => n.node_id === id));
    const totalH = ids.length * NODE_H + (ids.length - 1) * GAP_Y;
    const startY = Math.max(PADDING, (300 - totalH) / 2);
    ids.forEach((id, row) => {
      positions.set(id, {
        x: col * (NODE_W + GAP_X) + PADDING,
        y: startY + row * (NODE_H + GAP_Y),
        col,
      });
      placed.add(id);
    });
  }

  // Place any remaining nodes not in the canonical order
  let extraCol = PIPELINE_ORDER.length;
  for (const node of nodes) {
    if (!placed.has(node.node_id)) {
      positions.set(node.node_id, {
        x: extraCol * (NODE_W + GAP_X) + PADDING,
        y: PADDING,
        col: extraCol,
      });
      extraCol++;
    }
  }

  return positions;
}

// ── Component ──

export function PipelineGraph({ nodes, selectedNodeId, onSelectNode }: Props) {
  const positions = useMemo(() => layoutNodes(nodes), [nodes]);

  const NODE_W = 160;
  const NODE_H = 80;

  // Calculate SVG viewport
  const posArr = Array.from(positions.values());
  const maxX = posArr.length > 0 ? Math.max(...posArr.map((p) => p.x)) + NODE_W + 40 : 600;
  const maxY = posArr.length > 0 ? Math.max(...posArr.map((p) => p.y)) + NODE_H + 40 : 300;

  return (
    <div className="w-full h-full overflow-auto bg-mc-bg rounded-lg border border-mc-border">
      <svg
        width={Math.max(maxX, 600)}
        height={Math.max(maxY, 300)}
        className="select-none"
      >
        {/* Edges — only draw to the primary (last) dependency to avoid spaghetti */}
        {nodes.map((node) => {
          // For nodes with multiple deps, only draw from the one directly before in the pipeline
          const primaryDeps = node.depends_on.length <= 1
            ? node.depends_on
            : [node.depends_on[node.depends_on.length - 1]];
          return primaryDeps.map((dep) => {
            const from = positions.get(dep);
            const to = positions.get(node.node_id);
            if (!from || !to) return null;
            const x1 = from.x + NODE_W;
            const y1 = from.y + NODE_H / 2;
            const x2 = to.x;
            const y2 = to.y + NODE_H / 2;
            const midX = (x1 + x2) / 2;

            const depNode = nodes.find((n) => n.node_id === dep);
            const edgeColour =
              depNode?.status === 'completed' ? '#3fb950' :
              depNode?.status === 'running' ? '#58a6ff' :
              depNode?.status === 'failed' ? '#f85149' :
              '#8b949e';

            return (
              <path
                key={`${dep}-${node.node_id}`}
                d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
                fill="none"
                stroke={edgeColour}
                strokeWidth={2.5}
                opacity={0.8}
              />
            );
          });
        })}

        {/* Nodes */}
        {nodes.map((node) => {
          const pos = positions.get(node.node_id);
          if (!pos) return null;
          const colours = STATUS_COLOURS[node.status] ?? STATUS_COLOURS.pending;
          const Icon = AGENT_ICONS[node.agent_id] ?? Search;
          const label = AGENT_LABELS[node.agent_id] ?? node.node_id;
          const isSelected = node.node_id === selectedNodeId;
          const duration = formatDuration(node.started_at, node.ended_at);

          return (
            <foreignObject
              key={node.node_id}
              x={pos.x}
              y={pos.y}
              width={NODE_W}
              height={NODE_H}
              className="cursor-pointer"
              onClick={() => onSelectNode(node.node_id)}
            >
              <div
                className={`
                  h-full rounded-lg border-2 p-2.5 transition-all
                  ${colours.bg} ${colours.border} ${colours.glow ?? ''}
                  ${isSelected ? 'ring-2 ring-mc-accent ring-offset-1 ring-offset-mc-bg' : ''}
                  hover:brightness-110
                `}
              >
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Icon className={`w-4 h-4 ${colours.text}`} />
                  <span className={`text-xs font-bold uppercase tracking-wide ${colours.text}`}>
                    {label}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <StatusIcon status={node.status} />
                    <span className="text-[10px] text-mc-text-secondary capitalize">
                      {node.status.replace('_', ' ')}
                    </span>
                  </div>
                  {duration && (
                    <span className="text-[10px] text-mc-text-secondary font-mono">{duration}</span>
                  )}
                </div>
                {node.critic_score !== undefined && (
                  <div className="mt-1 flex items-center gap-1">
                    <div className="flex-1 h-1 bg-mc-bg-tertiary rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          node.critic_score >= 0.7 ? 'bg-mc-accent-green' :
                          node.critic_score >= 0.4 ? 'bg-mc-accent-yellow' :
                          'bg-mc-accent-red'
                        }`}
                        style={{ width: `${node.critic_score * 100}%` }}
                      />
                    </div>
                    <span className="text-[9px] text-mc-text-secondary font-mono">
                      {(node.critic_score * 100).toFixed(0)}
                    </span>
                  </div>
                )}
              </div>
            </foreignObject>
          );
        })}
      </svg>
    </div>
  );
}
