'use client';

import { useState, useMemo } from 'react';
import {
  CheckCircle, AlertTriangle, XCircle,
  ChevronDown, ChevronRight, FileCode, Link2, AlertCircle,
} from 'lucide-react';
import type { FlowchartDefinition, FlowchartNode, NodeStatus, NodeType } from '@/lib/flowchart-data';
import { LAYOUTS, type FlowchartLayout, type LayoutEdge, type NodePosition } from '@/lib/flowchart-layout';

// ── Constants ──

const NODE_W = 180;
const NODE_H = 52;
const DIAMOND_SIZE = 90;

const STATUS_COLORS: Record<NodeStatus, { stroke: string; fill: string }> = {
  built:     { stroke: '#3fb950', fill: 'rgba(63,185,80,0.12)' },
  partial:   { stroke: '#d29922', fill: 'rgba(210,153,34,0.12)' },
  not_built: { stroke: '#f85149', fill: 'rgba(248,81,73,0.08)' },
};

const TYPE_COLORS: Record<NodeType, string> = {
  human: '#58a6ff', agent: '#a371f7', system: '#8b949e',
  decision: '#d29922', action: '#39d353', external: '#db61a2',
};

// ── SVG port computation ──

function getPort(pos: NodePosition, side: string, isDiamond: boolean): { x: number; y: number } {
  if (isDiamond) {
    const h = DIAMOND_SIZE / 2;
    switch (side) {
      case 'top':    return { x: pos.x, y: pos.y - h };
      case 'bottom': return { x: pos.x, y: pos.y + h };
      case 'left':   return { x: pos.x - h, y: pos.y };
      case 'right':  return { x: pos.x + h, y: pos.y };
    }
  }
  switch (side) {
    case 'top':    return { x: pos.x, y: pos.y - NODE_H / 2 };
    case 'bottom': return { x: pos.x, y: pos.y + NODE_H / 2 };
    case 'left':   return { x: pos.x - NODE_W / 2, y: pos.y };
    case 'right':  return { x: pos.x + NODE_W / 2, y: pos.y };
  }
  return pos;
}

function autoSide(from: NodePosition, to: NodePosition, isOut: boolean): string {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dy) >= Math.abs(dx) * 0.5) {
    return isOut ? (dy > 0 ? 'bottom' : 'top') : (dy > 0 ? 'top' : 'bottom');
  }
  return isOut ? (dx > 0 ? 'right' : 'left') : (dx > 0 ? 'left' : 'right');
}

function buildPath(
  start: { x: number; y: number },
  end: { x: number; y: number },
  waypoints?: Array<{ x: number; y: number }>,
): string {
  if (waypoints && waypoints.length > 0) {
    let d = `M ${start.x},${start.y}`;
    for (const wp of waypoints) d += ` L ${wp.x},${wp.y}`;
    d += ` L ${end.x},${end.y}`;
    return d;
  }
  if (Math.abs(end.y - start.y) >= Math.abs(end.x - start.x)) {
    const midY = (start.y + end.y) / 2;
    return `M ${start.x},${start.y} C ${start.x},${midY} ${end.x},${midY} ${end.x},${end.y}`;
  }
  const midX = (start.x + end.x) / 2;
  return `M ${start.x},${start.y} C ${midX},${start.y} ${midX},${end.y} ${end.x},${end.y}`;
}

// ── Edge component ──

