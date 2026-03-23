'use client';

import { useEffect, useState } from 'react';
import type { LeadCard as LeadCardType } from '@/lib/types';
import { Navigation, MapPin, Loader2, ExternalLink, Star } from 'lucide-react';
import Link from 'next/link';

const STATUS_STYLES: Record<string, string> = {
  new: 'text-blue-700 bg-blue-50',
  visited: 'text-amber-700 bg-amber-50',
  pitched: 'text-violet-700 bg-violet-50',
  sold: 'text-emerald-700 bg-emerald-50',
  rejected: 'text-slate-500 bg-slate-100',
};

export default function MapPage() {
  const [leads, setLeads] = useState<LeadCardType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/leads')
      .then((r) => r.json())
      .then((d) => setLeads(d.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  // Group by postcode
  const grouped = leads.reduce<Record<string, LeadCardType[]>>((acc, lead) => {
    const key = lead.postcode ?? 'Unknown';
    if (!acc[key]) acc[key] = [];
    acc[key].push(lead);
    return acc;
  }, {});

  const postcodes = Object.keys(grouped).sort();

  return (
    <>
      {/* Header */}
      <div className="px-6 md:px-8 py-5 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[15px] font-semibold text-slate-900">Map</h1>
            <p className="text-[11px] text-slate-400 mt-0.5">{leads.length} leads across {postcodes.length} areas</p>
          </div>
          {leads.length > 0 && (
            <a
              href={`https://www.google.com/maps/dir/${leads.filter((l) => l.address).map((l) => encodeURIComponent(l.address ?? l.postcode ?? '')).join('/')}`}
              target="_blank"
              rel="noopener"
              className="flex items-center gap-1.5 text-[12px] font-medium text-slate-700 border border-slate-200 rounded-lg py-2 px-3 hover:bg-slate-50 transition-colors"
            >
              <Navigation className="w-3 h-3" />
              Route all
            </a>
          )}
        </div>
      </div>

      <div className="px-6 md:px-8 py-5">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-5 h-5 text-slate-300 animate-spin" />
          </div>
        ) : postcodes.length === 0 ? (
          <p className="text-[13px] text-slate-400 text-center py-20">No leads assigned yet</p>
        ) : (
          <div className="space-y-8">
            {postcodes.map((postcode) => (
              <div key={postcode}>
                {/* Postcode header */}
                <div className="flex items-center gap-2 mb-3">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.08em]">{postcode}</h3>
                  <span className="text-[10px] text-slate-300">{grouped[postcode].length} leads</span>
                </div>

                {/* Leads table for this area */}
                <div className="border border-slate-100 rounded-xl overflow-hidden">
                  {grouped[postcode].map((lead, i) => (
                    <div key={lead.assignment_id} className={`flex items-center gap-4 px-4 py-3 hover:bg-slate-50/50 transition-colors ${i > 0 ? 'border-t border-slate-50' : ''}`}>
                      <Link href={`/lead/${lead.assignment_id}`} className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[13px] font-medium text-slate-900 truncate">{lead.business_name}</span>
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[lead.assignment_status] ?? ''}`}>
                            {lead.assignment_status}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                          {lead.business_type && <span className="capitalize">{lead.business_type}</span>}
                          {lead.google_rating && (
                            <>
                              <span className="text-slate-200">·</span>
                              <span className="inline-flex items-center gap-0.5">
                                <Star className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />
                                {lead.google_rating}
                              </span>
                            </>
                          )}
                        </div>
                      </Link>

                      {/* Directions */}
                      <a
                        href={`https://maps.google.com/?q=${encodeURIComponent(lead.address ?? lead.postcode ?? '')}`}
                        target="_blank"
                        rel="noopener"
                        className="p-2 rounded-lg hover:bg-slate-100 transition-colors flex-shrink-0"
                        title="Get directions"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
