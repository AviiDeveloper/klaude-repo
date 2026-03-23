'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { LeadDetail, TalkingPoint, AssignmentStatus } from '@/lib/types';
import { generateTalkingPoints } from '@/lib/intel';
import { TalkingPoints } from '@/components/TalkingPoints';
import { ActionButtons } from '@/components/ActionButtons';
import { GoogleRating } from '@/components/GoogleRating';
import { DemoViewer, PriceBreakdown } from '@/components/PitchTools';
import { ObjectionHandler } from '@/components/ObjectionHandler';
import { FollowUp } from '@/components/FollowUp';
import { ContactCapture } from '@/components/ContactCapture';
import {
  ArrowLeft, MapPin, Phone, Mail, Globe,
  ExternalLink, Loader2, Star, ChevronRight, Monitor,
} from 'lucide-react';

const STATUS_STYLES: Record<string, string> = {
  new: 'text-blue-700 bg-blue-50',
  visited: 'text-amber-700 bg-amber-50',
  pitched: 'text-violet-700 bg-violet-50',
  sold: 'text-emerald-700 bg-emerald-50',
  rejected: 'text-slate-500 bg-slate-100',
};

export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [talkingPoints, setTalkingPoints] = useState<TalkingPoint[]>([]);
  const [showDemo, setShowDemo] = useState(false);

  async function reloadLead() {
    const res = await fetch(`/api/leads/${params.id}`);
    if (res.ok) {
      const data = await res.json();
      const ld = data.data as LeadDetail;
      setLead(ld);
      setTalkingPoints(generateTalkingPoints(ld));
    }
  }

  useEffect(() => {
    reloadLead().finally(() => setLoading(false));
  }, [params.id]);

  function handleStatusChange(newStatus: AssignmentStatus) {
    if (lead) setLead({ ...lead, assignment_status: newStatus });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-5 h-5 text-slate-300 animate-spin" />
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="flex items-center justify-center py-32">
        <p className="text-[13px] text-slate-400">Lead not found</p>
      </div>
    );
  }

  return (
    <>
      {/* Demo viewer overlay */}
      {showDemo && lead.has_demo_site && lead.demo_site_domain && (
        <DemoViewer
          domain={lead.demo_site_domain}
          businessName={lead.business_name}
          onClose={() => setShowDemo(false)}
        />
      )}

      {/* Top bar */}
      <div className="px-6 md:px-8 py-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-1.5 -ml-1.5 rounded-md hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-slate-400" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5">
              <h1 className="text-[15px] font-semibold text-slate-900 truncate">{lead.business_name}</h1>
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[lead.assignment_status] ?? ''}`}>
                {lead.assignment_status}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
              {lead.business_type && <span className="capitalize">{lead.business_type}</span>}
              {lead.postcode && <><span className="text-slate-200">·</span><span>{lead.postcode}</span></>}
              {lead.google_rating && (
                <>
                  <span className="text-slate-200">·</span>
                  <span className="inline-flex items-center gap-0.5">
                    <Star className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />
                    {lead.google_rating}
                    {lead.google_review_count && <span className="text-slate-300">({lead.google_review_count})</span>}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="px-6 md:px-8 py-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-8">

          {/* LEFT COLUMN — Actions & Pitch Tools (3/5) */}
          <div className="md:col-span-3 space-y-6">
            {/* Status action */}
            <ActionButtons
              assignmentId={lead.assignment_id}
              currentStatus={lead.assignment_status}
              onStatusChange={handleStatusChange}
            />

            {/* Demo site button */}
            {lead.has_demo_site && lead.demo_site_domain && (
              <button
                onClick={() => setShowDemo(true)}
                className="w-full flex items-center justify-between py-3 px-4 border border-slate-200 rounded-xl text-[13px] font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <Monitor className="w-4 h-4 text-slate-400" />
                  <span>Show demo to client</span>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-slate-300" />
              </button>
            )}

            {/* Follow-up & Contact */}
            <div className="space-y-3">
              <FollowUp
                assignmentId={lead.assignment_id}
                followUpAt={lead.follow_up_at}
                followUpNote={lead.follow_up_note}
                onUpdate={reloadLead}
              />
              <ContactCapture
                assignmentId={lead.assignment_id}
                contactName={lead.contact_name}
                contactRole={lead.contact_role}
                onUpdate={reloadLead}
              />
            </div>

            <div className="h-px bg-slate-100" />

            {/* Talking Points */}
            <TalkingPoints points={talkingPoints} />

            <div className="h-px bg-slate-100" />

            {/* Pitch Tools */}
            <div className="space-y-3">
              <PriceBreakdown />
              <ObjectionHandler />
            </div>

            {/* Notes */}
            <div className="h-px bg-slate-100" />
            <NotesSection assignmentId={lead.assignment_id} initialNotes={lead.notes ?? ''} />
          </div>

          {/* RIGHT COLUMN — Business Info (2/5) */}
          <div className="md:col-span-2 space-y-6">
            {/* Contact details */}
            <div>
              <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.08em] mb-3">Contact</h3>
              <div className="border border-slate-100 rounded-xl overflow-hidden">
                {lead.phone && (
                  <a href={`tel:${lead.phone}`} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors border-b border-slate-50">
                    <div className="flex items-center gap-2.5 text-[13px] text-slate-900">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      {lead.phone}
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-200" />
                  </a>
                )}
                {lead.email && (
                  <a href={`mailto:${lead.email}`} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors border-b border-slate-50">
                    <div className="flex items-center gap-2.5 text-[13px] text-slate-900">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      {lead.email}
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-200" />
                  </a>
                )}
                {lead.address && (
                  <a href={`https://maps.google.com/?q=${encodeURIComponent(lead.address)}`} target="_blank" rel="noopener" className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors border-b border-slate-50">
                    <div className="flex items-center gap-2.5 text-[13px] text-slate-900">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      {lead.address}
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-200" />
                  </a>
                )}
                {lead.website_url && (
                  <a href={lead.website_url} target="_blank" rel="noopener" className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-2.5 text-[13px] text-slate-900 truncate">
                      <Globe className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <span className="truncate">{lead.website_url}</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-200 flex-shrink-0" />
                  </a>
                )}
              </div>
            </div>

            {/* Rating */}
            {lead.google_rating && (
              <div>
                <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.08em] mb-3">Rating</h3>
                <div className="bg-slate-50 rounded-xl px-4 py-3">
                  <GoogleRating rating={lead.google_rating} reviewCount={lead.google_review_count} />
                </div>
              </div>
            )}

            {/* Opening Hours */}
            {lead.opening_hours.length > 0 && (
              <div>
                <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.08em] mb-3">Hours</h3>
                <div className="border border-slate-100 rounded-xl px-4 py-3 space-y-1">
                  {lead.opening_hours.map((h, i) => (
                    <p key={i} className="text-[12px] text-slate-600">{h}</p>
                  ))}
                </div>
              </div>
            )}

            {/* Services */}
            {lead.services.length > 0 && (
              <div>
                <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.08em] mb-3">Services</h3>
                <div className="flex flex-wrap gap-1.5">
                  {lead.services.map((s, i) => (
                    <span key={i} className="border border-slate-200 rounded-lg px-2.5 py-1 text-[11px] text-slate-600">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Reviews */}
            {lead.best_reviews.length > 0 && (
              <div>
                <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.08em] mb-3">Reviews</h3>
                <div className="space-y-3">
                  {lead.best_reviews.slice(0, 3).map((review, i) => (
                    <div key={i} className="border border-slate-100 rounded-xl px-4 py-3">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <div className="flex">
                          {Array.from({ length: review.rating }).map((_, j) => (
                            <Star key={j} className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                          ))}
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium">{review.author}</span>
                      </div>
                      <p className="text-[12px] text-slate-600 italic leading-relaxed">
                        &ldquo;{review.text.length > 150 ? review.text.slice(0, 150) + '\u2026' : review.text}&rdquo;
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* About */}
            {lead.description && (
              <div>
                <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.08em] mb-3">About</h3>
                <p className="text-[12px] text-slate-600 leading-relaxed">{lead.description}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------

function NotesSection({ assignmentId, initialNotes }: { assignmentId: string; initialNotes: string }) {
  const [notes, setNotes] = useState(initialNotes);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  function handleChange(value: string) {
    setNotes(value);
    setSaved(false);
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
    } catch { /* silent */ } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.08em]">Notes</h3>
        {saving && <span className="text-[10px] text-slate-400">Saving...</span>}
        {saved && <span className="text-[10px] text-emerald-500">Saved</span>}
      </div>
      <textarea
        value={notes}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Add notes about this lead..."
        rows={3}
        className="w-full border border-slate-200 rounded-xl py-3 px-4 text-[13px] text-slate-900 bg-white placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/5 focus:border-slate-300 resize-none transition-all"
      />
    </div>
  );
}
