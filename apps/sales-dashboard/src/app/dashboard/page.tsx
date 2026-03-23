'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import type { LeadCard as LeadCardType, SalesStats } from '@/lib/types';
import {
  Search, Loader2, TrendingUp, MapPin, Star, ChevronRight,
  MonitorSmartphone, Phone, Briefcase, Eye, MessageCircle, CheckCircle2,
  CalendarDays, UserCircle, AlertTriangle,
} from 'lucide-react';

const FILTERS = ['all', 'new', 'visited', 'pitched', 'sold'] as const;

const STATUS_STYLES: Record<string, string> = {
  new: 'text-blue-700 bg-blue-50',
  visited: 'text-amber-700 bg-amber-50',
  pitched: 'text-violet-700 bg-violet-50',
  sold: 'text-emerald-700 bg-emerald-50',
  rejected: 'text-slate-500 bg-slate-100',
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
  const totalAssigned = stats?.total_assigned ?? 0;

  return (
    <>
      {/* Top bar */}
      <div className="px-6 md:px-8 py-5 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[15px] font-semibold text-slate-900">Leads</h1>
            <p className="text-[11px] text-slate-400 mt-0.5">{totalAssigned} assigned to you</p>
          </div>
          <div className="flex items-center gap-3">
            {commission > 0 && (
              <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-100 px-3 py-1 rounded-full">
                <TrendingUp className="w-3 h-3 text-emerald-600" />
                <span className="text-[12px] font-semibold text-emerald-700 tabular-nums">£{commission.toFixed(0)}</span>
                <span className="text-[10px] text-emerald-500">earned</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="px-6 md:px-8 py-5">
        {/* Metric cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <MetricCard icon={Briefcase} label="Queue" value={newCount} sub="new leads" />
          <MetricCard icon={Eye} label="Visited" value={visitedCount} sub="in progress" />
          <MetricCard icon={MessageCircle} label="Pitched" value={pitchedCount} sub="awaiting decision" />
          <MetricCard icon={CheckCircle2} label="Sold" value={soldCount} sub="closed deals" accent />
        </div>

        {/* Follow-up reminders */}
        <FollowUpSection leads={leads} />

        {/* Search + Filters */}
        <div className="flex flex-col md:flex-row md:items-center gap-3 mb-5">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" />
            <input
              type="text"
              placeholder="Search businesses..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg py-2 pl-9 pr-3 text-[13px] text-slate-900 bg-slate-50 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/5 focus:bg-white border border-transparent focus:border-slate-200 transition-all"
            />
          </div>
          <div className="flex gap-1 overflow-x-auto">
            {FILTERS.map((f) => {
              const active = filter === f;
              const count = f === 'all' ? totalAssigned : f === 'new' ? newCount : f === 'visited' ? visitedCount : f === 'pitched' ? pitchedCount : soldCount;
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-medium whitespace-nowrap transition-colors ${
                    active ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  {f === 'all' ? 'All' : STATUS_LABEL[f]}
                  <span className={`tabular-nums ${active ? 'text-slate-400' : 'text-slate-300'}`}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Lead table */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-5 h-5 text-slate-300 animate-spin" />
          </div>
        ) : leads.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-[13px] text-slate-400">No leads found</p>
            <p className="text-[11px] text-slate-300 mt-1">
              {filter !== 'all' ? 'Try a different filter' : 'Leads appear when the pipeline assigns them'}
            </p>
          </div>
        ) : (
          <div className="border border-slate-100 rounded-xl overflow-hidden">
            {/* Desktop table header */}
            <div className="hidden md:grid grid-cols-[1fr_100px_80px_100px_80px_100px_32px] gap-4 px-5 py-2.5 bg-slate-50 border-b border-slate-100">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Business</span>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Type</span>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Area</span>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider text-center">Rating</span>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider text-center">Demo</span>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider text-center">Status</span>
              <span></span>
            </div>

            {leads.map((lead, i) => (
              <LeadRow key={lead.assignment_id} lead={lead} index={i} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function LeadRow({ lead, index }: { lead: LeadCardType; index: number }) {
  const hasDemo = !!lead.demo_site_domain;

  return (
    <Link
      href={`/lead/${lead.assignment_id}`}
      className="block border-b border-slate-50 last:border-0 hover:bg-slate-50/50 active:bg-slate-50 transition-colors animate-fade-in"
      style={{ animationDelay: `${index * 15}ms` }}
    >
      {/* Desktop row */}
      <div className="hidden md:grid grid-cols-[1fr_100px_80px_100px_80px_100px_32px] gap-4 items-center px-5 py-3.5">
        {/* Business */}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-[13px] font-medium text-slate-900 truncate">{lead.business_name}</h3>
          </div>
          {lead.phone && (
            <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
              <Phone className="w-2.5 h-2.5" />
              {lead.phone}
            </div>
          )}
        </div>

        {/* Type */}
        <span className="text-[12px] text-slate-500 capitalize">{lead.business_type ?? '—'}</span>

        {/* Area */}
        <span className="text-[12px] text-slate-500">{lead.postcode ?? '—'}</span>

        {/* Rating */}
        <div className="text-center">
          {lead.google_rating ? (
            <span className="text-[12px] text-slate-700 inline-flex items-center gap-0.5">
              <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
              {lead.google_rating}
              {lead.google_review_count && <span className="text-slate-300 text-[10px]">({lead.google_review_count})</span>}
            </span>
          ) : (
            <span className="text-[11px] text-slate-300">—</span>
          )}
        </div>

        {/* Demo */}
        <div className="text-center">
          {hasDemo ? (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
              <MonitorSmartphone className="w-2.5 h-2.5" />
              Ready
            </span>
          ) : (
            <span className="text-[10px] text-slate-300">—</span>
          )}
        </div>

        {/* Status */}
        <div className="text-center">
          <span className={`text-[10px] font-medium px-2.5 py-1 rounded-full ${STATUS_STYLES[lead.assignment_status] ?? 'text-slate-500 bg-slate-50'}`}>
            {STATUS_LABEL[lead.assignment_status] ?? lead.assignment_status}
          </span>
        </div>

        {/* Arrow */}
        <ChevronRight className="w-4 h-4 text-slate-200" />
      </div>

      {/* Mobile row */}
      <div className="md:hidden px-4 py-3.5 flex items-start gap-3">
        <div className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${
          lead.assignment_status === 'new' ? 'bg-blue-500' :
          lead.assignment_status === 'visited' ? 'bg-amber-500' :
          lead.assignment_status === 'pitched' ? 'bg-violet-500' :
          lead.assignment_status === 'sold' ? 'bg-emerald-500' : 'bg-slate-300'
        }`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="text-[14px] font-semibold text-slate-900 truncate">{lead.business_name}</h3>
            {hasDemo && <MonitorSmartphone className="w-3 h-3 text-emerald-500 flex-shrink-0" />}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            {lead.business_type && <span className="capitalize">{lead.business_type}</span>}
            {lead.postcode && <><span className="text-slate-200">·</span><span>{lead.postcode}</span></>}
            {lead.google_rating && (
              <><span className="text-slate-200">·</span><span className="inline-flex items-center gap-0.5"><Star className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />{lead.google_rating}</span></>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[lead.assignment_status] ?? ''}`}>
            {STATUS_LABEL[lead.assignment_status]}
          </span>
          <ChevronRight className="w-4 h-4 text-slate-200" />
        </div>
      </div>
    </Link>
  );
}

function FollowUpSection({ leads }: { leads: LeadCardType[] }) {
  const now = new Date();
  const followUps = leads
    .filter((l) => l.follow_up_at)
    .map((l) => ({
      ...l,
      followUpDate: new Date(l.follow_up_at!),
      isOverdue: new Date(l.follow_up_at!) < now,
      isToday: new Date(l.follow_up_at!).toDateString() === now.toDateString(),
    }))
    .sort((a, b) => a.followUpDate.getTime() - b.followUpDate.getTime());

  if (followUps.length === 0) return null;

  const overdue = followUps.filter((f) => f.isOverdue);
  const upcoming = followUps.filter((f) => !f.isOverdue);

  function formatFollowUpDate(d: Date, isOverdue: boolean, isToday: boolean): string {
    if (isToday) return 'Today';
    if (isOverdue) {
      const days = Math.ceil((now.getTime() - d.getTime()) / 86400000);
      return days === 1 ? '1 day overdue' : `${days} days overdue`;
    }
    const days = Math.ceil((d.getTime() - now.getTime()) / 86400000);
    if (days === 1) return 'Tomorrow';
    if (days < 7) return d.toLocaleDateString('en-GB', { weekday: 'long' });
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
        <h2 className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.08em]">Follow-ups</h2>
        <span className="text-[10px] text-slate-300 tabular-nums">{followUps.length}</span>
      </div>

      <div className="border border-slate-100 rounded-xl overflow-hidden">
        {followUps.map((lead, i) => (
          <Link
            key={lead.assignment_id}
            href={`/lead/${lead.assignment_id}`}
            className={`flex items-center gap-4 px-4 py-3 hover:bg-slate-50/50 transition-colors ${i > 0 ? 'border-t border-slate-50' : ''}`}
          >
            {/* Urgency indicator */}
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
              lead.isOverdue ? 'bg-red-500' : lead.isToday ? 'bg-amber-500' : 'bg-blue-400'
            }`} />

            {/* Business info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-medium text-slate-900 truncate">{lead.business_name}</span>
                {lead.contact_name && (
                  <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                    <UserCircle className="w-2.5 h-2.5" />
                    {lead.contact_name}
                  </span>
                )}
              </div>
              {lead.follow_up_note && (
                <p className="text-[11px] text-slate-400 truncate mt-0.5">{lead.follow_up_note}</p>
              )}
            </div>

            {/* Date */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className={`text-[11px] font-medium ${
                lead.isOverdue ? 'text-red-600' : lead.isToday ? 'text-amber-600' : 'text-slate-500'
              }`}>
                {formatFollowUpDate(lead.followUpDate, lead.isOverdue, lead.isToday)}
              </span>
              {lead.isOverdue && <AlertTriangle className="w-3 h-3 text-red-400" />}
              <ChevronRight className="w-3.5 h-3.5 text-slate-200" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, sub, accent }: {
  icon: typeof Briefcase; label: string; value: number; sub: string; accent?: boolean;
}) {
  return (
    <div className={`rounded-xl px-4 py-3.5 ${accent ? 'bg-slate-900' : 'bg-slate-50'}`}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-medium uppercase tracking-[0.06em]" style={{ color: accent ? 'rgba(255,255,255,0.4)' : '#94a3b8' }}>{label}</span>
        <Icon className="w-3.5 h-3.5" style={{ color: accent ? 'rgba(255,255,255,0.2)' : '#e2e8f0' }} />
      </div>
      <div className={`text-xl font-semibold tabular-nums ${accent ? 'text-white' : 'text-slate-900'}`}>{value}</div>
      <div className="text-[10px] mt-0.5" style={{ color: accent ? 'rgba(255,255,255,0.35)' : '#94a3b8' }}>{sub}</div>
    </div>
  );
}
