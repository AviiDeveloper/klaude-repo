'use client';

import Sidebar from '@/components/Sidebar';
import { ArrowRight, CheckCircle2, Clock, AlertCircle, Pause, Play, RotateCcw, Zap } from 'lucide-react';

const PIPELINE_NODES = [
  { id: 'scout', label: 'Scout', desc: 'Find businesses', status: 'idle' as const },
  { id: 'profile', label: 'Profile', desc: 'Scrape data', status: 'idle' as const },
  { id: 'brand', label: 'Brand', desc: 'Extract identity', status: 'idle' as const },
  { id: 'qualify', label: 'Qualify', desc: 'Score leads', status: 'idle' as const },
  { id: 'assign', label: 'Assign', desc: 'Route to team', status: 'ready' as const },
  { id: 'brief', label: 'Brief', desc: 'Copy directives', status: 'idle' as const },
  { id: 'compose', label: 'Compose', desc: 'AI site gen', status: 'blocked' as const },
  { id: 'qa', label: 'QA', desc: 'Validate output', status: 'idle' as const },
];

const AGENTS = [
  { name: 'Lead Scout', status: 'idle', lastRun: '—', processed: 0, avgTime: '—' },
  { name: 'Lead Profiler', status: 'idle', lastRun: '—', processed: 0, avgTime: '—', note: 'Playwright + multi-source' },
  { name: 'Brand Analyser', status: 'idle', lastRun: '—', processed: 0, avgTime: '—' },
  { name: 'Lead Qualifier', status: 'idle', lastRun: '—', processed: 0, avgTime: '—' },
  { name: 'Auto-Assigner', status: 'ready', lastRun: '—', processed: 5, avgTime: '—', note: 'Seeded data' },
  { name: 'Brief Generator', status: 'idle', lastRun: '—', processed: 0, avgTime: '—', note: '15+ business types' },
  { name: 'AI Composer', status: 'blocked', lastRun: '—', processed: 0, avgTime: '—', note: 'Awaiting API credits' },
  { name: 'Site QA', status: 'idle', lastRun: '—', processed: 0, avgTime: '—' },
];

type NodeStatus = 'idle' | 'running' | 'ready' | 'blocked' | 'error';

export default function PipelinePage() {
  return (
    <div className="flex min-h-screen bg-white">
      <Sidebar />
      <main className="flex-1 border-l border-slate-100">
        {/* Header */}
        <div className="px-8 py-5 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-[15px] font-semibold text-slate-900">Pipeline</h1>
              <p className="text-[11px] text-slate-400 mt-0.5">Agent orchestration and execution monitor</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-medium text-amber-600 bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-full">
                Paused — awaiting API credits
              </span>
            </div>
          </div>
        </div>

        <div className="px-8 py-6 space-y-8">
          {/* DAG Visualization */}
          <div>
            <h2 className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.08em] mb-4">Execution Graph</h2>
            <div className="bg-slate-950 rounded-xl p-6 overflow-x-auto">
              <div className="flex items-center gap-2 min-w-max">
                {PIPELINE_NODES.map((node, i) => (
                  <div key={node.id} className="flex items-center">
                    <NodeBox node={node} />
                    {i < PIPELINE_NODES.length - 1 && (
                      <div className="flex items-center mx-1">
                        <div className="w-6 h-px bg-slate-700" />
                        <ArrowRight className="w-3 h-3 text-slate-600 -ml-1" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Agent Table */}
          <div>
            <h2 className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.08em] mb-4">Agent Status</h2>
            <div className="border border-slate-100 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="text-left px-5 py-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Agent</th>
                    <th className="text-center px-4 py-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                    <th className="text-right px-4 py-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Processed</th>
                    <th className="text-right px-4 py-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Avg Time</th>
                    <th className="text-right px-5 py-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Last Run</th>
                  </tr>
                </thead>
                <tbody>
                  {AGENTS.map((agent) => (
                    <tr key={agent.name} className="border-t border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <StatusDot status={agent.status as NodeStatus} />
                          <div>
                            <div className="text-[13px] font-medium text-slate-900">{agent.name}</div>
                            {agent.note && <div className="text-[10px] text-slate-400 mt-0.5">{agent.note}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge status={agent.status as NodeStatus} />
                      </td>
                      <td className="px-4 py-3 text-[12px] text-right text-slate-600 tabular-nums font-medium">{agent.processed}</td>
                      <td className="px-4 py-3 text-[12px] text-right text-slate-400 tabular-nums">{agent.avgTime}</td>
                      <td className="px-5 py-3 text-[11px] text-right text-slate-400">{agent.lastRun}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Controls */}
          <div>
            <h2 className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.08em] mb-2">Emergency Controls</h2>
            <p className="text-[11px] text-slate-400 mb-4">Override the autonomous system. Use only when intervention is needed.</p>
            <div className="flex gap-3">
              <ControlButton icon={Pause} label="Pause Assignment" />
              <ControlButton icon={Play} label="Trigger Run" />
              <ControlButton icon={RotateCcw} label="Retry Failed" />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function NodeBox({ node }: { node: typeof PIPELINE_NODES[0] }) {
  const colors = {
    idle: 'border-slate-700 bg-slate-900',
    running: 'border-emerald-500 bg-emerald-500/10',
    ready: 'border-emerald-600 bg-emerald-500/10',
    blocked: 'border-amber-500 bg-amber-500/10',
    error: 'border-red-500 bg-red-500/10',
  }[node.status];

  const dotColor = {
    idle: 'bg-slate-600',
    running: 'bg-emerald-400 animate-pulse',
    ready: 'bg-emerald-400',
    blocked: 'bg-amber-400',
    error: 'bg-red-400',
  }[node.status];

  return (
    <div className={`rounded-lg border px-4 py-3 min-w-[100px] ${colors}`}>
      <div className="flex items-center gap-2 mb-1">
        <div className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
        <span className="text-[11px] font-semibold text-white">{node.label}</span>
      </div>
      <span className="text-[9px] text-slate-500">{node.desc}</span>
    </div>
  );
}

function StatusDot({ status }: { status: NodeStatus }) {
  const color = {
    idle: 'bg-slate-300',
    running: 'bg-emerald-500 animate-pulse',
    ready: 'bg-emerald-500',
    blocked: 'bg-amber-400',
    error: 'bg-red-500',
  }[status];
  return <div className={`w-2 h-2 rounded-full ${color}`} />;
}

function StatusBadge({ status }: { status: NodeStatus }) {
  const styles = {
    idle: 'text-slate-400 bg-slate-50',
    running: 'text-emerald-700 bg-emerald-50',
    ready: 'text-emerald-700 bg-emerald-50',
    blocked: 'text-amber-700 bg-amber-50',
    error: 'text-red-700 bg-red-50',
  }[status];
  return <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${styles}`}>{status}</span>;
}

function ControlButton({ icon: Icon, label }: { icon: typeof Pause; label: string }) {
  return (
    <button className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 text-[12px] font-medium text-slate-500 hover:text-slate-700 hover:border-slate-300 hover:bg-slate-50 transition-all">
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}