function FlowEdge({
  edge, layout, nodeMap,
}: {
  edge: LayoutEdge;
  layout: FlowchartLayout;
  nodeMap: Map<string, FlowchartNode>;
}) {
  const fromPos = layout.positions[edge.from];
  const toPos = layout.positions[edge.to];
  const fromNode = nodeMap.get(edge.from);
  const toNode = nodeMap.get(edge.to);
  if (!fromPos || !toPos || !fromNode || !toNode) return null;

  const fSide = edge.fromSide || autoSide(fromPos, toPos, true);
  const tSide = edge.toSide || autoSide(fromPos, toPos, false);
  const start = getPort(fromPos, fSide, fromNode.type === 'decision');
  const end = getPort(toPos, tSide, toNode.type === 'decision');
  const d = buildPath(start, end, edge.waypoints);

  // Label
  let lx = 0, ly = 0;
  if (edge.label) {
    if (edge.waypoints && edge.waypoints.length > 0) {
      const wp = edge.waypoints[0];
      lx = (start.x + wp.x) / 2;
      ly = (start.y + wp.y) / 2;
    } else {
      lx = (start.x + end.x) / 2;
      ly = (start.y + end.y) / 2;
    }
  }

  const lines = edge.label?.split('\n') ?? [];
  const maxLen = Math.max(1, ...lines.map((l) => l.length));
  const labelW = maxLen * 5.6 + 14;
  const labelH = lines.length * 13 + 6;

  return (
    <g>
      <path
        d={d}
        fill="none"
        stroke="#484f58"
        strokeWidth={1.5}
        strokeDasharray={edge.dashed ? '6 3' : undefined}
        markerEnd="url(#fc-arrow)"
      />
      {edge.label && (
        <g>
          <rect
            x={lx - labelW / 2}
            y={ly - labelH / 2}
            width={labelW}
            height={labelH}
            rx={3}
            fill="#0d1117"
            stroke="#30363d"
            strokeWidth={0.5}
          />
          <text
            textAnchor="middle"
            fill="#8b949e"
            fontSize={9}
            fontFamily="'JetBrains Mono', monospace"
          >
            {lines.map((line, i) => (
              <tspan
                key={i}
                x={lx}
                y={ly - ((lines.length - 1) * 6.5) + i * 13 + 3}
              >
                {line}
              </tspan>
            ))}
          </text>
        </g>
      )}
    </g>
  );
}

// ── Node component ──

function FlowNode({
  node, pos, isSelected, onClick,
}: {
  node: FlowchartNode;
  pos: NodePosition;
  isSelected: boolean;
  onClick: () => void;
}) {
  const sc = STATUS_COLORS[node.status];
  const tc = TYPE_COLORS[node.type];
  const lines = node.label.split('\n');
  const stroke = isSelected ? '#58a6ff' : sc.stroke;
  const sw = isSelected ? 2.5 : 1.5;

  if (node.type === 'decision') {
    const h = DIAMOND_SIZE / 2;
    const lh = 12;
    const sy = pos.y - ((lines.length - 1) * lh) / 2;
    return (
      <g onClick={onClick} className="fc-node">
        <polygon
          points={`${pos.x},${pos.y - h} ${pos.x + h},${pos.y} ${pos.x},${pos.y + h} ${pos.x - h},${pos.y}`}
          fill={sc.fill}
          stroke={stroke}
          strokeWidth={sw}
        />
        <text
          textAnchor="middle"
          fill="#c9d1d9"
          fontSize={9}
          fontWeight="bold"
          fontFamily="'JetBrains Mono', monospace"
        >
          {lines.map((line, i) => (
            <tspan key={i} x={pos.x} y={sy + i * lh}>
              {line.length > 18 ? line.slice(0, 16) + '…' : line}
            </tspan>
          ))}
        </text>
      </g>
    );
  }

  const lh = 13;
  const sy = pos.y - ((lines.length - 1) * lh) / 2;

  return (
    <g onClick={onClick} className="fc-node">
      {/* Background rect */}
      <rect
        x={pos.x - NODE_W / 2}
        y={pos.y - NODE_H / 2}
        width={NODE_W}
        height={NODE_H}
        rx={6}
        fill={sc.fill}
        stroke={stroke}
        strokeWidth={sw}
      />
      {/* Type indicator bar (left edge) */}
      <rect
        x={pos.x - NODE_W / 2}
        y={pos.y - NODE_H / 2 + 3}
        width={3}
        height={NODE_H - 6}
        rx={1.5}
        fill={tc}
        opacity={0.7}
      />
      {/* Status dot (top-right) */}
      <circle
        cx={pos.x + NODE_W / 2 - 12}
        cy={pos.y - NODE_H / 2 + 10}
        r={3.5}
        fill={sc.stroke}
      />
      {/* Label */}
      <text
        textAnchor="middle"
        fill="#c9d1d9"
        fontSize={10}
        fontWeight="600"
        fontFamily="'JetBrains Mono', monospace"
      >
        {lines.map((line, i) => (
          <tspan key={i} x={pos.x + 2} y={sy + i * lh}>
            {line.length > 22 ? line.slice(0, 20) + '…' : line}
          </tspan>
        ))}
      </text>
    </g>
  );
}

