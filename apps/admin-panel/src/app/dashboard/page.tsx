'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import { CircleDot, TrendingUp, Users, MapPin, DollarSign, AlertTriangle, Clock, CheckCircle2, XCircle } from 'lucide-react';

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
    const interval = setInterval(loadData, 30000); // Auto-refresh every 30s
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
      <div className="flex min-h-screen bg-slate-50">
        <Sidebar />
        <main className="flex-1 p-6"><p className="text-sm text-muted">Loading system state...</p></main>
      </div>
    );
  }

  const { stats, funnel, alerts } = data;
  const funnelMax = Math.max(funnel.assigned, 1);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-base font-semibold text-primary">System Overview</h1>
            <p className="text-xs text-muted mt-0.5">Autonomous operations monitor</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-muted">
              <CircleDot className="w-3 h-3 text-green-500 animate-pulse" />
              Live
            </div>
            <span className="text-[10px] text-muted">
              Updated {lastRefresh.toLocaleTimeString()}
            </span>
          </div>
        </div>

        {/* System Status Row */}
        <div className="grid grid-cols-5 gap-3 mb-6">
          {[
            { label: 'Active Agents', value: stats.active_salespeople, sub: `of ${stats.total_salespeople}`, icon: Users },
            { label: 'Total Leads', value: stats.total_leads, icon: MapPin },
            { label: 'Conversion', value: `${(stats.conversion_rate ?? 0).toFixed(1)}%`, icon: TrendingUp },
            { label: 'This Week', value: `£${(stats.revenue_this_week ?? 0).toFixed(0)}`, icon: DollarSign },
            { label: 'Pipeline Cost', value: '$0.00', sub: 'no API credits', icon: Clock },
          ].map((kpi) => (
            <div key={kpi.label} className="bg-white rounded-lg border border-slate-200 px-4 py-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-medium text-muted uppercase tracking-wider">{kpi.label}</span>
                <kpi.icon className="w-3.5 h-3.5 text-slate-300" />
              </div>
              <div className="text-lg font-semibold text-primary leading-none">{kpi.value}</div>
              {kpi.sub && <div className="text-[10px] text-muted mt-1">{kpi.sub}</div>}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-4">
          {/* Conversion Funnel */}
          <div className="col-span-2 bg-white rounded-lg border border-slate-200 p-5">
            <h2 className="text-xs font-semibold text-primary uppercase tracking-wider mb-4">Conversion Funnel</h2>
            <div className="space-y-2.5">
              {[
                { label: 'Assigned', value: funnel.assigned, color: 'bg-slate-300' },
                { label: 'Visited', value: funnel.visited, color: 'bg-blue-400' },
                { label: 'Pitched', value: funnel.pitched, color: 'bg-amber-400' },
                { label: 'Sold', value: funnel.sold, color: 'bg-emerald-500' },
                { label: 'Rejected', value: funnel.rejected, color: 'bg-red-300' },
              ].map((bar) => (
                <div key={bar.label} className="flex items-center gap-2">
                  <span className="text-[11px] text-muted w-14 text-right font-medium">{bar.label}</span>
                  <div className="flex-1 bg-slate-100 rounded h-5 overflow-hidden">
                    <div
                      className={`h-full ${bar.color} rounded transition-all duration-700 flex items-center justify-end pr-1.5`}
                      style={{ width: `${Math.max((bar.value / funnelMax) * 100, bar.value > 0 ? 4 : 0)}%` }}
                    >
                      {bar.value > 0 && <span className="text-[9px] font-bold text-white">{bar.value}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* System Alerts */}
          <div className="bg-white rounded-lg border border-slate-200 p-5">
            <h2 className="text-xs font-semibold text-primary uppercase tracking-wider mb-4">System Alerts</h2>
            {alerts.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-emerald-600">
                <CheckCircle2 className="w-4 h-4" />
                All systems nominal
              </div>
            ) : (
              <div className="space-y-2">
                {alerts.map((alert, i) => {
                  const Icon = alert.type === 'danger' ? XCircle : AlertTriangle;
                  const color = alert.type === 'danger' ? 'text-red-600 bg-red-50' : 'text-amber-600 bg-amber-50';
                  return (
                    <div key={i} className={`flex items-start gap-2 px-2.5 py-2 rounded-md text-[11px] ${color}`}>
                      <Icon className="w-3.5 h-3.5 mt-px flex-shrink-0" />
                      <span>{alert.message}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Weekly Summary */}
        <div className="mt-4 bg-white rounded-lg border border-slate-200 p-5">
          <h2 className="text-xs font-semibold text-primary uppercase tracking-wider mb-3">7-Day Summary</h2>
          <div className="grid grid-cols-4 gap-6">
            <div>
              <div className="text-xl font-semibold text-primary">{stats.visits_this_week ?? 0}</div>
              <div className="text-[10px] text-muted uppercase tracking-wider">Visits</div>
            </div>
            <div>
              <div className="text-xl font-semibold text-primary">{stats.sales_this_week ?? 0}</div>
              <div className="text-[10px] text-muted uppercase tracking-wider">Sales</div>
            </div>
            <div>
              <div className="text-xl font-semibold text-emerald-600">£{(stats.revenue_this_week ?? 0).toFixed(0)}</div>
              <div className="text-[10px] text-muted uppercase tracking-wider">Revenue</div>
            </div>
            <div>
              <div className="text-xl font-semibold text-primary">{(stats.conversion_rate ?? 0).toFixed(1)}%</div>
              <div className="text-[10px] text-muted uppercase tracking-wider">Conversion</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
