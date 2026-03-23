'use client';

import { useState } from 'react';
import { CalendarDays, Clock, X, Check, MessageCircle } from 'lucide-react';

interface FollowUpProps {
  assignmentId: string;
  followUpAt: string | null;
  followUpNote: string | null;
  onUpdate: () => void;
}

export function FollowUp({ assignmentId, followUpAt, followUpNote, onUpdate }: FollowUpProps) {
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(followUpAt?.split('T')[0] ?? '');
  const [note, setNote] = useState(followUpNote ?? '');
  const [saving, setSaving] = useState(false);

  const hasFollowUp = !!followUpAt;
  const isOverdue = hasFollowUp && new Date(followUpAt) < new Date();
  const isPending = hasFollowUp && !isOverdue;

  async function save() {
    setSaving(true);
    await fetch(`/api/leads/${assignmentId}/followup`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        follow_up_at: date ? new Date(date).toISOString() : null,
        follow_up_note: note || null,
      }),
    });
    setSaving(false);
    setEditing(false);
    onUpdate();
  }

  async function clear() {
    setSaving(true);
    await fetch(`/api/leads/${assignmentId}/followup`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ follow_up_at: null, follow_up_note: null }),
    });
    setSaving(false);
    setDate('');
    setNote('');
    onUpdate();
  }

  function formatDate(iso: string): string {
    const d = new Date(iso);
    const now = new Date();
    const diff = d.getTime() - now.getTime();
    const days = Math.ceil(diff / 86400000);

    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    if (days < 7) return d.toLocaleDateString('en-GB', { weekday: 'long' });
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }

  if (editing) {
    return (
      <div className="border border-slate-200 rounded-xl p-4">
        <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.08em] mb-3">Set Follow-up</h4>
        <div className="space-y-3">
          <div>
            <label className="text-[11px] text-slate-500 mb-1 block">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/5 focus:border-slate-300"
            />
          </div>
          <div>
            <label className="text-[11px] text-slate-500 mb-1 block">Note (optional)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Call back about pricing"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/5 focus:border-slate-300"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={!date || saving}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white rounded-lg text-[12px] font-medium disabled:opacity-40 hover:bg-slate-800 transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
              {saving ? 'Saving...' : 'Set reminder'}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="px-3 py-2 text-[12px] text-slate-500 hover:text-slate-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (hasFollowUp) {
    return (
      <div className={`flex items-center justify-between px-4 py-3 rounded-xl border ${
        isOverdue ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'
      }`}>
        <div className="flex items-center gap-3">
          <CalendarDays className={`w-4 h-4 ${isOverdue ? 'text-red-500' : 'text-amber-500'}`} />
          <div>
            <div className={`text-[13px] font-medium ${isOverdue ? 'text-red-700' : 'text-amber-700'}`}>
              {isOverdue ? 'Overdue' : 'Follow up'}: {formatDate(followUpAt)}
            </div>
            {followUpNote && (
              <div className={`text-[11px] mt-0.5 ${isOverdue ? 'text-red-500' : 'text-amber-600'}`}>
                {followUpNote}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setEditing(true)}
            className="p-1.5 rounded-md hover:bg-white/50 transition-colors"
            title="Edit"
          >
            <CalendarDays className="w-3.5 h-3.5 text-slate-500" />
          </button>
          <button
            onClick={clear}
            className="p-1.5 rounded-md hover:bg-white/50 transition-colors"
            title="Clear"
          >
            <X className="w-3.5 h-3.5 text-slate-500" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="flex items-center gap-2 w-full px-4 py-3 border border-dashed border-slate-200 rounded-xl text-[13px] text-slate-500 hover:border-slate-300 hover:text-slate-700 hover:bg-slate-50 transition-all"
    >
      <CalendarDays className="w-4 h-4" />
      Set a follow-up reminder
    </button>
  );
}
