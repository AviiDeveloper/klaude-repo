'use client';

import { useEffect, useState, useCallback } from 'react';
import type { LeadCard as LeadCardType, SalesStats } from '@/lib/types';
import { LeadCard } from '@/components/LeadCard';
import { Search, Loader2, TrendingUp } from 'lucide-react';

const FILTERS = ['all', 'new', 'visited', 'pitched', 'sold'] as const;

export default function DashboardPage() {
  const [leads, setLeads] = useState<LeadCardType[]>([]);
  const [stats, setStats] = useState<SalesStats | null>(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const params = new URLSearchParams();
    if (filter !== 'all') params.set('status', filter);
    if (search) params.set('search', search);

    const [leadsRes, statsRes] = await Promise.all([
      fetch(`/api/leads?${params}`),
      fetch('/api/stats'),
    ]);

    if (leadsRes.ok) {
      const d = await leadsRes.json();
      setLeads(d.data ?? []);
    }
    if (statsRes.ok) {
      const d = await statsRes.json();
      setStats(d.data ?? null);
    }
  }, [filter, search]);

  useEffect(() => {
    setLoading(true);
    fetchData().finally(() => setLoading(false));
  }, [fetchData]);

  const totalAssigned = stats?.total_assigned ?? 0;
  const newCount = stats?.new_count ?? 0;
  const soldCount = stats?.sold_count ?? 0;
  const commission = stats?.total_commission ?? 0;
  const visitsToday = stats?.visits_today ?? 0;

  return (
    <div className="max-w-lg mx-auto px-4 pt-5 pb-4">
      {/* Header — greeting + earnings */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-lg font-semibold text-primary tracking-tight">Your Leads</h1>
          <p className="text-xs text-muted mt-0.5">
            {newCount > 0 ? `${newCount} new` : 'No new leads'}
            {visitsToday > 0 ? ` · ${visitsToday} visited today` : ''}
          </p>
        </div>
        {commission > 0 && (
          <div className="text-right">
            <div className="text-lg font-semibold text-primary tabular-nums">£{commission.toFixed(0)}</div>
            <div className="text-[10px] text-muted flex items-center justify-end gap-1">
              <TrendingUp className="w-2.5 h-2.5 text-emerald-500" />
              earned
            </div>
          </div>
        )}
      </div>

      {/* Pipeline summary — compact horizontal strip */}
      <div className="grid grid-cols-4 gap-px bg-slate-100 rounded-xl overflow-hidden mb-5">
        <PipelineStat label="Queue" value={totalAssigned} />
        <PipelineStat label="Visited" value={stats?.visited_count ?? 0} />
        <PipelineStat label="Pitched" value={stats?.pitched_count ?? 0} />
        <PipelineStat label="Sold" value={soldCount} highlight />
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" />
        <input
          type="text"
          placeholder="Search businesses..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg py-2.5 pl-9 pr-3 text-sm text-primary bg-slate-50 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/5 focus:bg-white border border-transparent focus:border-slate-200 transition-all"
        />
      </div>

      {/* Filter tabs */}
      <div className="flex gap-0.5 mb-4 border-b border-slate-100 -mx-4 px-4">
        {FILTERS.map((f) => {
          const active = filter === f;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-2 text-xs font-medium capitalize border-b-2 transition-colors -mb-px ${
                active
                  ? 'border-slate-900 text-primary'
                  : 'border-transparent text-muted hover:text-secondary'
              }`}
            >
              {f}
            </button>
          );
        })}
      </div>

      {/* Lead list */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-5 h-5 text-slate-300 animate-spin" />
        </div>
      ) : leads.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-sm text-muted">No leads found</p>
          <p className="text-xs text-slate-300 mt-1">
            {filter !== 'all' ? 'Try a different filter' : 'Leads will appear when the pipeline assigns them'}
          </p>
        </div>
      ) : (
        <div className="space-y-0">
          {leads.map((lead, i) => (
            <div key={lead.assignment_id} className="animate-fade-in" style={{ animationDelay: `${i * 25}ms` }}>
              <LeadCard lead={lead} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PipelineStat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className="bg-white py-3 text-center">
      <div className={`text-base font-semibold tabular-nums ${highlight ? 'text-emerald-600' : 'text-primary'}`}>
        {value}
      </div>
      <div className="text-[10px] text-muted uppercase tracking-wider">{label}</div>
    </div>
  );
}
