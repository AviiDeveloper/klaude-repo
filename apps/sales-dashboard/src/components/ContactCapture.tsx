'use client';

import { useState, useEffect, useRef } from 'react';
import { UserCircle, Check, Pencil } from 'lucide-react';

interface ContactCaptureProps {
  assignmentId: string;
  contactName: string | null;
  contactRole: string | null;
  onUpdate: () => void;
}

export function ContactCapture({ assignmentId, contactName, contactRole, onUpdate }: ContactCaptureProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(contactName ?? '');
  const [role, setRole] = useState(contactRole ?? '');
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && nameRef.current) nameRef.current.focus();
  }, [editing]);

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    await fetch(`/api/leads/${assignmentId}/followup`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contact_name: name.trim() || null,
        contact_role: role.trim() || null,
      }),
    });
    setSaving(false);
    setEditing(false);
    onUpdate();
  }

  const hasContact = !!contactName;

  if (editing) {
    return (
      <div className="border border-slate-200 rounded-xl p-4">
        <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.08em] mb-3">Contact Person</h4>
        <div className="flex gap-2 mb-3">
          <input
            ref={nameRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name (e.g. Ahmed)"
            className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-[13px] text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/5 focus:border-slate-300"
          />
          <input
            type="text"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="Role (e.g. Owner)"
            className="w-32 border border-slate-200 rounded-lg px-3 py-2 text-[13px] text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/5 focus:border-slate-300"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={save}
            disabled={!name.trim() || saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white rounded-lg text-[12px] font-medium disabled:opacity-40 hover:bg-slate-800 transition-colors"
          >
            <Check className="w-3.5 h-3.5" />
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={() => { setEditing(false); setName(contactName ?? ''); setRole(contactRole ?? ''); }}
            className="px-3 py-2 text-[12px] text-slate-500 hover:text-slate-700 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (hasContact) {
    return (
      <div className="flex items-center justify-between px-4 py-3 bg-slate-50 rounded-xl">
        <div className="flex items-center gap-3">
          <UserCircle className="w-4 h-4 text-slate-400" />
          <div>
            <span className="text-[13px] font-medium text-slate-900">{contactName}</span>
            {contactRole && <span className="text-[12px] text-slate-400 ml-1.5">· {contactRole}</span>}
          </div>
        </div>
        <button
          onClick={() => setEditing(true)}
          className="p-1.5 rounded-md hover:bg-slate-100 transition-colors"
          title="Edit contact"
        >
          <Pencil className="w-3 h-3 text-slate-400" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="flex items-center gap-2 w-full px-4 py-3 border border-dashed border-slate-200 rounded-xl text-[13px] text-slate-500 hover:border-slate-300 hover:text-slate-700 hover:bg-slate-50 transition-all"
    >
      <UserCircle className="w-4 h-4" />
      Add contact person
    </button>
  );
}
