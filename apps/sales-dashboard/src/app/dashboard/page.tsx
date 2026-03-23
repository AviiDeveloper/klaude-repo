'use client';

import { useEffect, useState, useCallback } from 'react';
import type { LeadCard as LeadCardType, SalesStats, AssignmentStatus } from '@/lib/types';
import { LeadCard } from '@/components/LeadCard';
import { StatsBar, CommissionBanner } from '@/components/StatsBar';
import { Search, Filter, RefreshCw, Loader2 } from 'lucide-react';
import clsx from 'clsx';

const STATUS_FILTERS: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'new', label: 'New' },
  { value: 'visited', label: 'Visited' },
  { value: 'pitched', label: 'Pitched' },
  { value: 'sold', label: 'Sold' },
];

export default function DashboardPage() {
  const [leads, setLeads] = useState<LeadCardType[]>([]);
  const [stats, setStats] = useState<SalesStats | null>(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchLeads = useCallback(async () => {
    const params = new URLSearchParams();
    if (filter !== 'all') params.set('status', filter);
    if (search) params.set('search', search);

    const res = await fetch(`/api/leads?${params}`);
    if (res.ok) {
      const data = await res.json();
      setLeads(data.data ?? []);
    }
  }, [filter, search]);

  const fetchStats = useCallback(async () => {
    const res = await fetch('/api/stats');
    if (res.ok) {
      const data = await res.json();
      setStats(data.data ?? null);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchLeads(), fetchStats()]).finally(() => setLoading(false));
  }, [fetchLeads, fetchStats]);

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-sd-text">Your Leads</h1>
          <p className="text-sd-text-muted text-xs">
            {leads.length} assigned {filter !== 'all' ? `(${filter})` : ''}
          </p>
        </div>
        <button
          onClick={() => { fetchLeads(); fetchStats(); }}
          className="p-2 rounded-lg bg-sd-bg-card border border-sd-border text-sd-text-muted hover:text-sd-accent transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Stats */}
      <StatsBar stats={stats} />
      <CommissionBanner stats={stats} />

      {/* Search + Filter */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-sd-text-muted" />
          <input
            type="text"
            placeholder="Search businesses..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-sd-bg-card border border-sd-border rounded-lg py-2.5 pl-9 pr-3 text-sm text-sd-text placeholder:text-sd-text-muted/40 focus:outline-none focus:border-sd-accent/50"
          />
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
          {STATUS_FILTERS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all',
                filter === value
                  ? 'bg-sd-accent text-white'
                  : 'bg-sd-bg-card border border-sd-border text-sd-text-muted hover:text-sd-text',
              )}
            >
              {label}
              {value !== 'all' && stats && (
                <span className="ml-1 opacity-60">
                  {(stats as unknown as Record<string, number>)[`${value}_count`] ?? 0}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Lead Cards */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-sd-accent animate-spin" />
        </div>
      ) : leads.length === 0 ? (
        <div className="text-center py-16">
          <Filter className="w-8 h-8 text-sd-text-muted/30 mx-auto mb-3" />
          <p className="text-sd-text-muted text-sm">No leads found</p>
          <p className="text-sd-text-muted/50 text-xs mt-1">
            {filter !== 'all' ? 'Try a different filter' : 'Leads will appear once assigned to you'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {leads.map((lead, i) => (
            <div key={lead.assignment_id} className="animate-fade-in" style={{ animationDelay: `${i * 50}ms` }}>
              <LeadCard lead={lead} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
