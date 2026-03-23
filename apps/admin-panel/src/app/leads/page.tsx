'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import type { LeadRow } from '@/lib/types';

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-50 text-blue-700',
  visited: 'bg-amber-50 text-amber-700',
  pitched: 'bg-purple-50 text-purple-700',
  sold: 'bg-green-50 text-green-700',
  rejected: 'bg-red-50 text-red-700',
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

  const filters = ['', 'new', 'visited', 'pitched', 'sold', 'rejected'];

  return (
    <div className="flex min-h-screen bg-surface-alt">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-lg font-semibold text-primary">Leads</h1>
            <p className="text-sm text-muted">{leads.length} leads</p>
          </div>
          <input
            placeholder="Search leads..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadLeads()}
            className="px-3 py-2 rounded-lg border border-surface-border text-sm w-64 focus:outline-none focus:ring-2 focus:ring-accent/20"
          />
        </div>

        {/* Filter chips */}
        <div className="flex gap-1.5 mb-5">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filter === f ? 'bg-accent text-white' : 'bg-white border border-surface-border text-muted hover:bg-surface-alt'
              }`}
            >
              {f || 'All'}
            </button>
          ))}
        </div>

        {/* Leads Table */}
        <div className="bg-white rounded-xl border border-surface-border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-border bg-surface-alt">
                <th className="text-left px-5 py-3 text-[11px] font-semibold text-muted uppercase tracking-wider">Business</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold text-muted uppercase tracking-wider">Type</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold text-muted uppercase tracking-wider">Area</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold text-muted uppercase tracking-wider">Assigned To</th>
                <th className="text-center px-5 py-3 text-[11px] font-semibold text-muted uppercase tracking-wider">Rating</th>
                <th className="text-center px-5 py-3 text-[11px] font-semibold text-muted uppercase tracking-wider">Status</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold text-muted uppercase tracking-wider">Assigned</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.assignment_id} className="border-b border-surface-border table-row-hover">
                  <td className="px-5 py-3.5">
                    <div className="text-sm font-medium text-primary">{lead.business_name}</div>
                    {lead.phone && <div className="text-xs text-muted">{lead.phone}</div>}
                  </td>
                  <td className="px-5 py-3.5 text-sm text-muted capitalize">{lead.business_type ?? '—'}</td>
                  <td className="px-5 py-3.5 text-sm text-muted">{lead.postcode ?? '—'}</td>
                  <td className="px-5 py-3.5 text-sm text-muted">{lead.assigned_to_name ?? <span className="text-warning">Unassigned</span>}</td>
                  <td className="px-5 py-3.5 text-sm text-center">
                    {lead.google_rating ? (
                      <span className="text-amber-600 font-medium">{lead.google_rating}★</span>
                    ) : '—'}
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLORS[lead.status] ?? ''}`}>
                      {lead.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-xs text-muted">
                    {lead.assigned_at ? new Date(lead.assigned_at).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
              {leads.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-12 text-center text-sm text-muted">No leads found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
