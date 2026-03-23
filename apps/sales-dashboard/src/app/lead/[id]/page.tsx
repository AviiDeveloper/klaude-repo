'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { LeadDetail, TalkingPoint, AssignmentStatus } from '@/lib/types';
import { generateTalkingPoints } from '@/lib/intel';
import { TalkingPoints } from '@/components/TalkingPoints';
import { ActionButtons } from '@/components/ActionButtons';
import { GoogleRating } from '@/components/GoogleRating';
import { LeadStatusBadge } from '@/components/LeadStatusBadge';
import {
  ArrowLeft, MapPin, Phone, Mail, Globe, Clock,
  ExternalLink, Loader2, Monitor, Star, ChevronRight,
} from 'lucide-react';
import clsx from 'clsx';

export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [talkingPoints, setTalkingPoints] = useState<TalkingPoint[]>([]);

  useEffect(() => {
    async function fetchLead() {
      const res = await fetch(`/api/leads/${params.id}`);
      if (res.ok) {
        const data = await res.json();
        const leadData = data.data as LeadDetail;
        setLead(leadData);
        setTalkingPoints(generateTalkingPoints(leadData));
      }
      setLoading(false);
    }
    fetchLead();
  }, [params.id]);

  function handleStatusChange(newStatus: AssignmentStatus) {
    if (lead) {
      setLead({ ...lead, assignment_status: newStatus });
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-sd-accent animate-spin" />
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sd-text-muted">Lead not found</p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-4 pb-8 space-y-4">
      {/* Back + Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-lg bg-sd-bg-card border border-sd-border text-sd-text-muted"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-lg text-sd-text truncate">{lead.business_name}</h1>
          <div className="flex items-center gap-2">
            {lead.business_type && (
              <span className="text-sd-text-muted text-xs capitalize">{lead.business_type}</span>
            )}
            <LeadStatusBadge status={lead.assignment_status} />
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <ActionButtons
        assignmentId={lead.assignment_id}
        currentStatus={lead.assignment_status}
        onStatusChange={handleStatusChange}
      />

      {/* Demo Site CTA */}
      {lead.has_demo_site && lead.demo_site_domain && (
        <a
          href={`/api/files?lead=${lead.lead_id}&file=site.html`}
          target="_blank"
          rel="noopener"
          className="flex items-center gap-3 bg-sd-accent/10 border border-sd-accent/30 rounded-xl px-4 py-3.5 text-sd-accent font-semibold text-sm transition-all active:scale-[0.98]"
        >
          <Monitor className="w-5 h-5" />
          <span className="flex-1">Show Demo Site</span>
          <ExternalLink className="w-4 h-4 opacity-50" />
        </a>
      )}

      {/* Talking Points */}
      <TalkingPoints points={talkingPoints} />

      {/* Business Info Card */}
      <div className="bg-sd-bg-card border border-sd-border rounded-xl divide-y divide-sd-border">
        {/* Rating */}
        {lead.google_rating && (
          <div className="px-4 py-3 flex items-center justify-between">
            <span className="text-sd-text-muted text-sm">Google Rating</span>
            <GoogleRating rating={lead.google_rating} reviewCount={lead.google_review_count} />
          </div>
        )}

        {/* Address */}
        {lead.address && (
          <a
            href={`https://maps.google.com/?q=${encodeURIComponent(lead.address)}`}
            target="_blank"
            rel="noopener"
            className="flex items-center gap-3 px-4 py-3 hover:bg-sd-bg-elevated/50 transition-colors"
          >
            <MapPin className="w-4 h-4 text-sd-text-muted flex-shrink-0" />
            <span className="text-sm text-sd-text flex-1">{lead.address}</span>
            <ChevronRight className="w-4 h-4 text-sd-text-muted/30" />
          </a>
        )}

        {/* Phone */}
        {lead.phone && (
          <a
            href={`tel:${lead.phone}`}
            className="flex items-center gap-3 px-4 py-3 hover:bg-sd-bg-elevated/50 transition-colors"
          >
            <Phone className="w-4 h-4 text-sd-text-muted flex-shrink-0" />
            <span className="text-sm text-sd-text flex-1">{lead.phone}</span>
            <ChevronRight className="w-4 h-4 text-sd-text-muted/30" />
          </a>
        )}

        {/* Email */}
        {lead.email && (
          <a
            href={`mailto:${lead.email}`}
            className="flex items-center gap-3 px-4 py-3 hover:bg-sd-bg-elevated/50 transition-colors"
          >
            <Mail className="w-4 h-4 text-sd-text-muted flex-shrink-0" />
            <span className="text-sm text-sd-text flex-1">{lead.email}</span>
            <ChevronRight className="w-4 h-4 text-sd-text-muted/30" />
          </a>
        )}

        {/* Website */}
        {lead.website_url && (
          <a
            href={lead.website_url}
            target="_blank"
            rel="noopener"
            className="flex items-center gap-3 px-4 py-3 hover:bg-sd-bg-elevated/50 transition-colors"
          >
            <Globe className="w-4 h-4 text-sd-text-muted flex-shrink-0" />
            <span className="text-sm text-sd-text flex-1 truncate">{lead.website_url}</span>
            <ChevronRight className="w-4 h-4 text-sd-text-muted/30" />
          </a>
        )}
      </div>

      {/* Opening Hours */}
      {lead.opening_hours.length > 0 && (
        <div className="bg-sd-bg-card border border-sd-border rounded-xl p-4">
          <h3 className="text-xs font-semibold text-sd-text-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            Opening Hours
          </h3>
          <div className="space-y-1">
            {lead.opening_hours.map((h, i) => (
              <div key={i} className="text-sm text-sd-text">{h}</div>
            ))}
          </div>
        </div>
      )}

      {/* Services */}
      {lead.services.length > 0 && (
        <div className="bg-sd-bg-card border border-sd-border rounded-xl p-4">
          <h3 className="text-xs font-semibold text-sd-text-muted uppercase tracking-wider mb-2">
            Services
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {lead.services.map((s, i) => (
              <span
                key={i}
                className="bg-sd-bg-elevated border border-sd-border rounded-lg px-2.5 py-1 text-xs text-sd-text"
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Best Reviews */}
      {lead.best_reviews.length > 0 && (
        <div className="bg-sd-bg-card border border-sd-border rounded-xl p-4">
          <h3 className="text-xs font-semibold text-sd-text-muted uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Star className="w-3.5 h-3.5" />
            Customer Reviews
          </h3>
          <div className="space-y-3">
            {lead.best_reviews.slice(0, 3).map((review, i) => (
              <div key={i} className="bg-sd-bg-elevated rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex gap-0.5">
                    {Array.from({ length: review.rating }).map((_, j) => (
                      <Star key={j} className="w-3 h-3 fill-sd-gold text-sd-gold" />
                    ))}
                  </div>
                  <span className="text-xs text-sd-text-muted">{review.author}</span>
                </div>
                <p className="text-sm text-sd-text/80 italic leading-snug">
                  &ldquo;{review.text.length > 150 ? review.text.slice(0, 150) + '\u2026' : review.text}&rdquo;
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Description */}
      {lead.description && (
        <div className="bg-sd-bg-card border border-sd-border rounded-xl p-4">
          <h3 className="text-xs font-semibold text-sd-text-muted uppercase tracking-wider mb-2">
            About
          </h3>
          <p className="text-sm text-sd-text/80 leading-relaxed">{lead.description}</p>
        </div>
      )}
    </div>
  );
}
