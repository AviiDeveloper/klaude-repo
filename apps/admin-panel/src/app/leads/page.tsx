'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import type { LeadRow } from '@/lib/types';

const STATUS_STYLES: Record<string, string> = {
  new: 'bg-blue-50 text-blue-700',
  visited: 'bg-amber-50 text-amber-700',
  pitched: 'bg-violet-50 text-violet-700',
  sold: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-red-50 text-red-600',
};

export default function LeadsPage() {
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => { loadLeads(); }, [filter]);

  async function loadLeads() {
    const params = new URLSearchParams();
    if (filter) params.set('status', filter);
    if (search) params.set('q', search);
    const res = await fetch(`/api/leads?${params}`);
    const data = await res.json();
    setLeads(data.data ?? []);
  }

  // Summary counts
  const counts = leads.reduce((acc, l) => { acc[l.status] = (acc[l.status] ?? 0) + 1; return acc; }, {} as Record<string, number>);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-base font-semibold text-primary">Lead Tracking</h1>
            <p className="text-xs text-muted mt-0.5">{leads.length} leads in system</p>
          </div>
          <input
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadLeads()}
            className="px-3 py-1.5 rounded-md border border-slate-200 text-[12px] w-48 focus:outline-none focus:ring-1 focus:ring-slate-300"
          />
        </div>

        {/* Filter chips */}
        <div className="flex gap-1 mb-4">
          {['', 'new', 'visited', 'pitched', 'sold', 'rejected'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                filter === f ? 'bg-primary text-white' : 'bg-white border border-slate-200 text-muted hover:bg-slate-50'
              }`}
            >
              {f || 'All'}{counts[f] !== undefined ? ` (${counts[f]})` : f === '' ? ` (${leads.length})` : ''}
            </button>
          ))}
        </div>

        {/* Leads table */}
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-muted uppercase tracking-wider">Business</th>
                <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-muted uppercase tracking-wider">Type</th>
                <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-muted uppercase tracking-wider">Area</th>
                <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-muted uppercase tracking-wider">Assigned To</th>
                <th className="text-center px-4 py-2.5 text-[10px] font-semibold text-muted uppercase tracking-wider">Rating</th>
                <th className="text-center px-4 py-2.5 text-[10px] font-semibold text-muted uppercase tracking-wider">Status</th>
                <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-muted uppercase tracking-wider">Assigned</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.assignment_id} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="px-4 py-2.5">
                    <div className="text-[13px] font-medium text-primary">{lead.business_name}</div>
                    {lead.phone && <div className="text-[11px] text-muted">{lead.phone}</div>}
                  </td>
                  <td className="px-4 py-2.5 text-[12px] text-muted capitalize">{lead.business_type ?? '—'}</td>
                  <td className="px-4 py-2.5 text-[12px] text-muted">{lead.postcode ?? '—'}</td>
                  <td className="px-4 py-2.5 text-[12px] text-muted">
                    {lead.assigned_to_name ?? <span className="text-amber-600">Unassigned</span>}
                  </td>
                  <td className="px-4 py-2.5 text-[12px] text-center">
                    {lead.google_rating ? <span className="text-amber-600 font-medium">{lead.google_rating}★</span> : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[lead.status] ?? ''}`}>
                      {lead.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-[11px] text-muted text-right">
                    {lead.assigned_at ? new Date(lead.assigned_at).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
              {leads.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-[12px] text-muted">
                  No leads found. The pipeline auto-generates and assigns leads.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
