'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Phone, MapPin, Star, ExternalLink, Clock } from 'lucide-react';

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

interface Stats {
  queue: number;
  visited: number;
  pitched: number;
  sold: number;
  total_commission: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filter, setFilter] = useState<'all' | 'new' | 'visited' | 'pitched' | 'sold'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [statsRes, leadsRes] = await Promise.all([
        fetch('/api/stats'),
        fetch('/api/leads'),
      ]);

      const statsData = await statsRes.json();
      const leadsData = await leadsRes.json();

      setStats(statsData);
      setLeads(leadsData);
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch data', err);
      setLoading(false);
    }
  };

  const filteredLeads = filter === 'all'
    ? leads
    : leads.filter(lead => lead.status === filter);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-[28px] font-semibold text-slate-900 tracking-tight mb-1">Your Leads</h1>
          <p className="text-[15px] text-slate-500">
            {filteredLeads.length} {filter === 'all' ? 'total' : filter} leads
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-[11px] uppercase tracking-wide text-slate-500 mb-2">Queue</p>
            <p className="text-[28px] font-semibold text-slate-900">{stats?.queue || 0}</p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-[11px] uppercase tracking-wide text-slate-500 mb-2">Visited</p>
            <p className="text-[28px] font-semibold text-slate-900">{stats?.visited || 0}</p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-[11px] uppercase tracking-wide text-slate-500 mb-2">Pitched</p>
            <p className="text-[28px] font-semibold text-slate-900">{stats?.pitched || 0}</p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-[11px] uppercase tracking-wide text-slate-500 mb-2">Sold</p>
            <p className="text-[28px] font-semibold text-emerald-600">{stats?.sold || 0}</p>
          </div>

          <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 col-span-2 lg:col-span-1">
            <p className="text-[11px] uppercase tracking-wide text-slate-400 mb-2">Earnings</p>
            <p className="text-[28px] font-semibold text-white">£{stats?.total_commission || 0}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {[
            { key: 'all', label: 'All leads' },
            { key: 'new', label: 'New' },
            { key: 'visited', label: 'Visited' },
            { key: 'pitched', label: 'Pitched' },
            { key: 'sold', label: 'Sold' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key as any)}
              className={`px-4 py-2 rounded-lg text-[13px] font-medium whitespace-nowrap transition-colors ${
                filter === tab.key
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Leads Table */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {filteredLeads.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <p className="text-[15px]">No leads found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left py-4 px-6 text-[11px] uppercase tracking-wide font-medium text-slate-500">
                      Business
                    </th>
                    <th className="text-left py-4 px-6 text-[11px] uppercase tracking-wide font-medium text-slate-500">
                      Type
                    </th>
                    <th className="text-left py-4 px-6 text-[11px] uppercase tracking-wide font-medium text-slate-500">
                      Location
                    </th>
                    <th className="text-left py-4 px-6 text-[11px] uppercase tracking-wide font-medium text-slate-500">
                      Rating
                    </th>
                    <th className="text-left py-4 px-6 text-[11px] uppercase tracking-wide font-medium text-slate-500">
                      Status
                    </th>
                    <th className="text-left py-4 px-6 text-[11px] uppercase tracking-wide font-medium text-slate-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.map((lead) => (
                    <tr
                      key={lead.id}
                      onClick={() => router.push(`/lead/${lead.id}`)}
                      className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{getBusinessEmoji(lead.business_type)}</span>
                          <div>
                            <p className="text-[15px] font-medium text-slate-900">{lead.business_name}</p>
                            {lead.contact_name && (
                              <p className="text-[13px] text-slate-500">
                                {lead.contact_name} {lead.contact_role && `· ${lead.contact_role}`}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className="text-[13px] text-slate-600 capitalize">{lead.business_type}</span>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2 text-[13px] text-slate-600">
                          <MapPin className="w-4 h-4 text-slate-400" />
                          {lead.postcode}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        {lead.google_rating > 0 ? (
                          <div className="flex items-center gap-2">
                            <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                            <span className="text-[13px] font-medium text-slate-900">{lead.google_rating}</span>
                            <span className="text-[13px] text-slate-400">({lead.google_review_count})</span>
                          </div>
                        ) : (
                          <span className="text-[13px] text-slate-400">No reviews</span>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-medium uppercase tracking-wide border ${getStatusColor(
                            lead.status
                          )}`}
                        >
                          {lead.status}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          <a
                            href={`tel:${lead.phone}`}
                            onClick={(e) => e.stopPropagation()}
                            className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Call"
                          >
                            <Phone className="w-4 h-4" />
                          </a>
                          {lead.has_demo_site && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(`/demo/${lead.id}`, '_blank');
                              }}
                              className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                              title="View demo"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </button>
                          )}
                          {lead.follow_up_date && (
                            <div className="flex items-center gap-1.5 text-amber-600 text-[11px] bg-amber-50 px-2 py-1 rounded">
                              <Clock className="w-3 h-3" />
                              Follow up
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
