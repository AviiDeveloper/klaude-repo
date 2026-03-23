'use client';

import { useEffect, useState } from 'react';
import type { LeadCard as LeadCardType } from '@/lib/types';
import { LeadStatusBadge } from '@/components/LeadStatusBadge';
import { BottomNav } from '@/components/BottomNav';
import { GoogleRating } from '@/components/GoogleRating';
import { Navigation, MapPin, Loader2, ExternalLink } from 'lucide-react';
import Link from 'next/link';

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
    <div className="min-h-screen pb-16">
      <div className="max-w-lg mx-auto px-4 pt-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-bold text-primary tracking-tight">Map</h1>
            <p className="text-xs text-muted mt-0.5">Leads by area</p>
          </div>
          {leads.length > 0 && (
            <a
              href={`https://www.google.com/maps/dir/${leads.filter((l) => l.address).map((l) => encodeURIComponent(l.address ?? l.postcode ?? '')).join('/')}`}
              target="_blank"
              rel="noopener"
              className="flex items-center gap-1.5 text-xs font-medium text-primary border border-border rounded-md py-1.5 px-2.5 hover:bg-surface transition-colors"
            >
              <Navigation className="w-3 h-3" />
              Route all
            </a>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-5 h-5 text-muted animate-spin" />
          </div>
        ) : postcodes.length === 0 ? (
          <p className="text-sm text-muted text-center py-16">No leads assigned yet</p>
        ) : (
          <div className="space-y-6">
            {postcodes.map((postcode) => (
              <div key={postcode}>
                {/* Postcode header */}
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="w-3.5 h-3.5 text-muted" />
                  <h3 className="text-xs font-semibold text-muted uppercase tracking-widest">{postcode}</h3>
                  <span className="text-2xs text-faint">{grouped[postcode].length} leads</span>
                </div>

                {/* Leads in this area */}
                <div className="divide-y divide-border-light">
                  {grouped[postcode].map((lead) => (
                    <div key={lead.assignment_id} className="flex items-center gap-3 py-2.5">
                      <Link
                        href={`/lead/${lead.assignment_id}`}
                        className="flex-1 min-w-0"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-primary truncate">{lead.business_name}</span>
                          <LeadStatusBadge status={lead.assignment_status} />
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {lead.business_type && (
                            <span className="text-2xs text-muted capitalize">{lead.business_type}</span>
                          )}
                          {lead.google_rating && (
                            <>
                              <span className="text-border">&middot;</span>
                              <GoogleRating rating={lead.google_rating} reviewCount={null} compact />
                            </>
                          )}
                        </div>
                      </Link>

                      {/* Directions link */}
                      <a
                        href={`https://maps.google.com/?q=${encodeURIComponent(lead.address ?? lead.postcode ?? '')}`}
                        target="_blank"
                        rel="noopener"
                        className="p-2 rounded-md hover:bg-surface transition-colors flex-shrink-0"
                        title="Get directions"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-faint" />
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