// ── Progress bar ──

function ProgressBar({ nodes }: { nodes: FlowchartNode[] }) {
  const built = nodes.filter((n) => n.status === 'built').length;
  const partial = nodes.filter((n) => n.status === 'partial').length;
  const total = nodes.length;
  const pctBuilt = (built / total) * 100;
  const pctPartial = (partial / total) * 100;

  return (
    <div className="px-4 py-2 border-b border-mc-border bg-mc-bg-secondary flex items-center gap-4">
      <div className="flex-1 h-2 bg-mc-bg-tertiary rounded-full overflow-hidden flex">
        <div className="h-full bg-mc-accent-green transition-all" style={{ width: `${pctBuilt}%` }} />
        <div className="h-full bg-mc-accent-yellow transition-all" style={{ width: `${pctPartial}%` }} />
      </div>
      <div className="flex items-center gap-3 text-[10px] text-mc-text-secondary">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-mc-accent-green" /> {built} built
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-mc-accent-yellow" /> {partial} partial
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-mc-accent-red" /> {total - built - partial} needed
        </span>
      </div>
    </div>
  );
}

// ── Type legend ──

const TYPE_LABELS: Array<{ type: NodeType; label: string }> = [
  { type: 'human', label: 'Human' },
  { type: 'agent', label: 'Agent' },
  { type: 'system', label: 'System' },
  { type: 'decision', label: 'Decision' },
  { type: 'action', label: 'Action' },
  { type: 'external', label: 'External' },
];

function TypeLegend() {
  return (
    <div className="px-4 py-1.5 border-b border-mc-border bg-mc-bg flex items-center gap-4">
      <span className="text-[9px] text-mc-text-secondary uppercase tracking-wider font-bold">Types:</span>
      {TYPE_LABELS.map(({ type, label }) => (
        <span key={type} className="flex items-center gap-1 text-[9px] text-mc-text-secondary">
          <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: TYPE_COLORS[type], opacity: 0.7 }} />
          {label}
        </span>
      ))}
    </div>
  );
}

// ── Detail panel ──

const STATUS_CFG: Record<
  NodeStatus,
  { bg: string; border: string; text: string; label: string; Icon: typeof CheckCircle }
> = {
  built: {
    bg: 'bg-mc-accent-green/10', border: 'border-mc-accent-green/40',
    text: 'text-mc-accent-green', label: 'BUILT', Icon: CheckCircle,
  },
  partial: {
    bg: 'bg-mc-accent-yellow/10', border: 'border-mc-accent-yellow/40',
    text: 'text-mc-accent-yellow', label: 'PARTIAL', Icon: AlertTriangle,
  },
  not_built: {
    bg: 'bg-mc-accent-red/10', border: 'border-mc-accent-red/30',
    text: 'text-mc-accent-red', label: 'NOT BUILT', Icon: XCircle,
  },
};

