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

  const updateStatus = async (status: string) => {
    try {
      await fetch(`/api/leads/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      fetchLead();
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
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className={`px-3 py-1.5 rounded-lg text-[11px] font-medium uppercase tracking-wide border ${getStatusColor(lead.status)}`}>
                {lead.status}
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
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Actions — inline row */}
            <div className="relative">
              <button
                onClick={() => setActionsOpen(!actionsOpen)}
                className="flex items-center gap-2 text-[13px] text-[#999] hover:text-white transition-colors"
              >
                Update status
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${actionsOpen ? 'rotate-180' : ''}`} />
              </button>

              {actionsOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setActionsOpen(false)} />
                  <div className="absolute top-8 left-0 z-20 bg-[#1a1a1a] border border-[#333] rounded-lg py-1 min-w-[140px] shadow-[0_4px_20px_rgba(0,0,0,0.4)]">
                    {[
                      { status: 'visited', label: 'Visited', dot: 'bg-blue-400' },
                      { status: 'pitched', label: 'Pitched', dot: 'bg-purple-400' },
                      { status: 'sold', label: 'Sold', dot: 'bg-green-400' },
                      { status: 'rejected', label: 'Rejected', dot: 'bg-[#666]' },
                    ].map(({ status, label, dot }) => (
                      <button
                        key={status}
                        onClick={() => { updateStatus(status); setActionsOpen(false); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-[#ededed] hover:bg-[#333] transition-colors"
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
                        {label}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {lead.has_demo_site && (
                <div className="bg-[#0a0a0a] rounded-xl border border-[#333] p-6">
                  <h3 className="text-[13px] font-semibold text-white mb-3">Demo Website</h3>
                  <button
                    onClick={() => window.open(`/demo/${lead.id}`, '_blank')}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white text-black rounded-lg text-[13px] font-medium hover:bg-[#ededed] transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    View Demo Site
                  </button>
                </div>
              )}
            </div>

            {/* Business Intel */}
            <div className="space-y-4">
              <h2 className="text-[15px] font-semibold text-white mb-4">Business Info</h2>

              {lead.contact_name && (
                <div className="bg-[#0a0a0a] rounded-xl border border-[#333] p-6">
                  <h3 className="text-[11px] uppercase tracking-wide text-[#666] mb-2">Contact Person</h3>
                  <p className="text-[15px] font-medium text-white">{lead.contact_name}</p>
                  {lead.contact_role && <p className="text-[13px] text-[#999]">{lead.contact_role}</p>}
                </div>
              )}

              <div className="bg-[#0a0a0a] rounded-xl border border-[#333] p-6">
                <h3 className="text-[11px] uppercase tracking-wide text-[#666] mb-3">Opening Hours</h3>
                <div className="space-y-2">
                  {(lead.opening_hours ?? []).map((hours: string, idx: number) => (
                    <p key={idx} className="text-[13px] text-[#ededed]">{hours}</p>
                  ))}
                </div>
              </div>

              {lead.services.length > 0 && (
                <div className="bg-[#0a0a0a] rounded-xl border border-[#333] p-6">
                  <h3 className="text-[11px] uppercase tracking-wide text-[#666] mb-3">Services</h3>
                  <div className="flex flex-wrap gap-2">
                    {(lead.services ?? []).map((service: string, idx: number) => (
                      <span
                        key={idx}
                        className="px-3 py-1.5 bg-[#111] text-[#999] rounded-md text-[12px]"
                      >
                        {service}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Prepare Tab */}
        {activeTab === 'prepare' && (
          <div className="max-w-3xl space-y-6">
            <div className="bg-[#0a0a0a] rounded-xl border border-[#333] p-6">
              <h2 className="text-[15px] font-semibold text-white mb-4 flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-amber-500" />
                Talking Points
              </h2>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-500/10 text-green-400 flex items-center justify-center text-[11px] font-semibold">✓</span>
                  <p className="text-[13px] text-[#999]">Great {lead.google_rating} star rating - people trust you</p>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-500/10 text-green-400 flex items-center justify-center text-[11px] font-semibold">✓</span>
                  <p className="text-[13px] text-[#999]">Your business deserves a professional online presence</p>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-500/10 text-green-400 flex items-center justify-center text-[11px] font-semibold">✓</span>
                  <p className="text-[13px] text-[#999]">We've already built a demo site with your actual info</p>
                </li>
              </ul>
            </div>

            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-6">
              <h2 className="text-[15px] font-semibold text-yellow-500 mb-4 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Don't Mention
              </h2>
              <ul className="space-y-2 text-[13px] text-yellow-500/80">
                <li>• Don't promise SEO results or #1 Google rankings</li>
                <li>• Don't criticize their current setup</li>
                <li>• Don't rush them - be consultative</li>
              </ul>
            </div>

            <div className="bg-[#0a0a0a] rounded-xl border border-[#333] p-6">
              <h2 className="text-[15px] font-semibold text-white mb-3 flex items-center gap-2">
                <Clock className="w-5 h-5 text-[#666]" />
                Best Time to Visit
              </h2>
              <p className="text-[13px] text-[#999] mb-2">Based on opening hours:</p>
              <div className="space-y-2">
                {(lead.opening_hours ?? []).map((hours: string, idx: number) => (
                  <p key={idx} className="text-[13px] text-[#999] bg-[#111] px-3 py-2 rounded">{hours}</p>
                ))}
              </div>
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
          <div className="max-w-3xl space-y-6">
            <div className="bg-[#0a0a0a] rounded-xl border border-[#333] p-6">
              <h2 className="text-[15px] font-semibold text-white mb-4">Set Reminder</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-[13px] font-medium text-[#999] mb-2">Follow-up Date</label>
                  <input
                    type="date"
                    value={followUpDate}
                    onChange={(e) => setFollowUpDate(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[#111] border border-[#333] rounded-lg text-[13px] text-white focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-[13px] font-medium text-[#999] mb-2">Notes</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add notes about the conversation..."
                    rows={4}
                    className="w-full px-4 py-3 bg-[#111] border border-[#333] rounded-lg text-[13px] text-white placeholder:text-[#666] focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent resize-none"
                  />
                </div>

                <button
                  onClick={saveFollowUp}
                  className="px-6 py-2.5 bg-white text-black rounded-lg text-[13px] font-medium hover:bg-[#ededed] transition-colors"
                >
                  Save Follow-Up
                </button>
              </div>
            </div>

            <div className="bg-[#0a0a0a] rounded-xl border border-[#333] p-6">
              <h2 className="text-[15px] font-semibold text-white mb-4">Contact Details</h2>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Phone className="w-5 h-5 text-[#666]" />
                  <a href={`tel:${lead.phone}`} className="text-[13px] text-blue-400 hover:text-blue-300">
                    {lead.phone}
                  </a>
                </div>
                <div className="flex items-center gap-3">
                  <MapPin className="w-5 h-5 text-[#666]" />
                  <span className="text-[13px] text-[#999]">{lead.postcode}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
