'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
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

  useEffect(() => {
    fetchLead();
  }, [id]);

  const fetchLead = async () => {
    try {
      const res = await fetch(`/api/leads/${id}`);
      const data = await res.json();
      setLead(data);
      setFollowUpDate(data.follow_up_date || '');
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
      new: 'bg-blue-50 text-blue-700 border-blue-200',
      visited: 'bg-amber-50 text-amber-700 border-amber-200',
      pitched: 'bg-purple-50 text-purple-700 border-purple-200',
      sold: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      rejected: 'bg-slate-50 text-slate-600 border-slate-200',
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
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: TrendingUp },
    { id: 'prepare', label: 'Prepare', icon: Lightbulb },
    { id: 'pitch', label: 'Pitch', icon: MessageSquare },
    { id: 'follow-up', label: 'Follow Up', icon: Calendar },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <button
            onClick={() => router.push('/dashboard')}
            className="inline-flex items-center gap-2 text-[13px] text-slate-600 hover:text-slate-900 mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to leads
          </button>

          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <span className="text-5xl">{getBusinessEmoji(lead.business_type)}</span>
              <div>
                <h1 className="text-[28px] font-semibold text-slate-900 tracking-tight mb-2">
                  {lead.business_name}
                </h1>
                <div className="flex items-center gap-4 text-[13px] text-slate-600">
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
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-[13px] font-medium hover:bg-slate-800 transition-colors"
              >
                <Phone className="w-4 h-4" />
                Call
              </a>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-8 border-b border-slate-200 -mb-px">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-4 py-3 text-[13px] font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-slate-900 text-slate-900'
                      : 'border-transparent text-slate-500 hover:text-slate-900'
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
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Actions */}
            <div className="space-y-4">
              <h2 className="text-[15px] font-semibold text-slate-900 mb-4">Quick Actions</h2>

              <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-3">
                <button
                  onClick={() => updateStatus('visited')}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-slate-50 hover:bg-slate-100 rounded-lg text-[13px] font-medium text-slate-900 transition-colors"
                >
                  <CheckCircle2 className="w-5 h-5 text-blue-600" />
                  Mark as Visited
                </button>

                <button
                  onClick={() => updateStatus('pitched')}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-slate-50 hover:bg-slate-100 rounded-lg text-[13px] font-medium text-slate-900 transition-colors"
                >
                  <MessageSquare className="w-5 h-5 text-purple-600" />
                  Mark as Pitched
                </button>

                <button
                  onClick={() => updateStatus('sold')}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-emerald-50 hover:bg-emerald-100 rounded-lg text-[13px] font-medium text-emerald-900 transition-colors"
                >
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  Mark as Sold 🎉
                </button>

                <button
                  onClick={() => updateStatus('rejected')}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-slate-50 hover:bg-slate-100 rounded-lg text-[13px] font-medium text-slate-600 transition-colors"
                >
                  <XCircle className="w-5 h-5 text-slate-400" />
                  Mark as Rejected
                </button>
              </div>

              {lead.has_demo_site && (
                <div className="bg-white rounded-xl border border-slate-200 p-6">
                  <h3 className="text-[13px] font-semibold text-slate-900 mb-3">Demo Website</h3>
                  <button
                    onClick={() => window.open(`/demo/${lead.id}`, '_blank')}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-900 text-white rounded-lg text-[13px] font-medium hover:bg-slate-800 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    View Demo Site
                  </button>
                </div>
              )}
            </div>

            {/* Business Intel */}
            <div className="space-y-4">
              <h2 className="text-[15px] font-semibold text-slate-900 mb-4">Business Info</h2>

              {lead.contact_name && (
                <div className="bg-white rounded-xl border border-slate-200 p-6">
                  <h3 className="text-[11px] uppercase tracking-wide text-slate-500 mb-2">Contact Person</h3>
                  <p className="text-[15px] font-medium text-slate-900">{lead.contact_name}</p>
                  {lead.contact_role && <p className="text-[13px] text-slate-600">{lead.contact_role}</p>}
                </div>
              )}

              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="text-[11px] uppercase tracking-wide text-slate-500 mb-3">Opening Hours</h3>
                <div className="space-y-2">
                  {lead.opening_hours.map((hours, idx) => (
                    <p key={idx} className="text-[13px] text-slate-900">{hours}</p>
                  ))}
                </div>
              </div>

              {lead.services.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 p-6">
                  <h3 className="text-[11px] uppercase tracking-wide text-slate-500 mb-3">Services</h3>
                  <div className="flex flex-wrap gap-2">
                    {lead.services.map((service, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1.5 bg-slate-50 text-slate-700 rounded-md text-[12px]"
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
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h2 className="text-[15px] font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-amber-500" />
                Talking Points
              </h2>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[11px] font-semibold">✓</span>
                  <p className="text-[13px] text-slate-700">Great {lead.google_rating} star rating - people trust you</p>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[11px] font-semibold">✓</span>
                  <p className="text-[13px] text-slate-700">Your business deserves a professional online presence</p>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[11px] font-semibold">✓</span>
                  <p className="text-[13px] text-slate-700">We've already built a demo site with your actual info</p>
                </li>
              </ul>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
              <h2 className="text-[15px] font-semibold text-amber-900 mb-4 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Don't Mention
              </h2>
              <ul className="space-y-2 text-[13px] text-amber-800">
                <li>• Don't promise SEO results or #1 Google rankings</li>
                <li>• Don't criticize their current setup</li>
                <li>• Don't rush them - be consultative</li>
              </ul>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h2 className="text-[15px] font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <Clock className="w-5 h-5 text-slate-500" />
                Best Time to Visit
              </h2>
              <p className="text-[13px] text-slate-700 mb-2">Based on opening hours:</p>
              <div className="space-y-2">
                {lead.opening_hours.map((hours, idx) => (
                  <p key={idx} className="text-[13px] text-slate-600 bg-slate-50 px-3 py-2 rounded">{hours}</p>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Pitch Tab */}
        {activeTab === 'pitch' && (
          <div className="max-w-3xl space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h2 className="text-[15px] font-semibold text-slate-900 mb-4">Objection Handlers</h2>
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
                  <div key={idx} className="border-l-4 border-slate-900 pl-4 py-2">
                    <p className="text-[13px] font-medium text-slate-900 mb-2">"{item.objection}"</p>
                    <p className="text-[13px] text-slate-600 italic">{item.response}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h2 className="text-[15px] font-semibold text-slate-900 mb-4">Price Breakdown</h2>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                  <span className="text-[13px] text-slate-600">Custom website design</span>
                  <span className="text-[13px] font-medium text-slate-900">£350</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                  <span className="text-[13px] text-slate-600">Or monthly payment</span>
                  <span className="text-[13px] font-medium text-slate-900">£25/mo</span>
                </div>
                <div className="bg-slate-50 rounded-lg p-4 mt-4">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500 mb-2">Includes:</p>
                  <ul className="space-y-1 text-[13px] text-slate-700">
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
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h2 className="text-[15px] font-semibold text-slate-900 mb-4">Set Reminder</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-[13px] font-medium text-slate-700 mb-2">Follow-up Date</label>
                  <input
                    type="date"
                    value={followUpDate}
                    onChange={(e) => setFollowUpDate(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-[13px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-[13px] font-medium text-slate-700 mb-2">Notes</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add notes about the conversation..."
                    rows={4}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent resize-none"
                  />
                </div>

                <button
                  onClick={saveFollowUp}
                  className="px-6 py-2.5 bg-slate-900 text-white rounded-lg text-[13px] font-medium hover:bg-slate-800 transition-colors"
                >
                  Save Follow-Up
                </button>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h2 className="text-[15px] font-semibold text-slate-900 mb-4">Contact Details</h2>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Phone className="w-5 h-5 text-slate-400" />
                  <a href={`tel:${lead.phone}`} className="text-[13px] text-blue-600 hover:text-blue-700">
                    {lead.phone}
                  </a>
                </div>
                <div className="flex items-center gap-3">
                  <MapPin className="w-5 h-5 text-slate-400" />
                  <span className="text-[13px] text-slate-700">{lead.postcode}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
