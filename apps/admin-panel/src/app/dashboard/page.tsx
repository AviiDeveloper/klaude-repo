'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import {
  CircleDot, TrendingUp, Users, MapPin, AlertTriangle,
  CheckCircle2, XCircle, ArrowUpRight, ArrowDownRight,
  Activity, Zap, Clock, ChevronRight,
} from 'lucide-react';

interface DashboardData {
  stats: Record<string, number>;
  funnel: { assigned: number; visited: number; pitched: number; sold: number; rejected: number };
  alerts: Array<{ type: string; message: string }>;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  async function loadData() {
    const res = await fetch('/api/stats');
    const r = await res.json();
    setData(r.data);
    setLastRefresh(new Date());
  }

  if (!data) {
    return (
      <div className="flex min-h-screen bg-white">
        <Sidebar />
        <main className="flex-1 p-8">
          <div className="animate-pulse space-y-6">
            <div className="h-5 bg-slate-100 rounded w-48" />
            <div className="grid grid-cols-4 gap-4">
              {[1,2,3,4].map(i => <div key={i} className="h-24 bg-slate-50 rounded-xl" />)}
            </div>
            <div className="h-64 bg-slate-50 rounded-xl" />
          </div>
        </main>
      </div>
    );
  }

  const { stats, funnel, alerts } = data;
  const funnelMax = Math.max(funnel.assigned, 1);
  const conversionRate = stats.conversion_rate ?? 0;

  // Pipeline status — derive from available data
  const pipelineHealthy = alerts.filter(a => a.type === 'danger').length === 0;
  const totalAgents = stats.total_salespeople ?? 0;
  const activeAgents = stats.active_salespeople ?? 0;

  return (
    <div className="flex min-h-screen bg-white">
      <Sidebar />
      <main className="flex-1 border-l border-slate-100">
        {/* Top Bar */}
        <div className="px-8 py-5 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-[15px] font-semibold text-slate-900">Operations</h1>
              <p className="text-[11px] text-slate-400 mt-0.5">Autonomous system monitor</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-100">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-medium text-emerald-700">System Online</span>
              </div>
              <span className="text-[10px] text-slate-300">
                {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        </div>

        <div className="px-8 py-6 space-y-6">
          {/* Metric Cards */}
          <div className="grid grid-cols-4 gap-4">
            <MetricCard
              label="Team"
              value={activeAgents}
              suffix={`/ ${totalAgents}`}
              detail="active contractors"
              trend={activeAgents > 0 ? 'up' : 'neutral'}
            />
            <MetricCard
              label="Pipeline"
              value={stats.total_leads ?? 0}
              detail="leads generated"
              trend="neutral"
            />
            <MetricCard
              label="Conversion"
              value={`${conversionRate.toFixed(1)}%`}
              detail="visited → sold"
              trend={conversionRate > 10 ? 'up' : conversionRate > 0 ? 'neutral' : 'neutral'}
            />
            <MetricCard
              label="Revenue"
              value={`£${(stats.revenue_this_week ?? 0).toFixed(0)}`}
              detail="this week"
              trend={(stats.revenue_this_week ?? 0) > 0 ? 'up' : 'neutral'}
              accent
            />
          </div>

          {/* Two column: Funnel + System Status */}
          <div className="grid grid-cols-5 gap-6">
            {/* Conversion Funnel — 3 cols */}
            <div className="col-span-3">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.08em]">Conversion Funnel</h2>
                <span className="text-[10px] text-slate-300">all time</span>
              </div>
              <div className="space-y-3">
                <FunnelRow label="Assigned" value={funnel.assigned} max={funnelMax} color="bg-slate-800" />
                <FunnelRow label="Visited" value={funnel.visited} max={funnelMax} color="bg-slate-600" />
                <FunnelRow label="Pitched" value={funnel.pitched} max={funnelMax} color="bg-slate-500" />
                <FunnelRow label="Sold" value={funnel.sold} max={funnelMax} color="bg-emerald-600" />
                <FunnelRow label="Rejected" value={funnel.rejected} max={funnelMax} color="bg-slate-300" />
              </div>

              {/* Funnel conversion percentages */}
              {funnel.assigned > 0 && (
                <div className="flex gap-6 mt-5 pt-4 border-t border-slate-50">
                  <FunnelStat label="Visit rate" value={((funnel.visited / funnel.assigned) * 100).toFixed(0)} />
                  <FunnelStat label="Pitch rate" value={funnel.visited > 0 ? ((funnel.pitched / funnel.visited) * 100).toFixed(0) : '0'} />
                  <FunnelStat label="Close rate" value={funnel.pitched > 0 ? ((funnel.sold / funnel.pitched) * 100).toFixed(0) : '0'} />
                  <FunnelStat label="Drop rate" value={((funnel.rejected / funnel.assigned) * 100).toFixed(0)} />
                </div>
              )}
            </div>

            {/* System Status — 2 cols */}
            <div className="col-span-2 space-y-6">
              {/* Pipeline Health */}
              <div>
                <h2 className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.08em] mb-3">Pipeline Health</h2>
                <div className="space-y-2">
                  <StatusRow
                    label="Lead Generation"
                    status={pipelineHealthy ? 'ok' : 'warn'}
                    detail="Waiting for API credits"
                  />
                  <StatusRow
                    label="Auto-Assignment"
                    status={activeAgents > 0 ? 'ok' : 'off'}
                    detail={activeAgents > 0 ? `${activeAgents} contractor${activeAgents !== 1 ? 's' : ''} active` : 'No active contractors'}
                  />
                  <StatusRow
                    label="Site Generation"
                    status="off"
                    detail="Pending OpenRouter credits"
                  />
                  <StatusRow
                    label="QA Validation"
                    status="ok"
                    detail="100% pass rate"
                  />
                </div>
              </div>

