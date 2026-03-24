'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { ChevronDown, Phone, Navigation, ExternalLink } from 'lucide-react';

// Lazy-load map to avoid SSR issues with Leaflet
const LeafletMap = dynamic(() => import('@/components/LeafletMap'), { ssr: false });

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
  lat?: number;
  lng?: number;
}

interface AreaGroup {
  postcode_prefix: string;
  leads: Lead[];
  count: number;
}

// UK postcode approximate coords (for demo — in production, geocode from pipeline)
const POSTCODE_COORDS: Record<string, [number, number]> = {
  'M1': [53.4808, -2.2426], 'M2': [53.4793, -2.2467], 'M3': [53.4838, -2.2530],
  'M4': [53.4850, -2.2350], 'M5': [53.4740, -2.2680], 'M6': [53.4900, -2.2800],
  'M7': [53.5020, -2.2700], 'M8': [53.5100, -2.2400], 'M9': [53.5200, -2.2200],
  'LS1': [53.7997, -1.5492], 'LS2': [53.7950, -1.5450],
  'B1': [52.4862, -1.8904], 'L1': [53.4084, -2.9916],
};

export default function MapPage() {
  const router = useRouter();
  const [areas, setAreas] = useState<AreaGroup[]>([]);
  const [allLeads, setAllLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [view, setView] = useState<'map' | 'list'>('map');

  useEffect(() => {
    fetch('/api/leads')
      .then(r => r.json())
      .then(json => {
        const leads: Lead[] = (json.data ?? json ?? []).map((l: Lead) => {
          // Assign approximate coords from postcode
          const prefix = (l.postcode ?? '??').split(' ')[0];
          const coords = POSTCODE_COORDS[prefix];
          return {
            ...l,
            id: l.id ?? (l as any).assignment_id ?? (l as any).lead_id,
            status: l.status ?? (l as any).assignment_status,
            lat: l.lat ?? (coords ? coords[0] + (Math.random() - 0.5) * 0.005 : undefined),
            lng: l.lng ?? (coords ? coords[1] + (Math.random() - 0.5) * 0.005 : undefined),
          };
        });
        setAllLeads(leads);

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

  // Leads with coords for the map
  const mappableLeads = useMemo(() => allLeads.filter(l => l.lat && l.lng), [allLeads]);

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

        {/* View toggle */}
        <div className="flex items-center gap-px bg-[#1a1a1a] rounded-lg p-1">
          <button
            onClick={() => setView('map')}
            className={`px-3 py-1.5 rounded-md text-[13px] transition-all ${view === 'map' ? 'bg-[#333] text-white' : 'text-[#666] hover:text-[#999]'}`}
          >
            Map
          </button>
          <button
            onClick={() => setView('list')}
            className={`px-3 py-1.5 rounded-md text-[13px] transition-all ${view === 'list' ? 'bg-[#333] text-white' : 'text-[#666] hover:text-[#999]'}`}
          >
            List
          </button>
        </div>
      </div>

      {/* ═══ MAP VIEW ═══ */}
      {view === 'map' && (
        <div className="border border-[#333] rounded-lg overflow-hidden glow-border mb-6">
          <div className="h-[400px] md:h-[500px]">
            {mappableLeads.length > 0 ? (
              <LeafletMap
                leads={mappableLeads}
                onLeadClick={(id) => router.push(`/lead/${id}`)}
              />
            ) : (
              <div className="h-full flex items-center justify-center bg-[#0a0a0a]">
                <p className="text-[13px] text-[#666]">No location data available</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ LIST VIEW / Below map ═══ */}
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
                <button
                  onClick={() => setExpanded(isOpen ? null : area.postcode_prefix)}
                  className="w-full flex items-center gap-4 px-4 py-3.5 hover:bg-[#111] transition-colors text-left"
                >
                  <div className="w-12 h-8 rounded bg-[#1a1a1a] flex items-center justify-center shrink-0">
                    <span className="text-[13px] font-semibold text-white font-mono">{area.postcode_prefix}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[13px] text-[#999]">{area.count} {area.count === 1 ? 'lead' : 'leads'}</span>
                      {newC > 0 && <span className="text-[11px] text-blue-400">{newC} new</span>}
                      {soldC > 0 && <span className="text-[11px] text-green-400">{soldC} sold</span>}
                    </div>
                    <div className="flex h-1 rounded-full overflow-hidden bg-[#222]">
                      {newC > 0 && <div className="bg-blue-400" style={{ width: `${(newC / total) * 100}%` }} />}
                      {visitedC > 0 && <div className="bg-yellow-500" style={{ width: `${(visitedC / total) * 100}%` }} />}
                      {pitchedC > 0 && <div className="bg-purple-400" style={{ width: `${(pitchedC / total) * 100}%` }} />}
                      {soldC > 0 && <div className="bg-green-400" style={{ width: `${(soldC / total) * 100}%` }} />}
                    </div>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-[#666] transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
                </button>

                {isOpen && (
                  <div className="border-t border-[#222] bg-[#0a0a0a]">
                    {area.leads.map(lead => (
                      <div
                        key={lead.id}
                        className="flex items-center gap-3 px-4 py-3 pl-8 hover:bg-[#111] transition-colors border-b border-[#1a1a1a] last:border-0"
                      >
                        <div className="w-8 h-8 rounded bg-[#1a1a1a] flex items-center justify-center shrink-0">
                          <span className="text-[12px] font-medium text-[#999]">{lead.business_name.charAt(0)}</span>
                        </div>
                        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => router.push(`/lead/${lead.id}`)}>
                          <p className="text-[13px] font-medium text-white truncate hover:text-blue-400 transition-colors">{lead.business_name}</p>
                          <p className="text-[11px] text-[#666]">{lead.business_type} · {lead.postcode}</p>
                        </div>
                        {lead.google_rating > 0 && (
                          <span className="text-[12px] text-[#999] font-mono shrink-0">{lead.google_rating}</span>
                        )}
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          lead.status === 'new' ? 'bg-blue-400 pulse-dot' :
                          lead.status === 'visited' ? 'bg-yellow-500' :
                          lead.status === 'pitched' ? 'bg-purple-400' :
                          lead.status === 'sold' ? 'bg-green-400' : 'bg-[#666]'
                        }`} />
                        {/* Directions */}
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(lead.postcode)}`}
                          target="_blank"
                          rel="noopener"
                          onClick={e => e.stopPropagation()}
                          className="text-[11px] text-blue-400 hover:text-blue-300 shrink-0 flex items-center gap-1"
                        >
                          <Navigation className="w-3 h-3" />
                          Route
                        </a>
                        {lead.phone && (
                          <a href={`tel:${lead.phone}`} onClick={e => e.stopPropagation()} className="text-[11px] text-blue-400 hover:text-blue-300 shrink-0">
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
        </div>
      )}
    </div>
  );
}