function NodeDetailPanel({ node }: { node: FlowchartNode }) {
  const [showFiles, setShowFiles] = useState(true);
  const [showEndpoints, setShowEndpoints] = useState(true);
  const st = STATUS_CFG[node.status];

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded ${st.bg} ${st.text} border ${st.border}`}>
            {st.label}
          </span>
          <span className="text-[10px] text-mc-text-secondary uppercase">{node.type}</span>
        </div>
        <h3 className="text-lg font-bold text-mc-text">{node.label}</h3>
        <p className="text-xs text-mc-text-secondary mt-1 leading-relaxed">{node.description}</p>
      </div>

      {/* Files */}
      {node.files.length > 0 && (
        <div>
          <button
            onClick={() => setShowFiles(!showFiles)}
            className="flex items-center gap-1.5 text-xs font-bold text-mc-text-secondary uppercase mb-2 hover:text-mc-text"
          >
            {showFiles ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            <FileCode className="w-3.5 h-3.5" />
            Files ({node.files.length})
          </button>
          {showFiles && (
            <div className="space-y-1">
              {node.files.map((f) => (
                <div key={f} className="px-2 py-1.5 bg-mc-bg rounded text-[11px] font-mono text-mc-accent break-all">
                  {f}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Endpoints */}
      {node.endpoints.length > 0 && (
        <div>
          <button
            onClick={() => setShowEndpoints(!showEndpoints)}
            className="flex items-center gap-1.5 text-xs font-bold text-mc-text-secondary uppercase mb-2 hover:text-mc-text"
          >
            {showEndpoints ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            <Link2 className="w-3.5 h-3.5" />
            Endpoints ({node.endpoints.length})
          </button>
          {showEndpoints && (
            <div className="space-y-1">
              {node.endpoints.map((e) => (
                <div key={e} className="px-2 py-1.5 bg-mc-bg rounded text-[11px] font-mono text-mc-accent-purple">
                  {e}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Done */}
      {node.done.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-mc-accent-green uppercase mb-2">
            <CheckCircle className="w-3.5 h-3.5" />
            Done ({node.done.length})
          </div>
          {node.done.map((d) => (
            <p key={d} className="text-[11px] text-mc-text ml-5 mb-1">- {d}</p>
          ))}
        </div>
      )}

      {/* Todo */}
      {node.todo.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-mc-accent-red uppercase mb-2">
            <AlertCircle className="w-3.5 h-3.5" />
            Still needed ({node.todo.length})
          </div>
          {node.todo.map((t) => (
            <p key={t} className="text-[11px] text-mc-text ml-5 mb-1">- {t}</p>
          ))}
        </div>
      )}

      {/* Dependencies */}
      {node.depends_on.length > 0 && (
        <div className="text-[10px] text-mc-text-secondary border-t border-mc-border pt-2">
          Depends on: {node.depends_on.join(', ')}
        </div>
      )}
    </div>
  );
}

// ── Main component ──

export function InteractiveFlowchart({ flowchart }: { flowchart: FlowchartDefinition }) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const selectedNode = flowchart.nodes.find((n) => n.id === selectedNodeId) ?? null;
  const layout = LAYOUTS[flowchart.id];
  const nodeMap = useMemo(() => new Map(flowchart.nodes.map((n) => [n.id, n])), [flowchart.nodes]);

  if (!layout) {
    return <div className="p-8 text-mc-text-secondary">No layout defined for {flowchart.id}</div>;
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <ProgressBar nodes={flowchart.nodes} />
      <TypeLegend />

      <div className="flex-1 flex overflow-hidden">
        {/* SVG flowchart canvas */}
        <div className="flex-1 overflow-auto" style={{ background: '#0d1117' }}>
          <svg
            width={layout.canvasWidth}
            height={layout.canvasHeight}
            viewBox={`0 0 ${layout.canvasWidth} ${layout.canvasHeight}`}
            className="mx-auto block"
            style={{ minWidth: layout.canvasWidth, minHeight: layout.canvasHeight }}
          >
            <style>{`
              .fc-node { cursor: pointer; transition: filter 0.15s ease; }
              .fc-node:hover { filter: brightness(1.4); }
            `}</style>
            <defs>
              <marker
                id="fc-arrow"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto"
              >
                <path d="M 0 1 L 8 5 L 0 9 z" fill="#484f58" />
              </marker>
            </defs>

            {/* Edges (behind nodes) */}
            {layout.edges.map((edge, i) => (
              <FlowEdge key={`e-${i}`} edge={edge} layout={layout} nodeMap={nodeMap} />
            ))}

            {/* Nodes */}
            {flowchart.nodes.map((node) => {
              const pos = layout.positions[node.id];
              if (!pos) return null;
              return (
                <FlowNode
                  key={node.id}
                  node={node}
                  pos={pos}
                  isSelected={node.id === selectedNodeId}
                  onClick={() =>
                    setSelectedNodeId(node.id === selectedNodeId ? null : node.id)
                  }
                />
              );
            })}
          </svg>
        </div>

        {/* Detail panel */}
        <div className="w-96 border-l border-mc-border bg-mc-bg-secondary overflow-hidden flex-shrink-0">
          {selectedNode ? (
            <NodeDetailPanel node={selectedNode} />
          ) : (
            <div className="h-full flex items-center justify-center text-mc-text-secondary p-4">
              <p className="text-xs text-center">
                Click a step to see files, endpoints, and build status
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
