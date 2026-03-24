'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, Navigation, Phone, ExternalLink } from 'lucide-react';

interface Lead {
  id: string;
  business_name: string;
  business_type: string;
  postcode: string;
  phone: string;
  status: 'new' | 'visited' | 'pitched' | 'sold' | 'rejected';
  has_demo_site: boolean;
}

interface AreaGroup {
  postcode_prefix: string;
  leads: Lead[];
  count: number;
}

export default function MapPage() {
  const router = useRouter();
  const [areas, setAreas] = useState<AreaGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAreas();
  }, []);

  const fetchAreas = async () => {
    try {
      const res = await fetch('/api/leads');
      const json = await res.json();
      const leads = json.data ?? json ?? [];

      // Group leads by postcode area
      const grouped: Record<string, AreaGroup> = {};
      for (const lead of leads) {
        const prefix = (lead.postcode ?? 'Unknown').split(' ')[0];
        if (!grouped[prefix]) {
          grouped[prefix] = { postcode_prefix: prefix, leads: [], count: 0 };
        }
        grouped[prefix].leads.push(lead);
        grouped[prefix].count++;
      }
      setAreas(Object.values(grouped));
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch areas', err);
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors = {
      new: 'bg-blue-500',
      visited: 'bg-amber-500',
      pitched: 'bg-purple-500',
      sold: 'bg-emerald-500',
      rejected: 'bg-slate-400',
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
        <div className="text-slate-400">Loading map...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-[28px] font-semibold text-slate-900 tracking-tight mb-1">Territory Map</h1>
          <p className="text-[15px] text-slate-500">
            Leads organized by postcode area
          </p>
        </div>

        {/* Area Grid */}
        <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {areas.map((area) => {
            const newCount = area.leads.filter(l => l.status === 'new').length;
            const visitedCount = area.leads.filter(l => l.status === 'visited').length;
            const soldCount = area.leads.filter(l => l.status === 'sold').length;

            return (
              <div key={area.postcode_prefix} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                {/* Area Header */}
                <div className="bg-slate-900 text-white p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <MapPin className="w-5 h-5 text-amber-400" />
                      <h2 className="text-[20px] font-semibold tracking-tight">{area.postcode_prefix}</h2>
                    </div>
                    <span className="px-2.5 py-1 bg-white/10 rounded-lg text-[13px] font-medium">
                      {area.count} leads
                    </span>
                  </div>

                  {/* Stats Row */}
                  <div className="flex items-center gap-4 text-[11px]">
                    {newCount > 0 && (
                      <span className="flex items-center gap-1.5 text-white/80">
                        <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                        {newCount} new
                      </span>
                    )}
                    {visitedCount > 0 && (
                      <span className="flex items-center gap-1.5 text-white/80">
                        <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                        {visitedCount} visited
                      </span>
                    )}
                    {soldCount > 0 && (
                      <span className="flex items-center gap-1.5 text-white/80">
                        <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                        {soldCount} sold
                      </span>
                    )}
                  </div>
                </div>

                {/* Leads List */}
                <div className="divide-y divide-slate-100">
                  {area.leads.slice(0, 5).map((lead) => (
                    <div
                      key={lead.id}
                      onClick={() => router.push(`/lead/${lead.id}`)}
                      className="p-4 hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2.5">
                          <span className="text-xl">{getBusinessEmoji(lead.business_type)}</span>
                          <div>
                            <p className="text-[13px] font-medium text-slate-900">{lead.business_name}</p>
                            <p className="text-[11px] text-slate-500 capitalize">{lead.business_type}</p>
                          </div>
                        </div>
                        <span className={`w-2 h-2 rounded-full ${getStatusColor(lead.status)} flex-shrink-0 mt-1.5`}></span>
                      </div>

                      <div className="flex items-center gap-3 ml-8">
                        <a
                          href={`tel:${lead.phone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-[11px] text-slate-500 hover:text-slate-900 transition-colors"
                        >
                          <Phone className="w-3.5 h-3.5 inline mr-1" />
                          Call
                        </a>
                        {lead.has_demo_site && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(`/demo/${lead.id}`, '_blank');
                            }}
                            className="text-[11px] text-slate-500 hover:text-slate-900 transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5 inline mr-1" />
                            Demo
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  {area.leads.length > 5 && (
                    <div className="p-4 text-center">
                      <button className="text-[12px] text-slate-500 hover:text-slate-900 transition-colors">
                        +{area.leads.length - 5} more
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty State */}
        {areas.length === 0 && (
          <div className="text-center py-16">
            <Navigation className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-[15px] text-slate-500">No leads assigned to your territory yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