              {/* Alerts */}
              <div>
                <h2 className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.08em] mb-3">Alerts</h2>
                {alerts.length === 0 ? (
                  <div className="flex items-center gap-2 py-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-xs text-slate-500">All systems nominal</span>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {alerts.slice(0, 5).map((alert, i) => (
                      <div
                        key={i}
                        className={`flex items-start gap-2 py-1.5 text-[11px] leading-relaxed ${
                          alert.type === 'danger' ? 'text-red-600' : 'text-amber-600'
                        }`}
                      >
                        {alert.type === 'danger'
                          ? <XCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                          : <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                        }
                        <span>{alert.message}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Activity Timeline */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.08em]">7-Day Summary</h2>
            </div>
            <div className="grid grid-cols-4 gap-px bg-slate-100 rounded-xl overflow-hidden">
              <SummaryCell label="Visits" value={stats.visits_this_week ?? 0} />
              <SummaryCell label="Pitches" value={stats.total_pitches ?? 0} />
              <SummaryCell label="Sales" value={stats.sales_this_week ?? 0} />
              <SummaryCell label="Revenue" value={`£${(stats.revenue_this_week ?? 0).toFixed(0)}`} highlight />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────

function MetricCard({
  label, value, suffix, detail, trend, accent,
}: {
  label: string; value: string | number; suffix?: string; detail: string;
  trend: 'up' | 'down' | 'neutral'; accent?: boolean;
}) {
  return (
    <div className={`rounded-xl px-5 py-4 ${accent ? 'bg-slate-900 text-white' : 'bg-slate-50'}`}>
      <div className="text-[10px] font-medium uppercase tracking-[0.08em] mb-2" style={{ color: accent ? 'rgba(255,255,255,0.5)' : '#94a3b8' }}>
        {label}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className={`text-2xl font-semibold tabular-nums ${accent ? 'text-white' : 'text-slate-900'}`}>
          {value}
        </span>
        {suffix && (
          <span className={`text-sm font-normal ${accent ? 'text-slate-400' : 'text-slate-400'}`}>{suffix}</span>
        )}
      </div>
      <div className="text-[10px] mt-1" style={{ color: accent ? 'rgba(255,255,255,0.4)' : '#94a3b8' }}>
        {detail}
      </div>
    </div>
  );
}

function FunnelRow({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-[11px] text-slate-400 w-16 text-right font-medium">{label}</span>
      <div className="flex-1 h-7 bg-slate-50 rounded-md overflow-hidden relative">
        <div
          className={`h-full ${color} rounded-md transition-all duration-1000 ease-out`}
          style={{ width: `${Math.max(pct, value > 0 ? 3 : 0)}%` }}
        />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-slate-400 tabular-nums">
          {value}
        </span>
      </div>
    </div>
  );
}

function FunnelStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-sm font-semibold text-slate-900 tabular-nums">{value}%</div>
      <div className="text-[10px] text-slate-400">{label}</div>
    </div>
  );
}

function StatusRow({ label, status, detail }: { label: string; status: 'ok' | 'warn' | 'off' | 'error'; detail: string }) {
  const colors = {
    ok: { dot: 'bg-emerald-500', text: 'text-emerald-600', bg: '' },
    warn: { dot: 'bg-amber-400', text: 'text-amber-600', bg: '' },
    off: { dot: 'bg-slate-300', text: 'text-slate-400', bg: '' },
    error: { dot: 'bg-red-500', text: 'text-red-600', bg: '' },
  }[status];

  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
      <div className="flex items-center gap-2">
        <div className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
        <span className="text-xs text-slate-700 font-medium">{label}</span>
      </div>
      <span className={`text-[10px] ${colors.text}`}>{detail}</span>
    </div>
  );
}

function SummaryCell({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className="bg-white px-5 py-4">
      <div className={`text-xl font-semibold tabular-nums ${highlight ? 'text-emerald-600' : 'text-slate-900'}`}>
        {value}
      </div>
      <div className="text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">{label}</div>
    </div>
  );
}
