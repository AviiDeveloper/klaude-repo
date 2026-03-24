'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

function tryParse<T>(val: unknown, fallback: T): T {
  if (!val || typeof val !== 'string') return fallback;
  try { return JSON.parse(val) as T; } catch { return fallback; }
}

import {
  ArrowLeft,
  Phone,
  MapPin,
  Star,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Clock,
  Calendar,
  Lightbulb,
  MessageSquare,
  TrendingUp,
  AlertCircle,
  ChevronDown,
} from 'lucide-react';

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
  follow_up_date?: string;
  contact_name?: string;
  contact_role?: string;
  opening_hours: string[];
  services: string[];
}

export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [lead, setLead] = useState<Lead | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'prepare' | 'pitch' | 'follow-up'>('overview');
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [actionsOpen, setActionsOpen] = useState(false);

  useEffect(() => {
    fetchLead();
  }, [id]);

  const fetchLead = async () => {
    try {
      const res = await fetch(`/api/leads/${id}`);
      const json = await res.json();
      const data = json.data ?? json;
      // Parse JSON string fields if needed
      const parsed = {
        ...data,
        id: data.id ?? data.assignment_id ?? data.lead_id,
        status: data.status ?? data.assignment_status ?? 'new',
        opening_hours: Array.isArray(data.opening_hours) ? data.opening_hours : tryParse(data.opening_hours, []),
        services: Array.isArray(data.services) ? data.services : tryParse(data.services, []),
        best_reviews: Array.isArray(data.best_reviews) ? data.best_reviews : tryParse(data.best_reviews, []),
        trust_badges: Array.isArray(data.trust_badges) ? data.trust_badges : tryParse(data.trust_badges, []),
        avoid_topics: Array.isArray(data.avoid_topics) ? data.avoid_topics : tryParse(data.avoid_topics, []),
      };
      setLead(parsed);
      setFollowUpDate(parsed.follow_up_date || parsed.follow_up_at || '');
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch lead', err);
      setLoading(false);
    }
  };

  const updateStatus = async (newStatus: string) => {
    try {
      const res = await fetch(`/api/leads/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        // Update locally immediately for instant feedback
        setLead(prev => prev ? { ...prev, status: newStatus } : prev);
      }
    } catch (err) {
      console.error('Failed to update status', err);
    }
  };

  const saveFollowUp = async () => {
    try {
      await fetch(`/api/leads/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ follow_up_date: followUpDate, notes }),
      });
      alert('Follow-up saved');
    } catch (err) {
      console.error('Failed to save follow-up', err);
    }
  };

  // Check if business is open right now based on opening_hours
  const getOpenStatus = (): { isOpen: boolean; label: string } | null => {
    const hours = lead?.opening_hours;
    if (!hours || !Array.isArray(hours) || hours.length === 0) return null;

    const now = new Date();
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayAliases: Record<string, number> = {
      'sun': 0, 'sunday': 0, 'mon': 1, 'monday': 1, 'tue': 2, 'tuesday': 2,
      'wed': 3, 'wednesday': 3, 'thu': 4, 'thursday': 4, 'fri': 5, 'friday': 5,
      'sat': 6, 'saturday': 6,
    };
    const currentDay = now.getDay();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    for (const entry of hours) {
      const str = entry.toLowerCase().trim();

      // Match "Mon-Fri: 9:00-17:30" or "Saturday: 9:00-16:00" or "Sun: Closed"
      const match = str.match(/^([a-z\-]+)\s*[:]\s*(.+)$/i);
      if (!match) continue;

      const dayPart = match[1].trim().toLowerCase();
      const timePart = match[2].trim().toLowerCase();

      // Check if current day falls in this range
      let dayMatches = false;
      if (dayPart.includes('-')) {
        const [startDay, endDay] = dayPart.split('-').map(d => dayAliases[d.trim()]);
        if (startDay !== undefined && endDay !== undefined) {
          if (startDay <= endDay) {
            dayMatches = currentDay >= startDay && currentDay <= endDay;
          } else {
            dayMatches = currentDay >= startDay || currentDay <= endDay;
          }
        }
      } else {
        dayMatches = dayAliases[dayPart] === currentDay;
      }

      if (!dayMatches) continue;

      if (timePart === 'closed') return { isOpen: false, label: 'Closed today' };

      const timeMatch = timePart.match(/(\d{1,2}):?(\d{2})?\s*[-–]\s*(\d{1,2}):?(\d{2})?/);
      if (!timeMatch) continue;

      const openMin = parseInt(timeMatch[1]) * 60 + parseInt(timeMatch[2] || '0');
      const closeMin = parseInt(timeMatch[3]) * 60 + parseInt(timeMatch[4] || '0');

      if (currentMinutes >= openMin && currentMinutes < closeMin) {
        const minsLeft = closeMin - currentMinutes;
        if (minsLeft <= 60) return { isOpen: true, label: `Closes in ${minsLeft}m` };
        const closeH = Math.floor(closeMin / 60);
        const closeM = closeMin % 60;
        return { isOpen: true, label: `Open until ${closeH}:${closeM.toString().padStart(2, '0')}` };
      } else if (currentMinutes < openMin) {
        const openH = Math.floor(openMin / 60);
        const openM = openMin % 60;
        return { isOpen: false, label: `Opens at ${openH}:${openM.toString().padStart(2, '0')}` };
      } else {
        return { isOpen: false, label: 'Closed' };
      }
    }
    return null;
  };

  const openStatus = lead ? getOpenStatus() : null;

  const getStatusColor = (status: string) => {
    const colors = {
      new: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      visited: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
      pitched: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
      sold: 'bg-green-500/10 text-green-400 border-green-500/20',
      rejected: 'bg-[#222] text-[#666] border-[#333]',
    };
    return colors[status as keyof typeof colors] || colors.new;
  };

  const getBusinessEmoji = (type: string) => {
    const emojis: Record<string, string> = {
      barber: '💈',
      cafe: '☕',
      plumber: '🔧',
      restaurant: '🍽️',
      salon: '💅',
      gym: '💪',
      dentist: '🦷',
      default: '🏪',
    };
    return emojis[type] || emojis.default;
  };

  if (loading || !lead) {
    return (
      <div className="pt-20 text-center text-[13px] text-[#666]">Loading...</div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: TrendingUp },
    { id: 'prepare', label: 'Prepare', icon: Lightbulb },
    { id: 'pitch', label: 'Pitch', icon: MessageSquare },
    { id: 'follow-up', label: 'Follow Up', icon: Calendar },
  ];

  return (
    <div className="page-enter">
      {/* Header */}
      <div className="border-b border-[#333]">
        <div className="py-6">
          <button
            onClick={() => router.push('/dashboard')}
            className="inline-flex items-center gap-2 text-[13px] text-[#666] hover:text-white mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to leads
          </button>

          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <span className="text-5xl">{getBusinessEmoji(lead.business_type)}</span>
              <div>
                <h1 className="text-[24px] font-semibold text-white tracking-[-0.03em] mb-2">
                  {lead.business_name}
                </h1>
                <div className="flex items-center gap-4 text-[13px] text-[#999]">
                  <span className="capitalize">{lead.business_type}</span>
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-4 h-4" />
                    {lead.postcode}
                  </span>
                  {lead.google_rating > 0 && (
                    <span className="flex items-center gap-1.5">
                      <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                      {lead.google_rating} ({lead.google_review_count})
                    </span>
                  )}
                  {openStatus && (
                    <span className={`flex items-center gap-1.5 ${openStatus.isOpen ? 'text-green-400' : 'text-[#666]'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${openStatus.isOpen ? 'bg-green-400 pulse-dot' : 'bg-[#666]'}`} />
                      {openStatus.label}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="flex items-center gap-2 text-[13px]">
                <span className={`w-2 h-2 rounded-full ${
                  lead.status === 'new' ? 'bg-blue-400 pulse-dot' :
                  lead.status === 'visited' ? 'bg-yellow-500' :
                  lead.status === 'pitched' ? 'bg-purple-400' :
                  lead.status === 'sold' ? 'bg-green-400' : 'bg-[#666]'
                }`} />
                <span className={`font-medium capitalize ${
                  lead.status === 'new' ? 'text-blue-400' :
                  lead.status === 'visited' ? 'text-yellow-500' :
                  lead.status === 'pitched' ? 'text-purple-400' :
                  lead.status === 'sold' ? 'text-green-400' : 'text-[#666]'
                }`}>{lead.status}</span>
              </span>
              <a
                href={`tel:${lead.phone}`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white text-black rounded-lg text-[13px] font-medium hover:bg-[#ededed] transition-colors"
              >
                <Phone className="w-4 h-4" />
                Call
              </a>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-8 border-b border-[#333] -mb-px">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-4 py-3 text-[13px] font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-white text-white'
                      : 'border-transparent text-[#666] hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="py-8">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="max-w-2xl">
            {/* Action row — compact, inline */}
            <div className="flex items-center gap-4 pb-6">
              <div className="relative">
                <button
                  onClick={() => setActionsOpen(!actionsOpen)}
                  className="flex items-center gap-1.5 text-[13px] text-[#999] hover:text-white transition-colors"
                >
                  Update status
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${actionsOpen ? 'rotate-180' : ''}`} />
                </button>
                {actionsOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setActionsOpen(false)} />
                    <div className="absolute top-8 left-0 z-20 bg-[#1a1a1a] border border-[#333] rounded-lg py-1 min-w-[140px] shadow-[0_4px_20px_rgba(0,0,0,0.4)]">
                      {[
                        { s: 'visited', l: 'Visited', d: 'bg-blue-400' },
                        { s: 'pitched', l: 'Pitched', d: 'bg-purple-400' },
                        { s: 'sold', l: 'Sold', d: 'bg-green-400' },
                        { s: 'rejected', l: 'Rejected', d: 'bg-[#666]' },
                      ].map(({ s, l, d }) => (
                        <button key={s} onClick={() => { updateStatus(s); setActionsOpen(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-[#ededed] hover:bg-[#333] transition-colors">
                          <span className={`w-1.5 h-1.5 rounded-full ${d}`} />{l}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {lead.has_demo_site && (
                <button
                  onClick={() => window.open(`/demo/${lead.id}`, '_blank')}
                  className="flex items-center gap-1.5 text-[13px] text-blue-400 hover:text-blue-300 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  View demo
                </button>
              )}

              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(lead.postcode || lead.address || '')}`}
                target="_blank"
                rel="noopener"
                className="flex items-center gap-1.5 text-[13px] text-[#999] hover:text-white transition-colors"
              >
                <MapPin className="w-3.5 h-3.5" />
                Directions
              </a>
            </div>

            <div className="border-t border-[#222]" />

            {/* Contact */}
            {lead.contact_name && (
              <>
                <div className="py-5">
                  <p className="text-[11px] text-[#666] mb-1">Contact</p>
                  <p className="text-[14px] text-white">{lead.contact_name}{lead.contact_role ? ` · ${lead.contact_role}` : ''}</p>
                </div>
                <div className="border-t border-[#222]" />
              </>
            )}

            {/* Hours */}
            {(lead.opening_hours ?? []).length > 0 && (
              <>
                <div className="py-5">
                  <p className="text-[11px] text-[#666] mb-2">Hours</p>
                  <div className="space-y-1">
                    {(lead.opening_hours ?? []).map((h: string, i: number) => (
                      <p key={i} className="text-[13px] text-[#ededed]">{h}</p>
                    ))}
                  </div>
                </div>
                <div className="border-t border-[#222]" />
              </>
            )}

            {/* Services */}
            {(lead.services ?? []).length > 0 && (
              <>
                <div className="py-5">
                  <p className="text-[11px] text-[#666] mb-2">Services</p>
                  <p className="text-[13px] text-[#ededed]">
                    {(lead.services ?? []).join(' · ')}
                  </p>
                </div>
                <div className="border-t border-[#222]" />
              </>
            )}

            {/* Address + directions */}
            {(lead.address || lead.postcode) && (
              <>
                <div className="py-5">
                  <p className="text-[11px] text-[#666] mb-1">Address</p>
                  <p className="text-[13px] text-[#ededed]">{lead.address || lead.postcode}</p>
                </div>
                <div className="border-t border-[#222]" />
              </>
            )}

            {/* Rating detail */}
            {lead.google_rating > 0 && (
              <div className="py-5">
                <p className="text-[11px] text-[#666] mb-1">Google Rating</p>
                <p className="text-[14px] text-white">{lead.google_rating} <span className="text-[#666]">from {lead.google_review_count} reviews</span></p>
              </div>
            )}
          </div>
        )}

        {/* Prepare Tab */}
        {activeTab === 'prepare' && (
          <div className="max-w-2xl">
            <p className="text-[11px] text-[#666] mb-3">Talking points</p>
            <ul className="space-y-2 pb-6">
              {lead.google_rating > 0 && (
                <li className="text-[13px] text-[#ededed]">· {lead.google_rating}★ from {lead.google_review_count} reviews — they care about reputation</li>
              )}
              <li className="text-[13px] text-[#ededed]">· No website — customers can&apos;t find them online</li>
              {lead.has_demo_site && (
                <li className="text-[13px] text-[#ededed]">· Demo site ready — show them on your phone</li>
              )}
              <li className="text-[13px] text-[#ededed]">· Built with their real info, reviews, and services</li>
              {(lead.services ?? []).length > 0 && (
                <li className="text-[13px] text-[#ededed]">· Services: {(lead.services ?? []).join(', ')}</li>
              )}
            </ul>

            <div className="border-t border-[#222]" />

            <div className="py-6">
              <p className="text-[11px] text-yellow-500 mb-3">Don&apos;t mention</p>
              <ul className="space-y-1.5">
                {(lead.avoid_topics ?? ['SEO guarantees', 'criticising their current setup', 'rushing the decision']).map((t: string, i: number) => (
                  <li key={i} className="text-[13px] text-[#999]">· {t}</li>
                ))}
              </ul>
            </div>

            <div className="border-t border-[#222]" />

            <div className="py-6">
              <p className="text-[11px] text-[#666] mb-3">Hours</p>
              {(lead.opening_hours ?? []).map((h: string, i: number) => (
                <p key={i} className="text-[13px] text-[#ededed]">{h}</p>
              ))}
            </div>
          </div>
        )}

        {/* Pitch Tab */}
        {activeTab === 'pitch' && (
          <div className="max-w-3xl space-y-6">
            <div className="bg-[#0a0a0a] rounded-xl border border-[#333] p-6">
              <h2 className="text-[15px] font-semibold text-white mb-4">Objection Handlers</h2>
              <div className="space-y-4">
                {[
                  {
                    objection: "I already have a website",
                    response: "That's great! When was it last updated? We specialize in modern, mobile-first sites that convert visitors into customers.",
                  },
                  {
                    objection: "£350 is too expensive",
                    response: "I understand. That's just £25/month, less than a phone bill. How many new customers would you need to make that worthwhile?",
                  },
                  {
                    objection: "I need to think about it",
                    response: "Absolutely. Can I show you the demo site I made for you first? Takes 2 minutes, then you'll have all the info to decide.",
                  },
                  {
                    objection: "I'm too busy right now",
                    response: "That's exactly why we do everything for you. We handle design, setup, and hosting. You just approve the content.",
                  },
                ].map((item, idx) => (
                  <div key={idx} className="border-l-4 border-white pl-4 py-2">
                    <p className="text-[13px] font-medium text-white mb-2">"{item.objection}"</p>
                    <p className="text-[13px] text-[#999] italic">{item.response}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[#0a0a0a] rounded-xl border border-[#333] p-6">
              <h2 className="text-[15px] font-semibold text-white mb-4">Price Breakdown</h2>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-[#222]">
                  <span className="text-[13px] text-[#999]">Custom website design</span>
                  <span className="text-[13px] font-medium text-white">£350</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-[#222]">
                  <span className="text-[13px] text-[#999]">Or monthly payment</span>
                  <span className="text-[13px] font-medium text-white">£25/mo</span>
                </div>
                <div className="bg-[#111] rounded-lg p-4 mt-4">
                  <p className="text-[11px] uppercase tracking-wide text-[#666] mb-2">Includes:</p>
                  <ul className="space-y-1 text-[13px] text-[#999]">
                    <li>✓ Mobile-optimized design</li>
                    <li>✓ Contact form & phone links</li>
                    <li>✓ Free hosting for 1 year</li>
                    <li>✓ Custom domain setup</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Follow Up Tab */}
        {activeTab === 'follow-up' && (
          <div className="max-w-2xl rounded-lg border border-[#1a1a1a] divide-y divide-[#1a1a1a] hover:border-[#333] transition-colors">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-[12px] text-[#666]">Remind me</span>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                  className="bg-transparent text-[13px] text-white focus:outline-none text-right"
                />
              </div>
            </div>

            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-[12px] text-[#666]">Phone</span>
              <a href={`tel:${lead.phone}`} className="text-[13px] text-blue-400 hover:text-blue-300 transition-colors">{lead.phone}</a>
            </div>

            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-[12px] text-[#666]">Address</span>
              <span className="text-[13px] text-[#ededed]">{lead.address || lead.postcode}</span>
            </div>

            {lead.contact_name && (
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-[12px] text-[#666]">Contact</span>
                <span className="text-[13px] text-[#ededed]">{lead.contact_name}{lead.contact_role ? ` · ${lead.contact_role}` : ''}</span>
              </div>
            )}

            <div className="px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[12px] text-[#666]">Notes</span>
                {notes.trim() && (
                  <button onClick={saveFollowUp} className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors">Save</button>
                )}
              </div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="What happened? What to say next time..."
                rows={2}
                className="w-full bg-transparent text-[13px] text-white placeholder:text-[#333] focus:outline-none resize-none"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
