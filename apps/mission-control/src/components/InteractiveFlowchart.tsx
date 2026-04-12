'use client';

import { useState } from 'react';
import {
  CheckCircle, AlertTriangle, XCircle, User, Bot, Diamond, Server,
  Globe, ChevronDown, ChevronRight, FileCode, Link2, ListChecks, AlertCircle,
} from 'lucide-react';
import type { FlowchartDefinition, FlowchartNode, NodeStatus, NodeType } from '@/lib/flowchart-data';

// ── Status styling ──

const STATUS_CONFIG: Record<NodeStatus, { bg: string; border: string; text: string; label: string; icon: typeof CheckCircle }> = {
  built: { bg: 'bg-mc-accent-green/10', border: 'border-mc-accent-green/40', text: 'text-mc-accent-green', label: 'BUILT', icon: CheckCircle },
  partial: { bg: 'bg-mc-accent-yellow/10', border: 'border-mc-accent-yellow/40', text: 'text-mc-accent-yellow', label: 'PARTIAL', icon: AlertTriangle },
  not_built: { bg: 'bg-mc-accent-red/10', border: 'border-mc-accent-red/30', text: 'text-mc-accent-red', label: 'NOT BUILT', icon: XCircle },
};

const TYPE_ICONS: Record<NodeType, typeof User> = {
  human: User,
  agent: Bot,
  decision: Diamond,
  system: Server,
  action: ListChecks,
  external: Globe,
};

// ── Node card ──

function NodeCard({ node, isSelected, onClick }: { node: FlowchartNode; isSelected: boolean; onClick: () => void }) {
  const status = STATUS_CONFIG[node.status];
  const TypeIcon = TYPE_ICONS[node.type];
  const StatusIcon = status.icon;

  return (
    <button
      onClick={onClick}
      className={`
        w-full text-left rounded-lg border-2 p-3 transition-all
        ${status.bg} ${status.border}
        ${isSelected ? 'ring-2 ring-mc-accent ring-offset-1 ring-offset-mc-bg' : ''}
        hover:brightness-125
      `}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <TypeIcon className={`w-4 h-4 flex-shrink-0 ${status.text}`} />
          <span className="text-sm font-bold text-mc-text truncate">{node.label}</span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <StatusIcon className={`w-3.5 h-3.5 ${status.text}`} />
          <span className={`text-[9px] font-bold uppercase ${status.text}`}>{status.label}</span>
        </div>
      </div>
      <p className="text-[11px] text-mc-text-secondary mt-1.5 line-clamp-2">{node.description}</p>
    </button>
  );
}

// ── Detail panel ──

function NodeDetailPanel({ node }: { node: FlowchartNode }) {
  const [showFiles, setShowFiles] = useState(true);
  const [showEndpoints, setShowEndpoints] = useState(true);
  const status = STATUS_CONFIG[node.status];

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded ${status.bg} ${status.text} border ${status.border}`}>
            {status.label}
          </span>
          <span className="text-[10px] text-mc-text-secondary uppercase">{node.type}</span>
        </div>
        <h3 className="text-lg font-bold text-mc-text">{node.label}</h3>
        <p className="text-xs text-mc-text-secondary mt-1 leading-relaxed">{node.description}</p>
      </div>

      {/* Files */}
      {node.files.length > 0 && (
        <div>
          <button onClick={() => setShowFiles(!showFiles)} className="flex items-center gap-1.5 text-xs font-bold text-mc-text-secondary uppercase mb-2 hover:text-mc-text">
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
          <button onClick={() => setShowEndpoints(!showEndpoints)} className="flex items-center gap-1.5 text-xs font-bold text-mc-text-secondary uppercase mb-2 hover:text-mc-text">
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
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-mc-accent-green" /> {built} built</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-mc-accent-yellow" /> {partial} partial</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-mc-accent-red" /> {total - built - partial} needed</span>
      </div>
    </div>
  );
}

// ── Main component ──

export function InteractiveFlowchart({ flowchart }: { flowchart: FlowchartDefinition }) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const selectedNode = flowchart.nodes.find((n) => n.id === selectedNodeId) ?? null;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <ProgressBar nodes={flowchart.nodes} />

      <div className="flex-1 flex overflow-hidden">
        {/* Node list */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="max-w-3xl mx-auto space-y-2">
            {flowchart.nodes.map((node, i) => (
              <div key={node.id}>
                {/* Connector line */}
                {i > 0 && node.depends_on.length > 0 && (
                  <div className="flex justify-center py-1">
                    <div className="w-0.5 h-4 bg-mc-border" />
                  </div>
                )}
                <NodeCard
                  node={node}
                  isSelected={node.id === selectedNodeId}
                  onClick={() => setSelectedNodeId(node.id === selectedNodeId ? null : node.id)}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Detail panel */}
        <div className="w-96 border-l border-mc-border bg-mc-bg-secondary overflow-hidden">
          {selectedNode ? (
            <NodeDetailPanel node={selectedNode} />
          ) : (
            <div className="h-full flex items-center justify-center text-mc-text-secondary p-4">
              <p className="text-xs text-center">Click a step to see files, endpoints, and build status</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
