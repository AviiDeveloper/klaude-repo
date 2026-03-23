'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import { Search, Filter, ExternalLink } from 'lucide-react';
import type { LeadRow } from '@/lib/types';

const STATUSES = [
  { value: '', label: 'All' },
  { value: 'new', label: 'New' },
  { value: 'visited', label: 'Visited' },
  { value: 'pitched', label: 'Pitched' },
  { value: 'sold', label: 'Sold' },
  { value: 'rejected', label: 'Rejected' },
];

const STATUS_STYLES: Record<string, string> = {
  new: 'text-blue-700 bg-blue-50',
  visited: 'text-amber-700 bg-amber-50',
  pitched: 'text-violet-700 bg-violet-50',
  sold: 'text-emerald-700 bg-emerald-50',
  rejected: 'text-slate-500 bg-slate-100',
};

export default function LeadsPage() {
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadLeads(); }, [filter]);

  async function loadLeads() {
    setLoading(true);
    const params = new URLSearchParams();
    if (filter) params.set('status', filter);
    if (search) params.set('q', search);
    const res = await fetch(`/api/leads?${params}`);
    const data = await res.json();
    setLeads(data.data ?? []);
    setLoading(false);
  }

  const counts = leads.reduce((acc, l) => { acc[l.status] = (acc[l.status] ?? 0) + 1; return acc; }, {} as Record<string, number>);
  const total = leads.length;
  const withDemo = leads.filter(l => l.demo_site_domain).length;
  const unassigned = leads.filter(l => !l.assigned_to_name).length;

  return (
    <div className="flex min-h-screen bg-white">
      <Sidebar />
      <main className="flex-1 border-l border-slate-100">
        {/* Header */}
        <div className="px-8 py-5 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-[15px] font-semibold text-slate-900">Leads</h1>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {total} total · {withDemo} with demo sites · {unassigned} unassigned
              </p>
            </div>
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" />
              <input
                placeholder="Search businesses..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadLeads()}
                className="pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-[12px] w-56 focus:outline-none focus:border-slate-300 focus:ring-2 focus:ring-accent/20 transition-all placeholder:text-slate-300"
              />
            </div>
          </div>
        </div>

        <div className="px-8 py-6 space-y-5">
          {/* Filter Tabs */}
          <div className="flex items-center gap-1 border-b border-slate-100 pb-px">
            {STATUSES.map((s) => {
              const count = s.value ? (counts[s.value] ?? 0) : total;
              const active = filter === s.value;
              return (
                <button
                  key={s.value}
                  onClick={() => setFilter(s.value)}
                  className={`px-3 py-2 text-[12px] font-medium border-b-2 transition-colors -mb-px ${
                    active
                      ? 'border-slate-900 text-slate-900'
                      : 'border-transparent text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {s.label}
                  <span className={`ml-1.5 text-[10px] tabular-nums ${active ? 'text-slate-500' : 'text-slate-300'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Table */}
          <div className="border border-slate-100 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50">
                  <th className="text-left px-5 py-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Business</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Type</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Area</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Contractor</th>
                  <th className="text-center px-4 py-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Rating</th>
                  <th className="text-center px-4 py-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Demo</th>
                  <th className="text-center px-4 py-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="text-right px-5 py-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.assignment_id} className="border-t border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="text-[13px] font-medium text-slate-900">{lead.business_name}</div>
                      {lead.phone && <div className="text-[11px] text-slate-400">{lead.phone}</div>}
                    </td>
                    <td className="px-4 py-3.5 text-[12px] text-slate-500 capitalize">{lead.business_type ?? '—'}</td>
                    <td className="px-4 py-3.5 text-[12px] text-slate-500">{lead.postcode ?? '—'}</td>
                    <td className="px-4 py-3.5 text-[12px]">
                      {lead.assigned_to_name
                        ? <span className="text-slate-700 font-medium">{lead.assigned_to_name}</span>
                        : <span className="text-amber-500 text-[11px] font-medium">Unassigned</span>
                      }
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      {lead.google_rating
                        ? <span className="text-[12px] font-medium text-slate-700">{lead.google_rating}<span className="text-amber-400 ml-0.5">★</span></span>
                        : <span className="text-[11px] text-slate-300">—</span>
                      }
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      {lead.demo_site_domain
                        ? <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 font-medium"><ExternalLink className="w-3 h-3" /> Ready</span>
                        : <span className="text-[10px] text-slate-300">—</span>
                      }
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className={`text-[10px] px-2.5 py-1 rounded-full font-medium ${STATUS_STYLES[lead.status] ?? 'text-slate-500 bg-slate-50'}`}>
                        {lead.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-[11px] text-right text-slate-400">
                      {lead.assigned_at ? new Date(lead.assigned_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}
                    </td>
                  </tr>
                ))}
                {leads.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-5 py-12 text-center">
                      <div className="text-[13px] text-slate-400">
                        {loading ? 'Loading...' : filter ? 'No leads with this status' : 'No leads in the system yet'}
                      </div>
                      <div className="text-[11px] text-slate-300 mt-1">
                        The pipeline auto-generates and assigns leads when running
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
