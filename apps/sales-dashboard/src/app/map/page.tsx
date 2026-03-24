'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, Phone } from 'lucide-react';

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
}

interface AreaGroup {
  postcode_prefix: string;
  leads: Lead[];
  count: number;
}

export default function MapPage() {
  const router = useRouter();
  const [areas, setAreas] = useState<AreaGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/leads')
      .then(r => r.json())
      .then(json => {
        const leads = json.data ?? json ?? [];
        const grouped: Record<string, AreaGroup> = {};
        for (const lead of leads) {
          const prefix = (lead.postcode ?? '??').split(' ')[0];
          if (!grouped[prefix]) grouped[prefix] = { postcode_prefix: prefix, leads: [], count: 0 };
          grouped[prefix].leads.push(lead);
          grouped[prefix].count++;
        }
        setAreas(Object.values(grouped).sort((a, b) => b.count - a.count));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const totalLeads = areas.reduce((s, a) => s + a.count, 0);
  const totalNew = areas.reduce((s, a) => s + a.leads.filter(l => l.status === 'new').length, 0);

  if (loading) {
    return <div className="pt-20 text-center text-[13px] text-[#666]">Loading...</div>;
  }

  return (
    <div className="py-8 page-enter">
      {/* Header */}
      <div className="flex items-baseline justify-between mb-6">
        <div>
          <h1 className="text-[24px] font-semibold text-white tracking-[-0.03em]">Territory</h1>
          <p className="text-[13px] text-[#666] mt-0.5">
            {areas.length} {areas.length === 1 ? 'area' : 'areas'} · {totalLeads} leads · {totalNew} unvisited
          </p>
        </div>
      </div>

      {/* Overview bar */}
      <div className="grid grid-cols-3 gap-px bg-[#333] rounded-lg overflow-hidden mb-8 glow-border">
        <div className="bg-[#0a0a0a] px-4 py-4">
          <p className="text-[20px] font-semibold text-white font-mono">{areas.length}</p>
          <p className="text-[12px] text-[#666] mt-1">Areas</p>
        </div>
        <div className="bg-[#0a0a0a] px-4 py-4">
          <p className="text-[20px] font-semibold text-white font-mono">{totalLeads}</p>
          <p className="text-[12px] text-[#666] mt-1">Total leads</p>
        </div>
        <div className="bg-[#0a0a0a] px-4 py-4">
          <p className="text-[20px] font-semibold text-blue-400 font-mono">{totalNew}</p>
          <p className="text-[12px] text-[#666] mt-1">Unvisited</p>
        </div>
      </div>

      {/* Area table */}
      {areas.length > 0 ? (
        <div className="border border-[#333] rounded-lg overflow-hidden glow-border">
          {areas.map((area, i) => {
            const isOpen = expanded === area.postcode_prefix;
            const newC = area.leads.filter(l => l.status === 'new').length;
            const visitedC = area.leads.filter(l => l.status === 'visited').length;
            const pitchedC = area.leads.filter(l => l.status === 'pitched').length;
            const soldC = area.leads.filter(l => l.status === 'sold').length;
            const total = area.count || 1;

            return (
              <div key={area.postcode_prefix} className={i > 0 ? 'border-t border-[#222]' : ''}>
                {/* Area row */}
                <button
                  onClick={() => setExpanded(isOpen ? null : area.postcode_prefix)}
                  className="w-full flex items-center gap-4 px-4 py-3.5 hover:bg-[#111] transition-colors text-left"
                >
                  {/* Postcode */}
                  <div className="w-12 h-8 rounded bg-[#1a1a1a] flex items-center justify-center shrink-0">
                    <span className="text-[13px] font-semibold text-white font-mono">{area.postcode_prefix}</span>
                  </div>

                  {/* Status bar */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[13px] text-[#999]">{area.count} {area.count === 1 ? 'lead' : 'leads'}</span>
                      <span className="text-[11px] text-[#666]">·</span>
                      {newC > 0 && <span className="text-[11px] text-blue-400">{newC} new</span>}
                      {soldC > 0 && <span className="text-[11px] text-green-400">{soldC} sold</span>}
                    </div>
                    {/* Mini status bar */}
                    <div className="flex h-1 rounded-full overflow-hidden bg-[#222]">
                      {newC > 0 && <div className="bg-blue-400" style={{ width: `${(newC / total) * 100}%` }} />}
                      {visitedC > 0 && <div className="bg-yellow-500" style={{ width: `${(visitedC / total) * 100}%` }} />}
                      {pitchedC > 0 && <div className="bg-purple-400" style={{ width: `${(pitchedC / total) * 100}%` }} />}
                      {soldC > 0 && <div className="bg-green-400" style={{ width: `${(soldC / total) * 100}%` }} />}
                    </div>
                  </div>

                  {/* Expand */}
                  <ChevronDown className={`w-4 h-4 text-[#666] transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Expanded leads */}
                {isOpen && (
                  <div className="border-t border-[#222] bg-[#0a0a0a]">
                    {area.leads.map(lead => (
                      <div
                        key={lead.id}
                        onClick={() => router.push(`/lead/${lead.id}`)}
                        className="flex items-center gap-4 px-4 py-3 pl-8 hover:bg-[#111] cursor-pointer transition-colors border-b border-[#1a1a1a] last:border-0"
                      >
                        {/* Initial */}
                        <div className="w-8 h-8 rounded bg-[#1a1a1a] flex items-center justify-center shrink-0">
                          <span className="text-[12px] font-medium text-[#999]">{lead.business_name.charAt(0)}</span>
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium text-white truncate">{lead.business_name}</p>
                          <p className="text-[11px] text-[#666]">{lead.business_type} · {lead.postcode}</p>
                        </div>

                        {/* Rating */}
                        {lead.google_rating > 0 && (
                          <span className="text-[12px] text-[#999] font-mono shrink-0">
                            {lead.google_rating} <span className="text-[#666]">({lead.google_review_count})</span>
                          </span>
                        )}

                        {/* Status dot */}
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          lead.status === 'new' ? 'bg-blue-400 pulse-dot' :
                          lead.status === 'visited' ? 'bg-yellow-500' :
                          lead.status === 'pitched' ? 'bg-purple-400' :
                          lead.status === 'sold' ? 'bg-green-400' :
                          'bg-[#666]'
                        }`} />

                        {/* Call */}
                        {lead.phone && (
                          <a
                            href={`tel:${lead.phone}`}
                            onClick={e => e.stopPropagation()}
                            className="text-[11px] text-blue-400 hover:text-blue-300 shrink-0"
                          >
                            Call
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="border border-[#333] rounded-lg p-16 text-center">
          <p className="text-[14px] text-[#999]">No leads in your territory yet.</p>
          <p className="text-[13px] text-[#666] mt-1">They appear as the system assigns them to your area.</p>
        </div>
      )}
    </div>
  );
}
