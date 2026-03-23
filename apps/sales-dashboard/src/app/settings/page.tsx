'use client';

import { useEffect, useState } from 'react';
import { Lock, MapPin, Bell, Trash2, Loader2, Check, ChevronRight, Shield } from 'lucide-react';

export default function SettingsPage() {
  const [user, setUser] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  // PIN change
  const [showPinChange, setShowPinChange] = useState(false);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinSuccess, setPinSuccess] = useState(false);

  // Area change
  const [showAreaChange, setShowAreaChange] = useState(false);
  const [newArea, setNewArea] = useState('');
  const [areaSuccess, setAreaSuccess] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      setUser(d.data ?? null);
      setLoading(false);
    });
  }, []);

  async function handlePinChange() {
    setPinError('');
    if (newPin.length <= 3 || newPin.length > 6) { setPinError('PIN must be 4-6 digits'); return; }
    if (newPin !== confirmPin) { setPinError('PINs do not match'); return; }
    // TODO: backend endpoint for PIN change
    setPinSuccess(true);
    setTimeout(() => { setPinSuccess(false); setShowPinChange(false); setCurrentPin(''); setNewPin(''); setConfirmPin(''); }, 2000);
  }

  async function handleAreaChange() {
    if (newArea.trim().length <= 1) return;
    // TODO: backend endpoint for area change
    setAreaSuccess(true);
    setTimeout(() => { setAreaSuccess(false); setShowAreaChange(false); setNewArea(''); }, 2000);
  }

  if (loading) {
    return <div className="flex items-center justify-center py-32"><Loader2 className="w-5 h-5 text-slate-300 animate-spin" /></div>;
  }

  return (
    <>
      <div className="px-6 md:px-8 py-5 border-b border-slate-100">
        <h1 className="text-[15px] font-semibold text-slate-900">Settings</h1>
        <p className="text-[11px] text-slate-400 mt-0.5">Account preferences and security</p>
      </div>

      <div className="px-6 md:px-8 py-6 max-w-2xl">
        {/* Security */}
        <Section title="Security">
          <SettingRow
            icon={Lock}
            title="Change PIN"
            desc="Update your sign-in PIN"
            onClick={() => setShowPinChange(!showPinChange)}
          />
          {showPinChange && (
            <div className="ml-10 mt-3 mb-4 space-y-3">
              <input type="password" inputMode="numeric" maxLength={6} value={currentPin} onChange={e => setCurrentPin(e.target.value.replace(/\D/g, ''))} placeholder="Current PIN" className="w-full border border-slate-200 rounded-xl py-3 px-4 text-[13px] text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/10 tracking-[0.2em] text-center" />
              <input type="password" inputMode="numeric" maxLength={6} value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))} placeholder="New PIN" className="w-full border border-slate-200 rounded-xl py-3 px-4 text-[13px] text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/10 tracking-[0.2em] text-center" />
              <input type="password" inputMode="numeric" maxLength={6} value={confirmPin} onChange={e => setConfirmPin(e.target.value.replace(/\D/g, ''))} placeholder="Confirm new PIN" className="w-full border border-slate-200 rounded-xl py-3 px-4 text-[13px] text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/10 tracking-[0.2em] text-center" />
              {pinError && <p className="text-red-500 text-[12px]">{pinError}</p>}
              <button onClick={handlePinChange} disabled={pinSuccess} className="w-full bg-slate-900 text-white text-[13px] font-medium py-3 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2">
                {pinSuccess ? <><Check className="w-4 h-4" /> Updated</> : 'Update PIN'}
              </button>
            </div>
          )}

          <SettingRow
            icon={Shield}
            title="Two-factor authentication"
            desc="Coming soon"
            disabled
          />
        </Section>

        {/* Area */}
        <Section title="Coverage Area">
          <SettingRow
            icon={MapPin}
            title="Change area"
            desc={`Current: ${(user as any)?.area_postcode ?? 'Not set'}`}
            onClick={() => setShowAreaChange(!showAreaChange)}
          />
          {showAreaChange && (
            <div className="ml-10 mt-3 mb-4 space-y-3">
              <input type="text" value={newArea} onChange={e => setNewArea(e.target.value.toUpperCase())} placeholder="New postcode (e.g. M4, LS1)" className="w-full border border-slate-200 rounded-xl py-3 px-4 text-[13px] text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
              <button onClick={handleAreaChange} disabled={newArea.trim().length <= 1 || areaSuccess} className="w-full bg-slate-900 text-white text-[13px] font-medium py-3 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2">
                {areaSuccess ? <><Check className="w-4 h-4" /> Updated</> : 'Update Area'}
              </button>
            </div>
          )}
        </Section>

        {/* Notifications */}
        <Section title="Notifications">
          <ToggleRow title="New lead assigned" desc="When a lead is added to your queue" defaultOn />
          <ToggleRow title="Follow-up reminders" desc="Reminder on follow-up dates" defaultOn />
          <ToggleRow title="Weekly summary" desc="Your stats every Monday" defaultOn={false} />
        </Section>

        {/* Legal */}
        <Section title="Legal">
          <LinkRow title="Terms of Service" href="/legal/terms" />
          <LinkRow title="Privacy Policy" href="/legal/privacy" />
          <LinkRow title="Contractor Agreement" href="/legal/contractor" />
        </Section>

        {/* Danger Zone */}
        <Section title="Account">
          <SettingRow
            icon={Trash2}
            title="Delete account"
            desc="Permanently remove your account and all data"
            danger
            onClick={() => alert('Contact support to delete your account. This cannot be undone.')}
          />
        </Section>

        <p className="text-[10px] text-slate-300 mt-8 text-center">SalesFlow v1.0 — Build 2026.03</p>
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.08em] mb-3">{title}</h2>
      <div className="border border-slate-100 rounded-xl overflow-hidden divide-y divide-slate-50">
        {children}
      </div>
    </div>
  );
}

