'use client';

import { useState, useEffect } from 'react';
import { MapPin, Calendar, Award, TrendingUp, DollarSign } from 'lucide-react';

interface UserProfile {
  name: string;
  username: string;
  area: string;
  joined_date: string;
  stats: {
    total_leads: number;
    total_sales: number;
    total_commission: number;
    close_rate: number;
  };
  recent_activity: {
    id: string;
    action: string;
    business_name: string;
    timestamp: string;
  }[];
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/profile');
      const data = await res.json();
      setProfile(data);
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch profile', err);
      setLoading(false);
    }
  };

  if (loading || !profile) {
    return (
      <div className="pt-20 text-center text-[13px] text-[#666]">Loading...</div>
    );
  }

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'visited':
        return '👋';
      case 'pitched':
        return '💼';
      case 'sold':
        return '✅';
      case 'rejected':
        return '❌';
      default:
        return '📋';
    }
  };

  const getActionColor = (action: string) => {
    const colors = {
      visited: 'text-yellow-500',
      pitched: 'text-purple-400',
      sold: 'text-green-400',
      rejected: 'text-[#666]',
    };
    return colors[action as keyof typeof colors] || 'text-[#999]';
  };

  return (
    <div className="py-8 page-enter">
      {/* Header */}
      <div className="bg-[#0a0a0a] rounded-xl border border-[#333] p-8 mb-8">
        <div className="flex items-start gap-6">
          {/* Avatar */}
          <div className="w-20 h-20 rounded-full bg-white text-black flex items-center justify-center text-[28px] font-semibold flex-shrink-0">
            {profile.name.charAt(0).toUpperCase()}
          </div>

          {/* User Info */}
          <div className="flex-1">
            <h1 className="text-[24px] font-semibold text-white tracking-[-0.03em] mb-2">
              {profile.name}
            </h1>
            <p className="text-[15px] text-[#666] mb-4">@{profile.username}</p>

            <div className="flex flex-wrap gap-4 text-[13px] text-[#999]">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#666]" />
                {profile.area}
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#666]" />
                Joined {new Date(profile.joined_date).toLocaleDateString('en-GB', {
                  month: 'long',
                  year: 'numeric',
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid md:grid-cols-4 gap-4 mb-8">
        <div className="bg-[#0a0a0a] rounded-xl border border-[#333] p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-blue-400" />
            </div>
            <p className="text-[11px] uppercase tracking-wide text-[#666]">Total Leads</p>
          </div>
          <p className="text-[28px] font-semibold text-white font-mono">{profile.stats.total_leads}</p>
        </div>

        <div className="bg-[#0a0a0a] rounded-xl border border-[#333] p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
              <Award className="w-4 h-4 text-green-400" />
            </div>
            <p className="text-[11px] uppercase tracking-wide text-[#666]">Total Sales</p>
          </div>
          <p className="text-[28px] font-semibold text-green-400 font-mono">{profile.stats.total_sales}</p>
        </div>

        <div className="bg-[#0a0a0a] rounded-xl border border-[#333] p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-purple-400" />
            </div>
            <p className="text-[11px] uppercase tracking-wide text-[#666]">Commission</p>
          </div>
          <p className="text-[28px] font-semibold text-white font-mono">
            £{profile.stats.total_commission.toLocaleString()}
          </p>
        </div>

        <div className="bg-[#0a0a0a] rounded-xl border border-[#333] p-5">
          <div className="flex items-center gap-3 mb-3">
            <p className="text-[11px] uppercase tracking-wide text-[#666]">Close Rate</p>
          </div>
          <p className="text-[28px] font-semibold text-white font-mono">{profile.stats.close_rate}%</p>
        </div>
      </div>

      {/* Performance Summary */}
      <div className="bg-[#0a0a0a] rounded-xl border border-[#333] p-6 mb-8">
        <h2 className="text-[15px] font-semibold text-white mb-4">Performance Summary</h2>

        <div className="grid md:grid-cols-3 gap-6">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-[#666] mb-2">Average per Week</p>
            <p className="text-[20px] font-semibold text-white font-mono mb-1">
              {Math.round(profile.stats.total_leads / 12)} leads
            </p>
            <p className="text-[13px] text-[#666]">
              {Math.round(profile.stats.total_sales / 12)} sales
            </p>
          </div>

          <div>
            <p className="text-[11px] uppercase tracking-wide text-[#666] mb-2">Best Month</p>
            <p className="text-[20px] font-semibold text-white font-mono mb-1">£850</p>
            <p className="text-[13px] text-[#666]">17 sales in February</p>
          </div>

          <div>
            <p className="text-[11px] uppercase tracking-wide text-[#666] mb-2">Current Streak</p>
            <p className="text-[20px] font-semibold text-white font-mono mb-1">5 days</p>
            <p className="text-[13px] text-[#666]">Keep it up! 🔥</p>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-[#0a0a0a] rounded-xl border border-[#333] overflow-hidden">
        <div className="p-6 border-b border-[#222]">
          <h2 className="text-[15px] font-semibold text-white">Recent Activity</h2>
        </div>

        <div className="divide-y divide-[#222]">
          {profile.recent_activity.map((activity) => {
            const timeAgo = getTimeAgo(new Date(activity.timestamp));

            return (
              <div key={activity.id} className="p-5 hover:bg-[#111] transition-colors">
                <div className="flex items-start gap-4">
                  <span className="text-2xl flex-shrink-0">{getActionIcon(activity.action)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-[#ededed]">
                      <span className={`font-medium ${getActionColor(activity.action)} capitalize`}>
                        {activity.action}
                      </span>{' '}
                      <span className="text-[#999]">{activity.business_name}</span>
                    </p>
                    <p className="text-[12px] text-[#666] mt-0.5">{timeAgo}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) {
    return `${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
  } else if (diffDays < 7) {
    return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
  } else {
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }
}
