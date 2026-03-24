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
type Filter = typeof FILTERS[number];

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetch('/api/stats'), fetch('/api/leads')])
      .then(([s, l]) => Promise.all([s.json(), l.json()]))
      .then(([s, l]) => {
        setStats(s.data ?? s);
        setLeads(l.data ?? l ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = Array.isArray(leads)
    ? filter === 'all' ? leads : leads.filter(l => l.status === filter)
    : [];

  if (loading) {
    return <div className="pt-20 text-center text-[15px] text-[#86868b]">Loading...</div>;
  }

  return (
    <div className="pt-16 pb-32">
      {/* ── Headline ── */}
      <h1 className="text-[48px] font-semibold text-[#1d1d1f] tracking-[-0.04em] leading-[1.05]">
        Your Leads.
      </h1>
      <p className="text-[21px] font-semibold text-[#86868b] tracking-[-0.02em] mt-1">
        {leads.length} assigned to you.
      </p>

      {/* ── Stats row ── */}
      <div className="flex items-baseline gap-10 mt-10">
        <Stat value={stats?.queue ?? 0} label="Queue" />
        <Stat value={stats?.visited ?? 0} label="Visited" />
        <Stat value={stats?.pitched ?? 0} label="Pitched" />
        <Stat value={stats?.sold ?? 0} label="Sold" color="#0071e3" />
        <Stat value={`\u00A3${stats?.total_commission ?? 0}`} label="Earned" color="#1d1d1f" />
      </div>

      {/* ── Filter tabs ── */}
      <div className="flex items-center gap-1 mt-12 border-b border-[#d2d2d7]/60">
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-3 text-[14px] capitalize transition-colors relative ${
              filter === f
                ? 'text-[#1d1d1f] font-medium'
                : 'text-[#86868b] hover:text-[#1d1d1f]'
            }`}
          >
            {f === 'all' ? 'All leads' : f}
            {filter === f && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#1d1d1f]" />
            )}
          </button>
        ))}
      </div>

      {/* ── Lead cards ── */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
          {filtered.map(lead => (
            <button
              key={lead.id}
              onClick={() => router.push(`/lead/${lead.id}`)}
              className="bg-white rounded-2xl p-6 text-left transition-all hover:scale-[1.01] hover:shadow-sm group"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-[19px] font-semibold text-[#1d1d1f] tracking-[-0.02em] group-hover:text-[#0071e3] transition-colors">
                    {lead.business_name}
                  </h3>
                  <p className="text-[14px] text-[#86868b] mt-0.5">
                    {lead.business_type} · {lead.postcode}
                  </p>
                </div>
                {lead.google_rating > 0 && (
                  <div className="text-right shrink-0">
                    <p className="text-[15px] font-medium text-[#1d1d1f]">
                      ★ {lead.google_rating}
                    </p>
                    <p className="text-[12px] text-[#86868b]">
                      {lead.google_review_count} reviews
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-4">
                {lead.phone && (
                  <a
                    href={`tel:${lead.phone}`}
                    onClick={e => e.stopPropagation()}
                    className="text-[#0071e3] text-[14px] hover:underline"
                  >
                    Call ↗
                  </a>
                )}
                {lead.has_demo_site && (
                  <span className="text-[#0071e3] text-[14px]">
                    Demo ready
                  </span>
                )}
                <span className={`ml-auto text-[12px] font-medium px-2.5 py-0.5 rounded-full ${
                  lead.status === 'new' ? 'bg-[#f5f5f7] text-[#86868b]' :
                  lead.status === 'visited' ? 'bg-[#f5f5f7] text-[#1d1d1f]' :
                  lead.status === 'pitched' ? 'bg-[#f5f5f7] text-[#1d1d1f]' :
                  lead.status === 'sold' ? 'bg-[#e8f5e8] text-[#248a24]' :
                  'bg-[#f5f5f7] text-[#86868b]'
                }`}>
                  {lead.status}
                </span>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="pt-20 text-center">
          <p className="text-[28px] font-semibold text-[#1d1d1f] tracking-[-0.03em]">
            No leads found.
          </p>
          <p className="text-[17px] text-[#86868b] mt-2">
            Leads appear when the pipeline assigns them.
          </p>
        </div>
      )}
    </div>
  );
}

function Stat({ value, label, color }: { value: string | number; label: string; color?: string }) {
  return (
    <div>
      <p className="text-[28px] font-semibold tracking-[-0.03em]" style={{ color: color ?? '#1d1d1f' }}>
        {value}
      </p>
      <p className="text-[12px] text-[#86868b] mt-0.5">{label}</p>
    </div>
  );
}
