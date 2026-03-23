'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import type { LeadCard as LeadCardType, SalesStats } from '@/lib/types';
import { Search, Loader2, TrendingUp, MapPin, Star, ChevronRight, MonitorSmartphone, Phone, Clock } from 'lucide-react';

const FILTERS = ['all', 'new', 'visited', 'pitched', 'sold'] as const;

const STATUS_DOT: Record<string, string> = {
  new: 'bg-blue-500',
  visited: 'bg-amber-500',
  pitched: 'bg-violet-500',
  sold: 'bg-emerald-500',
  rejected: 'bg-slate-300',
};

const STATUS_LABEL: Record<string, string> = {
  new: 'New',
  visited: 'Visited',
  pitched: 'Pitched',
  sold: 'Sold',
  rejected: 'Rejected',
};

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

  const commission = stats?.total_commission ?? 0;
  const newCount = stats?.new_count ?? 0;
  const visitedCount = stats?.visited_count ?? 0;
  const pitchedCount = stats?.pitched_count ?? 0;
  const soldCount = stats?.sold_count ?? 0;

  // Count leads per filter
  const filterCounts: Record<string, number> = {
    all: leads.length,
    new: leads.filter(l => l.assignment_status === 'new').length,
    visited: leads.filter(l => l.assignment_status === 'visited').length,
    pitched: leads.filter(l => l.assignment_status === 'pitched').length,
    sold: leads.filter(l => l.assignment_status === 'sold').length,
  };

  return (
    <div className="max-w-lg mx-auto">
      {/* Header bar */}
      <div className="px-4 pt-4 pb-3 flex items-start justify-between">
        <div>
          <h1 className="text-base font-semibold text-primary">Your Leads</h1>
          <p className="text-[11px] text-muted mt-0.5">
            {newCount} new · {visitedCount} visited · {pitchedCount} pitched · {soldCount} sold
          </p>
        </div>
        {commission > 0 && (
          <div className="flex items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded-full">
            <TrendingUp className="w-3 h-3 text-emerald-600" />
            <span className="text-[12px] font-semibold text-emerald-700">£{commission.toFixed(0)}</span>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="h-px bg-slate-100" />

      {/* Search + Filter row */}
      <div className="px-4 py-3">
        <div className="relative mb-2.5">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" />
          <input
            type="text"
            placeholder="Search businesses..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg py-2 pl-9 pr-3 text-[13px] text-primary bg-slate-50 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/5 focus:bg-white border border-transparent focus:border-slate-200 transition-all"
          />
        </div>

        {/* Filter tabs */}
        <div className="flex gap-0.5 overflow-x-auto -mx-4 px-4">
          {FILTERS.map((f) => {
            const active = filter === f;
            const count = filterCounts[f] ?? 0;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-medium whitespace-nowrap transition-colors ${
                  active
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-50 text-muted hover:bg-slate-100'
                }`}
              >
                {f === 'all' ? 'All' : STATUS_LABEL[f]}
                <span className={`tabular-nums ${active ? 'text-slate-400' : 'text-slate-300'}`}>{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-slate-100" />

      {/* Lead list */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-5 h-5 text-slate-300 animate-spin" />
        </div>
      ) : leads.length === 0 ? (
        <div className="text-center py-16 px-4">
          <p className="text-[13px] text-muted">No leads found</p>
          <p className="text-[11px] text-slate-300 mt-1">
            {filter !== 'all' ? 'Try a different filter' : 'Leads appear when the pipeline assigns them'}
          </p>
        </div>
      ) : (
        <div>
          {leads.map((lead, i) => (
            <EnhancedLeadCard key={lead.assignment_id} lead={lead} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}

function EnhancedLeadCard({ lead, index }: { lead: LeadCardType; index: number }) {
  const hasDemo = !!lead.demo_site_domain;
  const hasPhone = !!lead.phone;

  return (
    <Link
      href={`/lead/${lead.assignment_id}`}
      className="block px-4 py-3.5 border-b border-slate-50 active:bg-slate-50 transition-colors animate-fade-in"
      style={{ animationDelay: `${index * 20}ms` }}
    >
      <div className="flex items-start gap-3">
        {/* Status dot */}
        <div className="pt-1.5">
          <div className={`w-2.5 h-2.5 rounded-full ${STATUS_DOT[lead.assignment_status] ?? 'bg-slate-300'}`} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Row 1: Name + badges */}
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-[14px] font-semibold text-primary truncate">{lead.business_name}</h3>
            {hasDemo && (
              <span className="flex items-center gap-0.5 text-[9px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full flex-shrink-0">
                <MonitorSmartphone className="w-2.5 h-2.5" />
                Demo
              </span>
            )}
          </div>

          {/* Row 2: Type + location + rating */}
          <div className="flex items-center gap-1.5 text-[11px] text-muted mb-1.5">
            {lead.business_type && <span className="capitalize">{lead.business_type}</span>}
            {lead.postcode && (
              <>
                <span className="text-slate-200">·</span>
                <span className="inline-flex items-center gap-0.5">
                  <MapPin className="w-2.5 h-2.5" />
                  {lead.postcode}
                </span>
              </>
            )}
            {lead.google_rating && (
              <>
                <span className="text-slate-200">·</span>
                <span className="inline-flex items-center gap-0.5">
                  <Star className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />
                  {lead.google_rating}
                  {lead.google_review_count && <span className="text-slate-300">({lead.google_review_count})</span>}
                </span>
              </>
            )}
          </div>

          {/* Row 3: Contextual info based on status */}
          <div className="flex items-center gap-2">
            {lead.assignment_status === 'new' && !lead.has_website && (
              <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded font-medium">No website — perfect candidate</span>
            )}
            {lead.assignment_status === 'new' && lead.has_website && (lead.website_quality_score ?? 100) < 50 && (
              <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded font-medium">Poor website — upgrade opportunity</span>
            )}
            {hasPhone && (
              <span className="text-[10px] text-slate-400 inline-flex items-center gap-0.5">
                <Phone className="w-2.5 h-2.5" />
                {lead.phone}
              </span>
            )}
          </div>
        </div>

        {/* Right: status label + arrow */}
        <div className="flex items-center gap-2 pt-1">
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
            lead.assignment_status === 'new' ? 'bg-blue-50 text-blue-600' :
            lead.assignment_status === 'visited' ? 'bg-amber-50 text-amber-600' :
            lead.assignment_status === 'pitched' ? 'bg-violet-50 text-violet-600' :
            lead.assignment_status === 'sold' ? 'bg-emerald-50 text-emerald-600' :
            'bg-slate-50 text-slate-500'
          }`}>
            {STATUS_LABEL[lead.assignment_status] ?? lead.assignment_status}
          </span>
          <ChevronRight className="w-4 h-4 text-slate-200" />
        </div>
      </div>
    </Link>
  );
}
