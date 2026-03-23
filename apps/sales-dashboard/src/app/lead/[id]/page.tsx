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
import { BusinessIntel } from '@/components/BusinessIntel';
import { ShareDemo } from '@/components/ShareDemo';
import {
  ArrowLeft, MapPin, Phone, Mail, Globe, ExternalLink, Loader2, Star,
  ChevronRight, Monitor, ClipboardList, Crosshair, Megaphone, CalendarCheck,
} from 'lucide-react';

const STATUS_STYLES: Record<string, string> = {
  new: 'text-blue-700 bg-blue-50',
  visited: 'text-amber-700 bg-amber-50',
  pitched: 'text-violet-700 bg-violet-50',
  sold: 'text-emerald-700 bg-emerald-50',
  rejected: 'text-slate-500 bg-slate-100',
};

type LeadTab = 'overview' | 'prepare' | 'pitch' | 'followup';

const TABS: Array<{ id: LeadTab; label: string; icon: typeof ClipboardList }> = [
  { id: 'overview', label: 'Overview', icon: ClipboardList },
  { id: 'prepare', label: 'Prepare', icon: Crosshair },
  { id: 'pitch', label: 'Pitch', icon: Megaphone },
  { id: 'followup', label: 'Follow Up', icon: CalendarCheck },
];

