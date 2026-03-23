'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import { Pause, Play, Users, TrendingUp, Briefcase } from 'lucide-react';

interface Member {
  id: string; name: string; area_postcode: string | null; user_status: string;
  active_leads: number; total_visits: number; total_sales: number;
  total_commission: number; conversion_rate: number; last_active_at: string | null;
  active: boolean;
}

export default function SalesforcePage() {
  const [team, setTeam] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadTeam(); const i = setInterval(loadTeam, 30000); return () => clearInterval(i); }, []);

  async function loadTeam() {
    const res = await fetch('/api/team');
    const data = await res.json();
    setTeam(data.data ?? []);
    setLoading(false);
  }

  async function toggleStatus(id: string, current: string) {
    const newStatus = current === 'available' ? 'paused' : 'available';
    if (newStatus === 'paused' && !confirm('Pause this contractor? They will stop receiving new leads.')) return;
    await fetch(`/api/team/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_status: newStatus }),
    });
    loadTeam();
  }

  function timeAgo(dateStr: string | null): string {
    if (!dateStr) return 'Never';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 2) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }

  const active = team.filter((m) => m.active);
  const available = active.filter((m) => m.user_status === 'available').length;
  const totalLeads = active.reduce((s, m) => s + m.active_leads, 0);
  const totalRevenue = active.reduce((s, m) => s + m.total_commission, 0);

  return (
    <div className="flex min-h-screen bg-white">
      <Sidebar />
      <main className="flex-1 border-l border-slate-100">
        {/* Header */}
        <div className="px-8 py-5 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-[15px] font-semibold text-slate-900">Team</h1>
              <p className="text-[11px] text-slate-400 mt-0.5">Contractor monitoring and override controls</p>
            </div>
          </div>
        </div>

        <div className="px-8 py-6 space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-4 gap-4">
            <SummaryCard icon={Users} label="Active" value={active.length} sub={`${available} available`} />
            <SummaryCard icon={Briefcase} label="Total Queue" value={totalLeads} sub="active leads" />
            <SummaryCard icon={TrendingUp} label="Team Conv." value={active.length > 0 ? `${(active.reduce((s, m) => s + m.conversion_rate, 0) / Math.max(active.length, 1)).toFixed(0)}%` : '—'} sub="avg conversion" />
            <SummaryCard icon={TrendingUp} label="Revenue" value={`£${totalRevenue.toFixed(0)}`} sub="total earned" accent />
          </div>

          {/* Team Table */}
          <div>
            <h2 className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.08em] mb-4">Contractors</h2>
            <div className="border border-slate-100 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="text-left px-5 py-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Name</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Area</th>
                    <th className="text-center px-4 py-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Queue</th>
                    <th className="text-center px-4 py-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Visits</th>
                    <th className="text-center px-4 py-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Sales</th>
                    <th className="text-center px-4 py-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Conv.</th>
                    <th className="text-right px-4 py-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Earned</th>
                    <th className="text-center px-4 py-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                    <th className="text-right px-5 py-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Last Active</th>
                    <th className="w-12 px-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {active.map((m) => {
                    const isOnline = m.last_active_at && (Date.now() - new Date(m.last_active_at).getTime()) < 3600000;
                    return (
                      <tr key={m.id} className="border-t border-slate-50 hover:bg-slate-50/50 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                            <span className="text-[13px] font-medium text-slate-900">{m.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-[12px] text-slate-500">{m.area_postcode ?? '—'}</td>
                        <td className="px-4 py-3.5 text-[13px] text-center font-semibold text-slate-900 tabular-nums">{m.active_leads}</td>
                        <td className="px-4 py-3.5 text-[12px] text-center text-slate-500 tabular-nums">{m.total_visits}</td>
                        <td className="px-4 py-3.5 text-[13px] text-center font-semibold text-slate-900 tabular-nums">{m.total_sales}</td>
                        <td className="px-4 py-3.5 text-[12px] text-center text-slate-500 tabular-nums">{m.conversion_rate.toFixed(0)}%</td>
                        <td className="px-4 py-3.5 text-[13px] text-right font-semibold text-emerald-600 tabular-nums">£{m.total_commission.toFixed(0)}</td>
                        <td className="px-4 py-3.5 text-center">
                          <span className={`text-[10px] px-2.5 py-1 rounded-full font-medium ${
                            m.user_status === 'available' ? 'text-emerald-700 bg-emerald-50' : 'text-amber-700 bg-amber-50'
                          }`}>
                            {m.user_status ?? 'available'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-[11px] text-right text-slate-400">{timeAgo(m.last_active_at)}</td>
                        <td className="px-3 py-3.5">
                          <button
                            onClick={() => toggleStatus(m.id, m.user_status ?? 'available')}
                            className="p-1.5 rounded-md hover:bg-slate-100 transition-colors"
                            title={m.user_status === 'available' ? 'Pause' : 'Resume'}
                          >
                            {m.user_status === 'available'
                              ? <Pause className="w-3.5 h-3.5 text-slate-400 hover:text-amber-500" />
                              : <Play className="w-3.5 h-3.5 text-slate-400 hover:text-emerald-500" />
                            }
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {active.length === 0 && (
                    <tr>
                      <td colSpan={10} className="px-5 py-12 text-center">
                        <div className="text-[13px] text-slate-400">No contractors registered</div>
                        <div className="text-[11px] text-slate-300 mt-1">They self-register via the SalesFlow app</div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Note */}
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Contractors self-register via the SalesFlow app and are auto-assigned leads by the pipeline based on area proximity.
            Use the pause control only for emergency override — it stops new assignments but preserves existing leads.
          </p>
        </div>
      </main>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, sub, accent }: {
  icon: typeof Users; label: string; value: string | number; sub: string; accent?: boolean;
}) {
  return (
    <div className={`rounded-xl px-5 py-4 ${accent ? 'bg-slate-900' : 'bg-slate-50'}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-medium uppercase tracking-[0.08em]" style={{ color: accent ? 'rgba(255,255,255,0.4)' : '#94a3b8' }}>{label}</span>
        <Icon className="w-3.5 h-3.5" style={{ color: accent ? 'rgba(255,255,255,0.2)' : '#cbd5e1' }} />
      </div>
      <div className={`text-xl font-semibold tabular-nums ${accent ? 'text-white' : 'text-slate-900'}`}>{value}</div>
      <div className="text-[10px] mt-0.5" style={{ color: accent ? 'rgba(255,255,255,0.35)' : '#94a3b8' }}>{sub}</div>
    </div>
  );
}
