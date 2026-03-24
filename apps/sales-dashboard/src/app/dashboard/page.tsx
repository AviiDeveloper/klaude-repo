'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Lead {
  id: string;
  business_name: string;
  business_type: string;
  postcode: string;
  phone: string;
  google_rating: number;
  google_review_count: number;
  status: 'new' | 'visited' | 'pitched' | 'sold' | 'rejected';
  has_demo_site: boolean;
  follow_up_date?: string;
  contact_name?: string;
  opening_hours: string[];
  services: string[];
}

interface Stats {
  queue: number;
  visited: number;
  pitched: number;
  sold: number;
  total_commission: number;
}

const FILTERS = ['all', 'new', 'visited', 'pitched', 'sold'] as const;

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filter, setFilter] = useState<typeof FILTERS[number]>('all');
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('');

  useEffect(() => {
    Promise.all([fetch('/api/stats'), fetch('/api/leads'), fetch('/api/auth/me')])
      .then(([s, l, u]) => Promise.all([s.json(), l.json(), u.json()]))
      .then(([s, l, u]) => {
        setStats(s.data ?? s);
        setLeads(l.data ?? l ?? []);
        setUserName(u.data?.name ?? '');
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = Array.isArray(leads)
    ? filter === 'all' ? leads : leads.filter(l => l.status === filter)
    : [];

  const totalEarned = stats?.total_commission ?? (stats?.sold ?? 0) * 50;

  if (loading) {
    return <div className="pt-20 text-center text-[13px] text-[#666]">Loading...</div>;
  }

  return (
    <div className="py-8 page-enter">
      {/* ── Header row ── */}
      <div className="flex items-baseline justify-between mb-6">
        <div>
          <h1 className="text-[24px] font-semibold text-white tracking-[-0.03em]">Leads</h1>
          <p className="text-[13px] text-[#666] mt-0.5">
            {leads.length} assigned · {'\u00A3'}{totalEarned} earned
          </p>
        </div>
        <p className="text-[13px] text-[#666]">
          {userName && `${userName} · `}{new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
        </p>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-4 gap-px bg-[#333] rounded-lg overflow-hidden mb-8 noise glow-border">
        <StatCell label="Queue" value={stats?.queue ?? 0} />
        <StatCell label="Visited" value={stats?.visited ?? 0} />
        <StatCell label="Pitched" value={stats?.pitched ?? 0} />
        <StatCell label="Sold" value={stats?.sold ?? 0} accent={stats?.sold ? true : false} />
      </div>

      {/* ── Tabs ── */}
      <div className="flex items-center gap-px bg-[#1a1a1a] rounded-lg p-1 mb-6 w-fit">
        {FILTERS.map(f => {
          const count = f === 'all' ? leads.length : leads.filter(l => l.status === f).length;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md text-[13px] transition-all capitalize ${
                filter === f
                  ? 'bg-[#333] text-white shadow-sm'
                  : 'text-[#666] hover:text-[#999]'
              }`}
            >
              {f === 'all' ? 'All' : f}
              <span className="text-[11px] ml-1 text-[#666]">{count}</span>
            </button>
          );
        })}
      </div>

      {/* ── Table ── */}
      {filtered.length > 0 ? (
        <div className="border border-[#333] rounded-lg overflow-hidden glow-border">
          {/* Header */}
          <div className="grid grid-cols-[1fr_100px_80px_80px_60px] gap-4 px-4 py-2.5 text-[12px] text-[#666] border-b border-[#333] bg-[#0a0a0a]">
            <span>Business</span>
            <span>Location</span>
            <span>Rating</span>
            <span>Status</span>
            <span></span>
          </div>

          {/* Rows */}
          {filtered.map((lead, i) => (
            <div
              key={lead.id}
              onClick={() => router.push(`/lead/${lead.id}`)}
              className="grid grid-cols-[1fr_100px_80px_80px_60px] gap-4 px-4 py-3 border-b border-[#222] last:border-0 hover:bg-[#111] cursor-pointer transition-colors group"
              style={{ animation: `rowIn 0.3s ease-out ${i * 0.04}s both` }}
            >
              {/* Business */}
              <div className="min-w-0">
                <p className="text-[14px] text-white font-medium truncate group-hover:text-blue-400 transition-colors">
                  {lead.business_name}
                </p>
                <p className="text-[12px] text-[#666] mt-0.5">{lead.business_type}</p>
              </div>

              {/* Location */}
              <p className="text-[13px] text-[#999] font-mono self-center">{lead.postcode}</p>

              {/* Rating */}
              <p className="text-[13px] text-[#999] self-center">
                {lead.google_rating > 0 ? (
                  <>{lead.google_rating} <span className="text-[#666]">({lead.google_review_count})</span></>
                ) : '—'}
              </p>

              {/* Status */}
              <div className="self-center">
                <span className={`inline-flex items-center gap-1.5 text-[12px] ${
                  lead.status === 'new' ? 'text-blue-400' :
                  lead.status === 'visited' ? 'text-yellow-500' :
                  lead.status === 'pitched' ? 'text-purple-400' :
                  lead.status === 'sold' ? 'text-green-400' :
                  'text-[#666]'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${lead.status === 'new' ? 'pulse-dot ' : ''}${
                    lead.status === 'new' ? 'bg-blue-400' :
                    lead.status === 'visited' ? 'bg-yellow-500' :
                    lead.status === 'pitched' ? 'bg-purple-400' :
                    lead.status === 'sold' ? 'bg-green-400' :
                    'bg-[#666]'
                  }`} />
                  {lead.status}
                </span>
              </div>

              {/* Actions */}
              <div className="self-center text-right">
                {lead.phone && (
                  <a
                    href={`tel:${lead.phone}`}
                    onClick={e => e.stopPropagation()}
                    className="text-[12px] text-blue-400 hover:text-blue-300"
                  >
                    Call
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="border border-[#333] rounded-lg p-12 text-center">
          <p className="text-[14px] text-[#999]">No leads found.</p>
          <p className="text-[13px] text-[#666] mt-1">They appear as the system assigns them.</p>
        </div>
      )}
    </div>
  );
}

function StatCell({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="bg-[#0a0a0a] px-4 py-4">
      <p className={`text-[20px] font-semibold tracking-[-0.02em] font-mono ${accent ? 'text-green-400' : 'text-white'}`}>
        {value}
      </p>
      <p className="text-[12px] text-[#666] mt-1">{label}</p>
    </div>
  );
}