export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [talkingPoints, setTalkingPoints] = useState<TalkingPoint[]>([]);
  const [showDemo, setShowDemo] = useState(false);
  const [activeTab, setActiveTab] = useState<LeadTab>('overview');

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
    return <div className="flex items-center justify-center py-32"><Loader2 className="w-5 h-5 text-slate-300 animate-spin" /></div>;
  }

  if (!lead) {
    return <div className="flex items-center justify-center py-32"><p className="text-[13px] text-slate-400">Lead not found</p></div>;
  }

  return (
    <>
      {/* Demo viewer overlay */}
      {showDemo && lead.has_demo_site && lead.demo_site_domain && (
        <DemoViewer domain={lead.demo_site_domain} businessName={lead.business_name} onClose={() => setShowDemo(false)} />
      )}

      {/* Sticky header: back + business name + status + quick actions */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-100">
        <div className="px-6 md:px-8 py-3">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="p-1.5 -ml-1.5 rounded-md hover:bg-slate-50 transition-colors">
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
                  <><span className="text-slate-200">·</span><span className="inline-flex items-center gap-0.5"><Star className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />{lead.google_rating}</span></>
                )}
              </div>
            </div>
            {/* Quick actions in header */}
            <div className="flex items-center gap-2">
              {lead.phone && (
                <a href={`tel:${lead.phone}`} className="p-2 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors" title="Call">
                  <Phone className="w-4 h-4 text-slate-600" />
                </a>
              )}
              {lead.has_demo_site && (
                <button onClick={() => setShowDemo(true)} className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 transition-colors" title="Show demo site">
                  <Monitor className="w-4 h-4 text-white" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex px-6 md:px-8 border-t border-slate-50">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-[12px] font-medium border-b-2 -mb-px transition-colors ${
                activeTab === id
                  ? 'text-slate-900 border-slate-900'
                  : 'text-slate-400 border-transparent hover:text-slate-600'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="px-6 md:px-8 py-6">

        {/* ═══════════════════════════════════════════════════
            OVERVIEW — quick summary, status, contact, key info
            ═══════════════════════════════════════════════════ */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Left: Actions + Key info */}
            <div className="md:col-span-2 space-y-6">
              <ActionButtons
                assignmentId={lead.assignment_id}
                currentStatus={lead.assignment_status}
                onStatusChange={handleStatusChange}
              />

              {/* Quick info cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <InfoCard label="Rating" value={lead.google_rating ? `${lead.google_rating}★` : '—'} sublabel={lead.google_review_count ? `${lead.google_review_count} reviews` : undefined} />
                <InfoCard label="Website" value={lead.has_website ? 'Has one' : 'None'} sublabel={lead.has_website && lead.website_quality_score ? `Score: ${lead.website_quality_score}/100` : lead.has_website ? undefined : 'Perfect candidate'} highlight={!lead.has_website} />
                <InfoCard label="Services" value={String(lead.services?.length ?? 0)} sublabel={lead.services?.slice(0, 2).join(', ') || undefined} />
                <InfoCard label="Reviews" value={String(lead.best_reviews?.length ?? 0)} sublabel="usable for pitch" />
              </div>

              {/* Talking Points (compact) */}
              <TalkingPoints points={talkingPoints} />

              {/* About */}
              {lead.description && (
                <div>
                  <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.08em] mb-2">About</h3>
                  <p className="text-[12px] text-slate-600 leading-relaxed">{lead.description}</p>
                </div>
              )}
            </div>

            {/* Right: Contact + Hours */}
            <div className="space-y-6">
              <ContactCard lead={lead} />

              {lead.opening_hours.length > 0 && (
                <div>
                  <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.08em] mb-3">Opening Hours</h3>
                  <div className="border border-slate-100 rounded-xl px-4 py-3 space-y-1">
                    {lead.opening_hours.map((h, i) => (
                      <p key={i} className="text-[12px] text-slate-600">{h}</p>
                    ))}
                  </div>
                </div>
              )}

              {lead.services.length > 0 && (
                <div>
                  <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.08em] mb-3">Services</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {lead.services.map((s, i) => (
                      <span key={i} className="border border-slate-200 rounded-lg px-2.5 py-1 text-[11px] text-slate-600">{s}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════
            PREPARE — research, intelligence, what to say
            ═══════════════════════════════════════════════════ */}
        {activeTab === 'prepare' && (
          <div className="max-w-3xl space-y-6">
            <BusinessIntel lead={lead} />
          </div>
        )}

        {/* ═══════════════════════════════════════════════════
            PITCH — demo site, price, objection handling
            ═══════════════════════════════════════════════════ */}
        {activeTab === 'pitch' && (
          <div className="max-w-3xl space-y-6">
            {/* Demo site */}
            {lead.has_demo_site && lead.demo_site_domain && (
              <div>
                <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.08em] mb-3">Demo Site</h3>
                <button
                  onClick={() => setShowDemo(true)}
                  className="w-full flex items-center justify-between py-4 px-5 border border-slate-200 rounded-xl text-[13px] font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center">
                      <Monitor className="w-5 h-5 text-white" />
                    </div>
                    <div className="text-left">
                      <div className="text-[13px] font-medium text-slate-900">Show {lead.business_name}'s demo site</div>
                      <div className="text-[11px] text-slate-400">Full-screen — optimised for showing on your phone</div>
                    </div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-slate-300" />
                </button>
              </div>
            )}

            {/* Share demo link */}
            <div>
              <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.08em] mb-3">Share with Client</h3>
              <ShareDemo
                assignmentId={lead.assignment_id}
                businessName={lead.business_name}
                hasDemoSite={lead.has_demo_site}
              />
            </div>

            {/* Price breakdown */}
            <div>
              <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.08em] mb-3">Price Breakdown</h3>
              <PriceBreakdown />
            </div>

            {/* Objection handler */}
            <div>
              <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.08em] mb-3">Objection Handler</h3>
              <ObjectionHandler />
            </div>

            {/* Customer reviews to quote */}
            {lead.best_reviews.length > 0 && (
              <div>
                <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.08em] mb-3">Quote Their Customers</h3>
                <div className="space-y-2">
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
                        &ldquo;{review.text.length > 200 ? review.text.slice(0, 200) + '\u2026' : review.text}&rdquo;
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════
            FOLLOW UP — contact capture, notes, follow-up dates
            ═══════════════════════════════════════════════════ */}
        {activeTab === 'followup' && (
          <div className="max-w-3xl space-y-6">
            {/* Contact person */}
            <div>
              <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.08em] mb-3">Contact Person</h3>
              <ContactCapture
                assignmentId={lead.assignment_id}
                contactName={lead.contact_name}
                contactRole={lead.contact_role}
                onUpdate={reloadLead}
              />
            </div>

            {/* Follow-up */}
            <div>
              <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.08em] mb-3">Follow-Up Reminder</h3>
              <FollowUp
                assignmentId={lead.assignment_id}
                followUpAt={lead.follow_up_at}
                followUpNote={lead.follow_up_note}
                onUpdate={reloadLead}
              />
            </div>

            {/* Notes */}
            <div>
              <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.08em] mb-3">Notes</h3>
              <NotesSection assignmentId={lead.assignment_id} initialNotes={lead.notes ?? ''} />
            </div>

            {/* Status action at bottom for context */}
            <div>
              <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.08em] mb-3">Update Status</h3>
              <ActionButtons
                assignmentId={lead.assignment_id}
                currentStatus={lead.assignment_status}
                onStatusChange={handleStatusChange}
              />
            </div>

            {/* Contact details for quick reference */}
            <ContactCard lead={lead} />
          </div>
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function InfoCard({ label, value, sublabel, highlight }: { label: string; value: string; sublabel?: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl px-4 py-3 ${highlight ? 'bg-amber-50 border border-amber-100' : 'bg-slate-50'}`}>
      <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-[18px] font-bold tabular-nums ${highlight ? 'text-amber-700' : 'text-slate-900'}`}>{value}</div>
      {sublabel && <div className={`text-[10px] mt-0.5 ${highlight ? 'text-amber-500' : 'text-slate-400'}`}>{sublabel}</div>}
    </div>
  );
}

