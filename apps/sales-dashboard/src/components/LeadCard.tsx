'use client';

import Link from 'next/link';
import type { LeadCard as LeadCardType } from '@/lib/types';
import { LeadStatusBadge } from './LeadStatusBadge';
import { GoogleRating } from './GoogleRating';
import { MapPin, ChevronRight } from 'lucide-react';

export function LeadCard({ lead }: { lead: LeadCardType }) {
  return (
    <Link
      href={`/lead/${lead.assignment_id}`}
      className="flex items-center gap-3 py-3 border-b border-border-light last:border-b-0 group"
    >
      {/* Left: info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <h3 className="text-sm font-semibold text-primary truncate">{lead.business_name}</h3>
          <LeadStatusBadge status={lead.assignment_status} />
        </div>
        <div className="flex items-center gap-2 text-xs text-muted">
          {lead.business_type && (
            <span className="capitalize">{lead.business_type}</span>
          )}
          {lead.postcode && (
            <>
              <span className="text-border">&middot;</span>
              <span className="inline-flex items-center gap-0.5">
                <MapPin className="w-2.5 h-2.5" />
                {lead.postcode}
              </span>
            </>
          )}
          {lead.google_rating && (
            <>
              <span className="text-border">&middot;</span>
              <GoogleRating rating={lead.google_rating} reviewCount={lead.google_review_count} compact />
            </>
          )}
        </div>
      </div>

      {/* Right: chevron */}
      <ChevronRight className="w-4 h-4 text-faint group-hover:text-muted transition-colors flex-shrink-0" />
    </Link>
  );
}
