'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Phone, Clock, MapPin } from 'lucide-react';

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
    Promise.all([
      fetch('/api/stats'),
      fetch('/api/leads'),
      fetch('/api/auth/me'),
    ])
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

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const newLeads = leads.filter(l => l.status === 'new');
  const totalEarned = stats?.total_commission ?? (stats?.sold ?? 0) * 50;
  const nextLead = newLeads[0];

  if (loading) {
    return (
      <div className="pt-24 text-center">
        <div className="w-6 h-6 border-2 border-[#d2d2d7] border-t-[#1d1d1f] rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  return (
    <div className="pt-10 pb-32">

      {/* ═══ HERO — personal, motivating ═══ */}
      <div className="mb-12">
        <p className="text-[15px] text-[#86868b]">
          {greeting}{userName ? `, ${userName}` : ''} · {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>

        {totalEarned > 0 ? (
          <h1 className="text-[56px] font-semibold text-[#1d1d1f] tracking-[-0.04em] leading-[1.05] mt-2">
            {'\u00A3'}{totalEarned} earned.
          </h1>
        ) : newLeads.length > 0 ? (
          <h1 className="text-[56px] font-semibold text-[#1d1d1f] tracking-[-0.04em] leading-[1.05] mt-2">
            {newLeads.length} {newLeads.length === 1 ? 'business is' : 'businesses are'} waiting.
          </h1>
        ) : (
          <h1 className="text-[56px] font-semibold text-[#1d1d1f] tracking-[-0.04em] leading-[1.05] mt-2">
            Your first {'\u00A3'}50 is one visit away.
          </h1>
        )}
      </div>

      {/* ═══ NEXT UP — the one lead they should visit right now ═══ */}
      {nextLead && (
        <button
          onClick={() => router.push(`/lead/${nextLead.id}`)}
          className="w-full bg-[#1d1d1f] text-white rounded-2xl p-7 text-left mb-8 group transition-transform active:scale-[0.99]"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px] text-[#86868b] mb-1">Next up</p>
              <h2 className="text-[28px] font-semibold tracking-[-0.03em] leading-tight">
                {nextLead.business_name}
              </h2>
              <p className="text-[15px] text-[#a1a1a6] mt-1">
                {nextLead.business_type} · {nextLead.postcode}
                {nextLead.google_rating > 0 && ` · ★ ${nextLead.google_rating}`}
              </p>
            </div>
            <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors shrink-0">
              <ArrowRight className="w-5 h-5 text-white" />
            </div>
          </div>

          <div className="flex items-center gap-5 mt-5 pt-5 border-t border-white/10">
            {nextLead.phone && (
              <span className="flex items-center gap-1.5 text-[13px] text-[#a1a1a6]">
                <Phone className="w-3.5 h-3.5" /> {nextLead.phone}
              </span>
            )}
            {nextLead.opening_hours?.[0] && (
              <span className="flex items-center gap-1.5 text-[13px] text-[#a1a1a6]">
                <Clock className="w-3.5 h-3.5" /> {nextLead.opening_hours[0]}
              </span>
            )}
            {nextLead.has_demo_site && (
              <span className="text-[13px] text-[#0071e3]">Demo ready</span>
            )}
          </div>
        </button>
      )}

      {/* ═══ MOMENTUM — progress this week ═══ */}
      <div className="grid grid-cols-4 gap-3 mb-10">
        <MomentumCard value={stats?.queue ?? 0} label="In queue" />
        <MomentumCard value={stats?.visited ?? 0} label="Visited" />
        <MomentumCard value={stats?.pitched ?? 0} label="Pitched" />
        <MomentumCard value={stats?.sold ?? 0} label="Sold" highlight />
      </div>

      {/* ═══ FILTER + LIST ═══ */}
      <div className="flex items-center gap-1 border-b border-[#d2d2d7]/60">
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-3 text-[14px] capitalize relative transition-colors ${
              filter === f
                ? 'text-[#1d1d1f] font-medium'
                : 'text-[#86868b] hover:text-[#1d1d1f]'
            }`}
          >
            {f === 'all' ? `All (${leads.length})` : `${f} (${leads.filter(l => l.status === f).length})`}
            {filter === f && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#1d1d1f]" />
            )}
          </button>
        ))}
      </div>

      {/* ═══ LEAD CARDS ═══ */}
      {filtered.length > 0 ? (
        <div className="mt-6 space-y-3">
          {filtered.map((lead, i) => (
            <button
              key={lead.id}
              onClick={() => router.push(`/lead/${lead.id}`)}
              className="w-full bg-white rounded-2xl p-6 text-left transition-all hover:shadow-sm group flex items-center gap-5"
              style={{ animation: `fadeUp 0.4s ease-out ${i * 0.05}s both` }}
            >
              {/* Left: initial */}
              <div className="w-11 h-11 rounded-xl bg-[#f5f5f7] flex items-center justify-center shrink-0">
                <span className="text-[17px] font-semibold text-[#1d1d1f]">
                  {lead.business_name.charAt(0)}
                </span>
              </div>

              {/* Middle: info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <h3 className="text-[17px] font-semibold text-[#1d1d1f] tracking-[-0.02em] truncate group-hover:text-[#0071e3] transition-colors">
                    {lead.business_name}
                  </h3>
                  {lead.follow_up_date && (
                    <span className="text-[11px] text-[#0071e3] shrink-0">Follow up</span>
                  )}
                </div>
                <p className="text-[14px] text-[#86868b] mt-0.5">
                  {lead.business_type} · {lead.postcode}
                  {lead.contact_name && ` · ${lead.contact_name}`}
                </p>
              </div>

              {/* Right: rating + status */}
              <div className="text-right shrink-0">
                {lead.google_rating > 0 && (
                  <p className="text-[15px] font-medium text-[#1d1d1f]">
                    {lead.google_rating}<span className="text-[#86868b] font-normal text-[13px]"> ({lead.google_review_count})</span>
                  </p>
                )}
                <p className={`text-[12px] mt-0.5 ${
                  lead.status === 'sold' ? 'text-[#248a24] font-medium' :
                  lead.status === 'new' ? 'text-[#0071e3]' :
                  'text-[#86868b]'
                }`}>
                  {lead.status}
                </p>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="pt-16 text-center">
          <p className="text-[21px] font-semibold text-[#1d1d1f] tracking-[-0.02em]">
            No leads here yet.
          </p>
          <p className="text-[15px] text-[#86868b] mt-1">
            They&apos;ll appear as the system finds businesses in your area.
          </p>
        </div>
      )}

      <style jsx>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

function MomentumCard({ value, label, highlight }: { value: number; label: string; highlight?: boolean }) {
  return (
    <div className="bg-white rounded-2xl p-5 text-center">
      <p className={`text-[32px] font-semibold tracking-[-0.03em] leading-none ${
        highlight && value > 0 ? 'text-[#248a24]' : 'text-[#1d1d1f]'
      }`}>
        {value}
      </p>
      <p className="text-[12px] text-[#86868b] mt-2">{label}</p>
    </div>
  );
}
