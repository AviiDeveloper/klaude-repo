'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import { Plus, ChevronRight } from 'lucide-react';
import type { TeamMember } from '@/lib/types';

export default function TeamPage() {
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', pin: '', email: '', phone: '', area_postcode: '', commission_rate: '0.10' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadTeam(); }, []);

  async function loadTeam() {
    const res = await fetch('/api/team');
    const data = await res.json();
    setTeam(data.data ?? []);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await fetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, commission_rate: parseFloat(form.commission_rate) }),
      });
      setShowAdd(false);
      setForm({ name: '', pin: '', email: '', phone: '', area_postcode: '', commission_rate: '0.10' });
      loadTeam();
    } finally { setSaving(false); }
  }

  async function toggleStatus(id: string, currentStatus: string) {
    const newStatus = currentStatus === 'available' ? 'paused' : 'available';
    await fetch(`/api/team/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_status: newStatus }),
    });
    loadTeam();
  }

  return (
    <div className="flex min-h-screen bg-surface-alt">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-lg font-semibold text-primary">Team</h1>
            <p className="text-sm text-muted">{team.length} salespeople</p>
          </div>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-hover transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Person
          </button>
        </div>

        {/* Add Form */}
        {showAdd && (
          <form onSubmit={handleAdd} className="bg-white rounded-xl border border-surface-border p-5 mb-6">
            <h3 className="text-sm font-semibold text-primary mb-4">New Salesperson</h3>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="px-3 py-2 rounded-lg border border-surface-border text-sm" required />
              <input placeholder="PIN (4+ digits)" value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value })}
                className="px-3 py-2 rounded-lg border border-surface-border text-sm" required />
              <input placeholder="Area Postcode (e.g. M4)" value={form.area_postcode} onChange={(e) => setForm({ ...form, area_postcode: e.target.value })}
                className="px-3 py-2 rounded-lg border border-surface-border text-sm" />
              <input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="px-3 py-2 rounded-lg border border-surface-border text-sm" />
              <input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="px-3 py-2 rounded-lg border border-surface-border text-sm" />
              <input placeholder="Commission Rate" value={form.commission_rate} onChange={(e) => setForm({ ...form, commission_rate: e.target.value })}
                className="px-3 py-2 rounded-lg border border-surface-border text-sm" type="number" step="0.01" />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-hover disabled:opacity-50">
                {saving ? 'Creating...' : 'Create'}
              </button>
              <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-lg border border-surface-border text-sm text-muted hover:bg-surface-alt">
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Team Table */}
        <div className="bg-white rounded-xl border border-surface-border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-border bg-surface-alt">
                <th className="text-left px-5 py-3 text-[11px] font-semibold text-muted uppercase tracking-wider">Name</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold text-muted uppercase tracking-wider">Area</th>
                <th className="text-center px-5 py-3 text-[11px] font-semibold text-muted uppercase tracking-wider">Active Leads</th>
                <th className="text-center px-5 py-3 text-[11px] font-semibold text-muted uppercase tracking-wider">Visits</th>
                <th className="text-center px-5 py-3 text-[11px] font-semibold text-muted uppercase tracking-wider">Sales</th>
                <th className="text-center px-5 py-3 text-[11px] font-semibold text-muted uppercase tracking-wider">Conversion</th>
                <th className="text-right px-5 py-3 text-[11px] font-semibold text-muted uppercase tracking-wider">Commission</th>
                <th className="text-center px-5 py-3 text-[11px] font-semibold text-muted uppercase tracking-wider">Status</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {team.map((m) => (
                <tr key={m.id} className="border-b border-surface-border table-row-hover">
                  <td className="px-5 py-3.5">
                    <div className="text-sm font-medium text-primary">{m.name}</div>
                    {m.email && <div className="text-xs text-muted">{m.email}</div>}
                  </td>
                  <td className="px-5 py-3.5 text-sm text-muted">{m.area_postcode ?? '—'}</td>
                  <td className="px-5 py-3.5 text-sm text-center">{m.active_leads}</td>
                  <td className="px-5 py-3.5 text-sm text-center">{m.total_visits}</td>
                  <td className="px-5 py-3.5 text-sm text-center font-medium">{m.total_sales}</td>
                  <td className="px-5 py-3.5 text-sm text-center">{m.conversion_rate.toFixed(0)}%</td>
                  <td className="px-5 py-3.5 text-sm text-right font-medium text-success">£{m.total_commission.toFixed(0)}</td>
                  <td className="px-5 py-3.5 text-center">
                    <button
                      onClick={() => toggleStatus(m.id, m.user_status)}
                      className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                        m.user_status === 'available'
                          ? 'bg-green-50 text-success'
                          : m.user_status === 'paused'
                          ? 'bg-amber-50 text-warning'
                          : 'bg-red-50 text-danger'
                      }`}
                    >
                      {m.user_status ?? 'available'}
                    </button>
                  </td>
                  <td className="px-5 py-3.5">
                    <ChevronRight className="w-4 h-4 text-muted-light" />
                  </td>
                </tr>
              ))}
              {team.length === 0 && (
                <tr><td colSpan={9} className="px-5 py-12 text-center text-sm text-muted">No team members yet. Click "Add Person" to get started.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
