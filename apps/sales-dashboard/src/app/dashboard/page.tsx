'use client';

import { useEffect, useState, useCallback } from 'react';
import type { LeadCard as LeadCardType, SalesStats } from '@/lib/types';
import { LeadCard } from '@/components/LeadCard';
import { StatsBar, CommissionBanner } from '@/components/StatsBar';
import { DailyTarget, CommissionProjection } from '@/components/DailyTarget';
import { Search, Loader2 } from 'lucide-react';
import clsx from 'clsx';

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

  return (
    <div className="max-w-lg mx-auto px-4 pt-6">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-xl font-bold text-primary tracking-tight">Leads</h1>
        <p className="text-xs text-muted mt-0.5">{leads.length} assigned to you</p>
      </div>

      {/* Activity tracker + stats */}
      <div className="mb-5 space-y-3">
        <DailyTarget stats={stats} />
        <StatsBar stats={stats} />
        <CommissionProjection stats={stats} />
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-faint" />
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full border border-border rounded-lg py-2 pl-8 pr-3 text-sm text-primary bg-white placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-primary/5 focus:border-primary/20"
        />
      </div>

      {/* Filters */}
      <div className="flex gap-1 mb-4">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={clsx(
              'px-2.5 py-1 rounded-md text-xs font-medium capitalize transition-colors',
              filter === f
                ? 'bg-primary text-white'
                : 'text-muted hover:text-secondary',
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-5 h-5 text-muted animate-spin" />
        </div>
      ) : leads.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-sm text-muted">No leads found</p>
        </div>
      ) : (
        <div>
          {leads.map((lead, i) => (
            <div key={lead.assignment_id} className="animate-fade-in" style={{ animationDelay: `${i * 30}ms` }}>
              <LeadCard lead={lead} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
