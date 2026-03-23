'use client';

import Sidebar from '@/components/Sidebar';
import { Cpu, ArrowRight, CheckCircle2, Clock, AlertCircle, Pause, Play } from 'lucide-react';

const PIPELINE_NODES = [
  { id: 'scout', label: 'Scout', desc: 'Find businesses without websites' },
  { id: 'profile', label: 'Profile', desc: 'Scrape business data (Google, social, website)' },
  { id: 'brand', label: 'Brand', desc: 'Extract colours, fonts, logo, photos' },
  { id: 'qualify', label: 'Qualify', desc: 'Score and filter viable leads' },
  { id: 'assign', label: 'Assign', desc: 'Auto-assign to nearest salesperson' },
  { id: 'brief', label: 'Brief', desc: 'Generate copy directives per business type' },
  { id: 'compose', label: 'Compose', desc: 'AI-generate unique website (Claude)' },
  { id: 'qa', label: 'QA', desc: 'Validate HTML, accessibility, brand consistency' },
];

export default function PipelinePage() {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-base font-semibold text-primary">Pipeline</h1>
            <p className="text-xs text-muted mt-0.5">Agent execution and DAG overview</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted bg-amber-50 text-amber-700 px-2 py-1 rounded font-medium">
              Paused — no API credits
            </span>
          </div>
        </div>

        {/* Pipeline DAG visualisation */}
        <div className="bg-white rounded-lg border border-slate-200 p-5 mb-4">
          <h2 className="text-xs font-semibold text-primary uppercase tracking-wider mb-4">Pipeline DAG</h2>
          <div className="flex items-center gap-1 overflow-x-auto pb-2">
            {PIPELINE_NODES.map((node, i) => (
              <div key={node.id} className="flex items-center">
                <div className="flex flex-col items-center min-w-[90px]">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${
                    node.id === 'compose' ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-slate-50'
                  }`}>
                    <Cpu className={`w-4 h-4 ${node.id === 'compose' ? 'text-amber-500' : 'text-slate-400'}`} />
                  </div>
                  <span className="text-[10px] font-semibold text-primary mt-1.5">{node.label}</span>
                  <span className="text-[9px] text-muted text-center leading-tight mt-0.5 max-w-[80px]">{node.desc}</span>
                </div>
                {i < PIPELINE_NODES.length - 1 && (
                  <ArrowRight className="w-3 h-3 text-slate-300 mx-0.5 flex-shrink-0" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Agent Status Table */}
        <div className="bg-white rounded-lg border border-slate-200 p-5 mb-4">
          <h2 className="text-xs font-semibold text-primary uppercase tracking-wider mb-4">Agent Status</h2>
          <div className="space-y-1.5">
            {[
              { agent: 'Lead Scout', status: 'idle', lastRun: 'Never', leads: 0 },
              { agent: 'Lead Profiler', status: 'idle', lastRun: 'Never', leads: 0 },
              { agent: 'Brand Analyser', status: 'idle', lastRun: 'Never', leads: 0 },
              { agent: 'Lead Qualifier', status: 'idle', lastRun: 'Never', leads: 0 },
              { agent: 'Auto-Assigner', status: 'ready', lastRun: 'Never', leads: 5, note: 'Test data seeded' },
              { agent: 'Brief Generator', status: 'idle', lastRun: 'Never', leads: 0 },
              { agent: 'AI Composer', status: 'blocked', lastRun: 'Never', leads: 0, note: 'Needs OpenRouter credits' },
              { agent: 'Site QA', status: 'idle', lastRun: 'Never', leads: 0 },
            ].map((row) => (
              <div key={row.agent} className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-slate-50">
                <div className="flex items-center gap-2.5">
                  {row.status === 'ready' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> :
                   row.status === 'blocked' ? <AlertCircle className="w-3.5 h-3.5 text-amber-500" /> :
                   <Clock className="w-3.5 h-3.5 text-slate-300" />}
                  <span className="text-[13px] font-medium text-primary">{row.agent}</span>
                  {row.note && <span className="text-[10px] text-muted bg-slate-100 px-1.5 py-0.5 rounded">{row.note}</span>}
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-[11px] text-muted">{row.lastRun}</span>
                  <span className="text-[11px] text-muted w-16 text-right">{row.leads} leads</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pipeline Controls */}
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <h2 className="text-xs font-semibold text-primary uppercase tracking-wider mb-4">Emergency Controls</h2>
          <p className="text-[11px] text-muted mb-3">These override the autonomous system. Use only when intervention is needed.</p>
          <div className="flex gap-2">
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-200 text-[12px] font-medium text-muted hover:bg-slate-50 transition-colors">
              <Pause className="w-3 h-3" /> Pause Auto-Assignment
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-200 text-[12px] font-medium text-muted hover:bg-slate-50 transition-colors">
              <Play className="w-3 h-3" /> Trigger Pipeline Run
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