function ContactCard({ lead }: { lead: LeadDetail }) {
  return (
    <div>
      <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.08em] mb-3">Contact</h3>
      <div className="border border-slate-100 rounded-xl overflow-hidden">
        {lead.phone && (
          <a href={`tel:${lead.phone}`} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors border-b border-slate-50">
            <div className="flex items-center gap-2.5 text-[13px] text-slate-900"><Phone className="w-3.5 h-3.5 text-slate-400" />{lead.phone}</div>
            <ChevronRight className="w-3.5 h-3.5 text-slate-200" />
          </a>
        )}
        {lead.email && (
          <a href={`mailto:${lead.email}`} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors border-b border-slate-50">
            <div className="flex items-center gap-2.5 text-[13px] text-slate-900"><Mail className="w-3.5 h-3.5 text-slate-400" />{lead.email}</div>
            <ChevronRight className="w-3.5 h-3.5 text-slate-200" />
          </a>
        )}
        {lead.address && (
          <a href={`https://maps.google.com/?q=${encodeURIComponent(lead.address)}`} target="_blank" rel="noopener" className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors border-b border-slate-50">
            <div className="flex items-center gap-2.5 text-[13px] text-slate-900"><MapPin className="w-3.5 h-3.5 text-slate-400" />{lead.address}</div>
            <ChevronRight className="w-3.5 h-3.5 text-slate-200" />
          </a>
        )}
        {lead.website_url && (
          <a href={lead.website_url} target="_blank" rel="noopener" className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors">
            <div className="flex items-center gap-2.5 text-[13px] text-slate-900 truncate"><Globe className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" /><span className="truncate">{lead.website_url}</span></div>
            <ChevronRight className="w-3.5 h-3.5 text-slate-200 flex-shrink-0" />
          </a>
        )}
      </div>
    </div>
  );
}

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
        <span className="text-[10px] text-slate-400">
          {saving ? 'Saving...' : saved ? '✓ Saved' : 'Auto-saves as you type'}
        </span>
      </div>
      <textarea
        value={notes}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Spoke to the owner, they seemed interested but want to think about it..."
        rows={4}
        className="w-full border border-slate-200 rounded-xl py-3 px-4 text-[13px] text-slate-900 bg-white placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/5 focus:border-slate-300 resize-none transition-all"
      />
    </div>
  );
}