function SettingRow({ icon: Icon, title, desc, onClick, disabled, danger }: {
  icon: typeof Lock; title: string; desc: string; onClick?: () => void; disabled?: boolean; danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-3.5 px-4 py-3.5 text-left transition-colors ${disabled ? 'opacity-40' : 'hover:bg-slate-50'}`}
    >
      <Icon className={`w-4 h-4 flex-shrink-0 ${danger ? 'text-red-400' : 'text-slate-400'}`} />
      <div className="flex-1">
        <div className={`text-[13px] font-medium ${danger ? 'text-red-600' : 'text-slate-900'}`}>{title}</div>
        <div className="text-[11px] text-slate-400 mt-0.5">{desc}</div>
      </div>
      {!disabled && <ChevronRight className="w-4 h-4 text-slate-200" />}
    </button>
  );
}

function ToggleRow({ title, desc, defaultOn }: { title: string; desc: string; defaultOn?: boolean }) {
  const [on, setOn] = useState(defaultOn ?? true);
  return (
    <div className="flex items-center gap-3.5 px-4 py-3.5">
      <Bell className="w-4 h-4 text-slate-400 flex-shrink-0" />
      <div className="flex-1">
        <div className="text-[13px] font-medium text-slate-900">{title}</div>
        <div className="text-[11px] text-slate-400 mt-0.5">{desc}</div>
      </div>
      <button
        onClick={() => setOn(!on)}
        className={`w-10 h-6 rounded-full transition-colors ${on ? 'bg-slate-900' : 'bg-slate-200'}`}
      >
        <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform mx-1 ${on ? 'translate-x-4' : 'translate-x-0'}`} />
      </button>
    </div>
  );
}

function LinkRow({ title, href }: { title: string; href: string }) {
  return (
    <a href={href} className="flex items-center gap-3.5 px-4 py-3.5 hover:bg-slate-50 transition-colors">
      <Shield className="w-4 h-4 text-slate-400 flex-shrink-0" />
      <span className="text-[13px] font-medium text-slate-900 flex-1">{title}</span>
      <ChevronRight className="w-4 h-4 text-slate-200" />
    </a>
  );
}
