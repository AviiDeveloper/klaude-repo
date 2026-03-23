'use client';

import Link from 'next/link';
import type { LeadCard as LeadCardType } from '@/lib/types';
import { LeadStatusBadge } from './LeadStatusBadge';
import { GoogleRating } from './GoogleRating';
import { MapPin, Phone, Monitor } from 'lucide-react';

export function LeadCard({ lead }: { lead: LeadCardType }) {
  return (
    <Link
      href={`/lead/${lead.assignment_id}`}
      className="block bg-sd-bg-card border border-sd-border rounded-xl p-4 card-hover hover:border-sd-accent/30 active:scale-[0.98]"
    >
      {/* Top row: name + status */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-sd-text truncate">{lead.business_name}</h3>
          {lead.business_type && (
            <span className="text-sd-text-muted text-xs capitalize">{lead.business_type}</span>
          )}
        </div>
        <LeadStatusBadge status={lead.assignment_status} />
      </div>

      {/* Rating */}
      <GoogleRating rating={lead.google_rating} reviewCount={lead.google_review_count} compact />

      {/* Bottom row: meta info */}
      <div className="flex items-center gap-3 mt-3 text-sd-text-muted text-xs">
        {lead.postcode && (
          <span className="flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {lead.postcode}
          </span>
        )}
        {lead.phone && (
          <span className="flex items-center gap-1">
            <Phone className="w-3 h-3" />
            {lead.phone.length > 13 ? lead.phone.slice(0, 13) + '\u2026' : lead.phone}
          </span>
        )}
        {lead.has_demo_site && (
          <span className="flex items-center gap-1 text-sd-green">
            <Monitor className="w-3 h-3" />
            Demo
          </span>
        )}
      </div>
    </Link>
  );
}
