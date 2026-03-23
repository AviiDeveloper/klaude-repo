'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { LeadDetail, TalkingPoint, AssignmentStatus } from '@/lib/types';
import { generateTalkingPoints } from '@/lib/intel';
import { TalkingPoints } from '@/components/TalkingPoints';
import { ActionButtons } from '@/components/ActionButtons';
import { GoogleRating } from '@/components/GoogleRating';
import { LeadStatusBadge } from '@/components/LeadStatusBadge';
import { DemoViewer, PriceBreakdown } from '@/components/PitchTools';
import { ObjectionHandler } from '@/components/ObjectionHandler';
import {
  ArrowLeft, MapPin, Phone, Mail, Globe, Clock,
  ExternalLink, Loader2, Star, ChevronRight, Monitor, MapPinned,
} from 'lucide-react';

export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [talkingPoints, setTalkingPoints] = useState<TalkingPoint[]>([]);
  const [showDemo, setShowDemo] = useState(false);

  useEffect(() => {
    async function fetchLead() {
      const res = await fetch(`/api/leads/${params.id}`);
      if (res.ok) {
        const data = await res.json();
        const ld = data.data as LeadDetail;
        setLead(ld);
        setTalkingPoints(generateTalkingPoints(ld));
      }
      setLoading(false);
    }
    fetchLead();
  }, [params.id]);

  function handleStatusChange(newStatus: AssignmentStatus) {
    if (lead) setLead({ ...lead, assignment_status: newStatus });
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-5 h-5 text-muted animate-spin" />
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-muted">Lead not found</p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-4 pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={() => router.back()}
          className="p-1.5 -ml-1.5 rounded-md hover:bg-surface transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-muted" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-primary truncate">{lead.business_name}</h1>
          <div className="flex items-center gap-2 text-xs text-muted">
            {lead.business_type && <span className="capitalize">{lead.business_type}</span>}
            <LeadStatusBadge status={lead.assignment_status} />
          </div>
        </div>
      </div>

      {/* Action */}
      <div className="mb-5">
        <ActionButtons
          assignmentId={lead.assignment_id}
          currentStatus={lead.assignment_status}
          onStatusChange={handleStatusChange}
        />
      </div>

      {/* Demo Site — full-screen viewer */}
      {lead.has_demo_site && lead.demo_site_domain && (
        <>
          {showDemo && (
            <DemoViewer
              domain={lead.demo_site_domain}
              businessName={lead.business_name}
              onClose={() => setShowDemo(false)}
            />
          )}
          <button
            onClick={() => setShowDemo(true)}
            className="w-full flex items-center justify-between py-2.5 px-3 mb-5 border border-border rounded-lg text-sm font-medium text-primary hover:bg-surface transition-colors"
          >
            <div className="flex items-center gap-2">
              <Monitor className="w-4 h-4 text-muted" />
              <span>Show demo to client</span>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-muted" />
          </button>
        </>
      )}

      {/* Talking Points */}
      <div className="mb-6 pb-6 border-b border-border-light">
        <TalkingPoints points={talkingPoints} />
      </div>

      {/* Pitch Tools */}
      <div className="mb-6 pb-6 border-b border-border-light space-y-3">
        <PriceBreakdown />
        <ObjectionHandler />
      </div>

      {/* Business Info */}
      <div className="mb-6">
        <h4 className="text-2xs font-semibold text-muted uppercase tracking-widest mb-3">Details</h4>
        <div className="space-y-0 divide-y divide-border-light">
          {lead.google_rating && (
            <div className="flex items-center justify-between py-2.5">
              <span className="text-sm text-muted">Google</span>
              <GoogleRating rating={lead.google_rating} reviewCount={lead.google_review_count} />
            </div>
          )}

          {lead.address && (
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(lead.address)}`}
              target="_blank"
              rel="noopener"
              className="flex items-center justify-between py-2.5 group"
            >
              <div className="flex items-center gap-2 text-sm text-primary">
                <MapPin className="w-3.5 h-3.5 text-faint" />
                {lead.address}
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-faint group-hover:text-muted" />
            </a>
          )}

          {lead.phone && (
            <a href={`tel:${lead.phone}`} className="flex items-center justify-between py-2.5 group">
              <div className="flex items-center gap-2 text-sm text-primary">
                <Phone className="w-3.5 h-3.5 text-faint" />
                {lead.phone}
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-faint group-hover:text-muted" />
            </a>
          )}

          {lead.email && (
            <a href={`mailto:${lead.email}`} className="flex items-center justify-between py-2.5 group">
              <div className="flex items-center gap-2 text-sm text-primary">
                <Mail className="w-3.5 h-3.5 text-faint" />
                {lead.email}
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-faint group-hover:text-muted" />
            </a>
          )}

          {lead.website_url && (
            <a href={lead.website_url} target="_blank" rel="noopener" className="flex items-center justify-between py-2.5 group">
              <div className="flex items-center gap-2 text-sm text-primary truncate">
                <Globe className="w-3.5 h-3.5 text-faint flex-shrink-0" />
                <span className="truncate">{lead.website_url}</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-faint group-hover:text-muted flex-shrink-0" />
            </a>
          )}
        </div>
      </div>

      {/* Hours */}
      {lead.opening_hours.length > 0 && (
        <div className="mb-6">
          <h4 className="text-2xs font-semibold text-muted uppercase tracking-widest mb-2">Hours</h4>
          <div className="space-y-0.5">
            {lead.opening_hours.map((h, i) => (
              <p key={i} className="text-sm text-secondary">{h}</p>
            ))}
          </div>
        </div>
      )}

      {/* Services */}
      {lead.services.length > 0 && (
        <div className="mb-6">
          <h4 className="text-2xs font-semibold text-muted uppercase tracking-widest mb-2">Services</h4>
          <div className="flex flex-wrap gap-1.5">
            {lead.services.map((s, i) => (
              <span key={i} className="border border-border rounded-md px-2 py-0.5 text-xs text-secondary">
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Reviews */}
      {lead.best_reviews.length > 0 && (
        <div className="mb-6">
          <h4 className="text-2xs font-semibold text-muted uppercase tracking-widest mb-3">Reviews</h4>
          <div className="space-y-3">
            {lead.best_reviews.slice(0, 3).map((review, i) => (
              <div key={i}>
                <div className="flex items-center gap-1.5 mb-1">
                  <div className="flex">
                    {Array.from({ length: review.rating }).map((_, j) => (
                      <Star key={j} className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <span className="text-2xs text-muted">{review.author}</span>
                </div>
                <p className="text-sm text-secondary italic leading-relaxed">
                  &ldquo;{review.text.length > 150 ? review.text.slice(0, 150) + '\u2026' : review.text}&rdquo;
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* About */}
      {lead.description && (
        <div className="mb-6">
          <h4 className="text-2xs font-semibold text-muted uppercase tracking-widest mb-2">About</h4>
          <p className="text-sm text-secondary leading-relaxed">{lead.description}</p>
        </div>
      )}

      {/* Notes */}
      <NotesSection assignmentId={lead.assignment_id} initialNotes={lead.notes ?? ''} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Notes component
// ---------------------------------------------------------------------------

function NotesSection({ assignmentId, initialNotes }: { assignmentId: string; initialNotes: string }) {
  const [notes, setNotes] = useState(initialNotes);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  function handleChange(value: string) {
    setNotes(value);
    setSaved(false);

    // Auto-save after 1s of no typing
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => saveNotes(value), 1000);
  }

  async function saveNotes(text: string) {
    setSaving(true);
    try {
      await fetch(`/api/leads/${assignmentId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: undefined, notes: text }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-2xs font-semibold text-muted uppercase tracking-widest">Notes</h4>
        {saving && <span className="text-2xs text-muted">Saving...</span>}
        {saved && <span className="text-2xs text-status-sold">Saved</span>}
      </div>
      <textarea
        value={notes}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Add notes about this lead..."
        rows={3}
        className="w-full border border-border rounded-lg py-2.5 px-3 text-sm text-primary bg-white placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-primary/5 focus:border-primary/20 resize-none"
      />
    </div>
  );
}
