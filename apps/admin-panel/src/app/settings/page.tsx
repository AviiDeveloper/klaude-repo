'use client';

import Sidebar from '@/components/Sidebar';
import { Settings, Zap, MapPin, DollarSign } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="flex min-h-screen bg-surface-alt">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="mb-6">
          <h1 className="text-lg font-semibold text-primary">Settings</h1>
          <p className="text-sm text-muted">Configure assignment rules and commission</p>
        </div>

        <div className="space-y-6 max-w-2xl">
          {/* Auto-Assignment */}
          <div className="bg-white rounded-xl border border-surface-border p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                <Zap className="w-4 h-4 text-accent" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-primary">Auto-Assignment</h2>
                <p className="text-xs text-muted">Pipeline automatically assigns leads to salespeople</p>
              </div>
            </div>
            <div className="space-y-3">
              <label className="flex items-center justify-between py-2">
                <span className="text-sm text-primary">Enable auto-assignment</span>
                <input type="checkbox" defaultChecked className="w-4 h-4 rounded border-surface-border text-accent focus:ring-accent" />
              </label>
              <label className="flex items-center justify-between py-2">
                <span className="text-sm text-primary">Match by postcode area</span>
                <input type="checkbox" defaultChecked className="w-4 h-4 rounded border-surface-border text-accent focus:ring-accent" />
              </label>
              <label className="flex items-center justify-between py-2">
                <span className="text-sm text-primary">Load balance across team</span>
                <input type="checkbox" defaultChecked className="w-4 h-4 rounded border-surface-border text-accent focus:ring-accent" />
              </label>
            </div>
          </div>

          {/* Area Mapping */}
          <div className="bg-white rounded-xl border border-surface-border p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                <MapPin className="w-4 h-4 text-accent" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-primary">Area Mapping</h2>
                <p className="text-xs text-muted">Assign postcodes to team members via the Team page</p>
              </div>
            </div>
            <p className="text-sm text-muted">Area postcodes are configured per salesperson. Go to Team → Edit to set postcodes for each person.</p>
          </div>

          {/* Commission */}
          <div className="bg-white rounded-xl border border-surface-border p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-accent" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-primary">Commission & Pricing</h2>
                <p className="text-xs text-muted">Default rates for new salespeople</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted mb-1">Setup Fee</label>
                <div className="flex items-center">
                  <span className="text-sm text-muted mr-1">£</span>
                  <input type="number" defaultValue={350} className="px-3 py-2 rounded-lg border border-surface-border text-sm w-full" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1">Monthly Fee</label>
                <div className="flex items-center">
                  <span className="text-sm text-muted mr-1">£</span>
                  <input type="number" defaultValue={25} className="px-3 py-2 rounded-lg border border-surface-border text-sm w-full" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1">Default Commission Rate</label>
                <div className="flex items-center">
                  <input type="number" defaultValue={10} step={1} className="px-3 py-2 rounded-lg border border-surface-border text-sm w-full" />
                  <span className="text-sm text-muted ml-1">%</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1">Max Active Leads (default)</label>
                <input type="number" defaultValue={20} className="px-3 py-2 rounded-lg border border-surface-border text-sm w-full" />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
