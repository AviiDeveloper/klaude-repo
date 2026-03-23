'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import { CircleDot, Pause, UserX } from 'lucide-react';

interface Member {
  id: string; name: string; area_postcode: string | null; user_status: string;
  active_leads: number; total_visits: number; total_sales: number;
  total_commission: number; conversion_rate: number; last_active_at: string | null;
  active: boolean;
}

export default function SalesforcePage() {
  const [team, setTeam] = useState<Member[]>([]);

  useEffect(() => { loadTeam(); const i = setInterval(loadTeam, 30000); return () => clearInterval(i); }, []);

  async function loadTeam() {
    const res = await fetch('/api/team');
    const data = await res.json();
    setTeam(data.data ?? []);
  }

  async function emergencyPause(id: string) {
    if (!confirm('Pause this salesperson? They will stop receiving new leads.')) return;
    await fetch(`/api/team/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_status: 'paused' }),
    });
    loadTeam();
  }

  async function emergencyResume(id: string) {
    await fetch(`/api/team/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_status: 'available' }),
    });
    loadTeam();
  }

  function timeAgo(dateStr: string | null): string {
    if (!dateStr) return 'Never';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }

  const active = team.filter((m) => m.active);
  const inactive = team.filter((m) => !m.active);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 p-6">
        <div className="mb-6">
          <h1 className="text-base font-semibold text-primary">Salesforce</h1>
          <p className="text-xs text-muted mt-0.5">
            {active.length} active · {active.filter((m) => m.user_status === 'available').length} available · Auto-managed by pipeline
          </p>
        </div>

        {/* Active Salespeople */}
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden mb-4">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-muted uppercase tracking-wider">Salesperson</th>
                <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-muted uppercase tracking-wider">Area</th>
                <th className="text-center px-4 py-2.5 text-[10px] font-semibold text-muted uppercase tracking-wider">Queue</th>
                <th className="text-center px-4 py-2.5 text-[10px] font-semibold text-muted uppercase tracking-wider">Visits</th>
                <th className="text-center px-4 py-2.5 text-[10px] font-semibold text-muted uppercase tracking-wider">Sales</th>
                <th className="text-center px-4 py-2.5 text-[10px] font-semibold text-muted uppercase tracking-wider">Conv.</th>
                <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-muted uppercase tracking-wider">Earned</th>
                <th className="text-center px-4 py-2.5 text-[10px] font-semibold text-muted uppercase tracking-wider">Status</th>
                <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-muted uppercase tracking-wider">Last Seen</th>
                <th className="px-4 py-2.5 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {active.map((m) => {
                const isOnline = m.last_active_at && (Date.now() - new Date(m.last_active_at).getTime()) < 3600000;
                return (
                  <tr key={m.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <CircleDot className={`w-2.5 h-2.5 ${isOnline ? 'text-emerald-500' : 'text-slate-300'}`} />
                        <span className="text-[13px] font-medium text-primary">{m.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-[12px] text-muted">{m.area_postcode ?? '—'}</td>
                    <td className="px-4 py-2.5 text-[12px] text-center font-medium">{m.active_leads}</td>
                    <td className="px-4 py-2.5 text-[12px] text-center">{m.total_visits}</td>
                    <td className="px-4 py-2.5 text-[12px] text-center font-medium">{m.total_sales}</td>
                    <td className="px-4 py-2.5 text-[12px] text-center">{m.conversion_rate.toFixed(0)}%</td>
                    <td className="px-4 py-2.5 text-[12px] text-right font-medium text-emerald-600">£{m.total_commission.toFixed(0)}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        m.user_status === 'available' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                      }`}>
                        {m.user_status ?? 'available'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-[11px] text-muted text-right">{timeAgo(m.last_active_at)}</td>
                    <td className="px-4 py-2.5">
                      {m.user_status === 'available' ? (
                        <button onClick={() => emergencyPause(m.id)} title="Emergency pause">
                          <Pause className="w-3 h-3 text-slate-300 hover:text-amber-500" />
                        </button>
                      ) : (
                        <button onClick={() => emergencyResume(m.id)} title="Resume">
                          <CircleDot className="w-3 h-3 text-slate-300 hover:text-emerald-500" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {active.length === 0 && (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-[12px] text-muted">No active salespeople. They self-register via the Sales app.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Info note */}
        <div className="text-[11px] text-muted bg-white rounded-lg border border-slate-200 px-4 py-3">
          Salespeople self-register via the Sales app and are auto-assigned leads by the pipeline.
          Use the pause button only if a salesperson needs to be temporarily removed from the assignment pool.
        </div>
      </main>
    </div>
  );
}
