'use client';

import Link from 'next/link';
import type { LeadCard as LeadCardType } from '@/lib/types';
import { MapPin, ChevronRight, Star, MonitorSmartphone } from 'lucide-react';

const STATUS_DOT: Record<string, string> = {
  new: 'bg-blue-500',
  visited: 'bg-amber-500',
  pitched: 'bg-violet-500',
  sold: 'bg-emerald-500',
  rejected: 'bg-slate-300',
};

export function LeadCard({ lead }: { lead: LeadCardType }) {
  const hasDemo = !!lead.demo_site_domain;

  return (
    <Link
      href={`/lead/${lead.assignment_id}`}
      className="flex items-center gap-3 py-3.5 border-b border-slate-50 last:border-b-0 active:bg-slate-50 transition-colors"
    >
      {/* Status indicator */}
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT[lead.assignment_status] ?? 'bg-slate-300'}`} />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="text-[14px] font-semibold text-primary truncate leading-tight">{lead.business_name}</h3>
          {hasDemo && <MonitorSmartphone className="w-3 h-3 text-emerald-500 flex-shrink-0" />}
        </div>
        <div className="flex items-center gap-1.5 mt-1">
          {lead.business_type && (
            <span className="text-[11px] text-muted capitalize">{lead.business_type}</span>
          )}
          {lead.postcode && (
            <>
              <span className="text-slate-200">·</span>
              <span className="text-[11px] text-muted inline-flex items-center gap-0.5">
                <MapPin className="w-2.5 h-2.5" />
                {lead.postcode}
              </span>
            </>
          )}
          {lead.google_rating && (
            <>
              <span className="text-slate-200">·</span>
              <span className="text-[11px] text-muted inline-flex items-center gap-0.5">
                <Star className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />
                {lead.google_rating}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Arrow */}
      <ChevronRight className="w-4 h-4 text-slate-200 flex-shrink-0" />
    </Link>
  );
}
