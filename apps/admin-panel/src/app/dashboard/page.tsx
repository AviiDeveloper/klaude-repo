'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import { Users, MapPin, TrendingUp, DollarSign, AlertTriangle, Info, AlertCircle } from 'lucide-react';

interface DashboardData {
  stats: Record<string, number>;
  funnel: { assigned: number; visited: number; pitched: number; sold: number; rejected: number };
  alerts: Array<{ type: string; message: string }>;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    fetch('/api/stats').then((r) => r.json()).then((r) => setData(r.data));
  }, []);

  if (!data) return <div className="flex"><Sidebar /><div className="flex-1 p-8"><p className="text-muted">Loading...</p></div></div>;

  const { stats, funnel, alerts } = data;

  const kpis = [
    { label: 'Active Team', value: stats.active_salespeople, total: stats.total_salespeople, icon: Users, color: 'accent' },
    { label: 'Total Leads', value: stats.total_leads, icon: MapPin, color: 'primary' },
    { label: 'Conversion', value: `${stats.conversion_rate?.toFixed(1)}%`, icon: TrendingUp, color: 'success' },
    { label: 'Revenue (week)', value: `£${stats.revenue_this_week?.toFixed(0)}`, icon: DollarSign, color: 'success' },
  ];

  const funnelMax = Math.max(funnel.assigned, 1);
  const funnelBars = [
    { label: 'Assigned', value: funnel.assigned, color: 'bg-slate-300' },
    { label: 'Visited', value: funnel.visited, color: 'bg-blue-400' },
    { label: 'Pitched', value: funnel.pitched, color: 'bg-amber-400' },
    { label: 'Sold', value: funnel.sold, color: 'bg-green-500' },
    { label: 'Rejected', value: funnel.rejected, color: 'bg-red-400' },
  ];

  const alertIcons: Record<string, typeof AlertTriangle> = {
    warning: AlertTriangle, info: Info, danger: AlertCircle,
  };

  return (
    <div className="flex min-h-screen bg-surface-alt">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="mb-8">
          <h1 className="text-lg font-semibold text-primary">Dashboard</h1>
          <p className="text-sm text-muted">Team performance overview</p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="bg-white rounded-xl border border-surface-border p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-muted uppercase tracking-wide">{kpi.label}</span>
                <kpi.icon className="w-4 h-4 text-muted-light" />
              </div>
              <div className="text-2xl font-semibold text-primary">
                {kpi.value}
                {kpi.total !== undefined && <span className="text-sm font-normal text-muted ml-1">/ {kpi.total}</span>}
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Conversion Funnel */}
          <div className="bg-white rounded-xl border border-surface-border p-6">
            <h2 className="text-sm font-semibold text-primary mb-5">Conversion Funnel</h2>
            <div className="space-y-3">
              {funnelBars.map((bar) => (
                <div key={bar.label} className="flex items-center gap-3">
                  <span className="text-xs text-muted w-16 text-right">{bar.label}</span>
                  <div className="flex-1 bg-surface-alt rounded-full h-6 overflow-hidden">
                    <div
                      className={`h-full ${bar.color} rounded-full transition-all duration-500 flex items-center justify-end pr-2`}
                      style={{ width: `${Math.max((bar.value / funnelMax) * 100, 2)}%` }}
                    >
                      <span className="text-[10px] font-semibold text-white">{bar.value}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Alerts */}
          <div className="bg-white rounded-xl border border-surface-border p-6">
            <h2 className="text-sm font-semibold text-primary mb-5">Alerts</h2>
            {alerts.length === 0 ? (
              <p className="text-sm text-muted">No alerts — everything is running smoothly.</p>
            ) : (
              <div className="space-y-2">
                {alerts.map((alert, i) => {
                  const Icon = alertIcons[alert.type] ?? Info;
                  const colors: Record<string, string> = {
                    warning: 'bg-amber-50 text-amber-700 border-amber-200',
                    danger: 'bg-red-50 text-red-700 border-red-200',
                    info: 'bg-blue-50 text-blue-700 border-blue-200',
                  };
                  return (
                    <div key={i} className={`flex items-start gap-2.5 px-3 py-2.5 rounded-lg border text-sm ${colors[alert.type] ?? colors.info}`}>
                      <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span>{alert.message}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Weekly Summary */}
        <div className="mt-6 bg-white rounded-xl border border-surface-border p-6">
          <h2 className="text-sm font-semibold text-primary mb-4">This Week</h2>
          <div className="grid grid-cols-3 gap-8">
            <div>
              <div className="text-2xl font-semibold text-primary">{stats.visits_this_week}</div>
              <div className="text-xs text-muted">Visits</div>
            </div>
            <div>
              <div className="text-2xl font-semibold text-primary">{stats.sales_this_week}</div>
              <div className="text-xs text-muted">Sales</div>
            </div>
            <div>
              <div className="text-2xl font-semibold text-success">£{stats.revenue_this_week?.toFixed(0)}</div>
              <div className="text-xs text-muted">Revenue</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
