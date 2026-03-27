'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Upload, UserPlus, Users, Globe } from 'lucide-react';

interface Salesperson {
  id: string;
  name: string;
  phone: string | null;
  area_postcode: string | null;
  active: boolean;
  created_at: string;
}

interface Demo {
  id: string;
  business_name: string;
  category: string;
  city: string | null;
  postcode_prefix: string | null;
  created_at: string;
}

export default function AdminDashboard() {
  const [salespeople, setSalespeople] = useState<Salesperson[]>([]);
  const [demos, setDemos] = useState<Demo[]>([]);

  useEffect(() => {
    fetch('/api/admin/salespeople').then(r => r.json()).then(d => setSalespeople(d.data ?? []));
    fetch('/api/admin/demos').then(r => r.json()).then(d => setDemos(d.data ?? []));
  }, []);

  return (
    <div className="space-y-8">
      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-4">
        <Link
          href="/admin/upload"
          className="flex items-center gap-3 p-4 bg-[#111] border border-[#222] rounded-xl hover:border-[#444] transition-colors"
        >
          <Upload className="w-5 h-5 text-emerald-400" />
          <div>
            <p className="text-[14px] font-medium">Upload Demo Site</p>
            <p className="text-[12px] text-[#666]">Add a new demo HTML file</p>
          </div>
        </Link>
        <Link
          href="/admin/assign"
          className="flex items-center gap-3 p-4 bg-[#111] border border-[#222] rounded-xl hover:border-[#444] transition-colors"
        >
          <UserPlus className="w-5 h-5 text-blue-400" />
          <div>
            <p className="text-[14px] font-medium">Assign Lead</p>
            <p className="text-[12px] text-[#666]">Give a demo to a salesperson</p>
          </div>
        </Link>
      </div>

      {/* Salespeople */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-4 h-4 text-[#666]" />
          <h2 className="text-[14px] font-semibold text-[#999]">Salespeople ({salespeople.length})</h2>
        </div>
        <div className="bg-[#111] border border-[#222] rounded-xl overflow-hidden">
          {salespeople.length === 0 ? (
            <p className="text-[13px] text-[#555] p-4 text-center">No salespeople yet. They sign up at /signup</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#222] text-[11px] text-[#666] uppercase tracking-wider">
                  <th className="text-left p-3">Name</th>
                  <th className="text-left p-3">Phone</th>
                  <th className="text-left p-3">Area</th>
                  <th className="text-left p-3">Joined</th>
                </tr>
              </thead>
              <tbody>
                {salespeople.map(sp => (
                  <tr key={sp.id} className="border-b border-[#222] last:border-0">
                    <td className="p-3 text-[13px] font-medium">{sp.name}</td>
                    <td className="p-3 text-[13px] text-[#888]">{sp.phone ?? '-'}</td>
                    <td className="p-3 text-[13px] text-[#888]">{sp.area_postcode ?? '-'}</td>
                    <td className="p-3 text-[13px] text-[#666]">{new Date(sp.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Demo Sites */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Globe className="w-4 h-4 text-[#666]" />
          <h2 className="text-[14px] font-semibold text-[#999]">Demo Sites ({demos.length})</h2>
        </div>
        <div className="bg-[#111] border border-[#222] rounded-xl overflow-hidden">
          {demos.length === 0 ? (
            <div className="p-4 text-center">
              <p className="text-[13px] text-[#555]">No demos uploaded yet</p>
              <Link href="/admin/upload" className="text-[13px] text-blue-400 hover:underline mt-1 inline-block">
                Upload your first demo
              </Link>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#222] text-[11px] text-[#666] uppercase tracking-wider">
                  <th className="text-left p-3">Business</th>
                  <th className="text-left p-3">Category</th>
                  <th className="text-left p-3">Location</th>
                  <th className="text-left p-3">Uploaded</th>
                </tr>
              </thead>
              <tbody>
                {demos.map(d => (
                  <tr key={d.id} className="border-b border-[#222] last:border-0">
                    <td className="p-3 text-[13px] font-medium">{d.business_name}</td>
                    <td className="p-3 text-[13px] text-[#888]">{d.category}</td>
                    <td className="p-3 text-[13px] text-[#888]">{d.city ?? d.postcode_prefix ?? '-'}</td>
                    <td className="p-3 text-[13px] text-[#666]">{new Date(d.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
