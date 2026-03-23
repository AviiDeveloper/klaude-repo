'use client';

import { useState } from 'react';
import type { AssignmentStatus } from '@/lib/types';
import { Check, Loader2, X, ChevronDown } from 'lucide-react';

interface ActionButtonsProps {
  assignmentId: string;
  currentStatus: AssignmentStatus;
  onStatusChange: (newStatus: AssignmentStatus) => void;
}

const NEXT_ACTION: Record<AssignmentStatus, { status: AssignmentStatus; label: string } | null> = {
  new: { status: 'visited', label: 'Mark as visited' },
  visited: { status: 'pitched', label: 'Mark as pitched' },
  pitched: { status: 'sold', label: 'Mark as sold' },
  sold: null,
  rejected: { status: 'new', label: 'Reopen lead' },
};

const REJECTION_REASONS = [
  'Not interested',
  'Too expensive',
  'Already has a provider',
  'Come back later',
  'Business closed / gone',
  'Wrong business type',
  'Couldn\'t reach decision maker',
  'Other',
];

export function ActionButtons({ assignmentId, currentStatus, onStatusChange }: ActionButtonsProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [showRejectMenu, setShowRejectMenu] = useState(false);
  const action = NEXT_ACTION[currentStatus];

  async function handleAction(status: AssignmentStatus, rejectionReason?: string) {
    setLoading(status);
    setShowRejectMenu(false);
    try {
      // Capture GPS for visit verification
      let location_lat: number | undefined;
      let location_lng: number | undefined;
      if (status === 'visited' && navigator.geolocation) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
          );
          location_lat = pos.coords.latitude;
          location_lng = pos.coords.longitude;
        } catch {
          // GPS unavailable — still allow marking visited
        }
      }

      const body: Record<string, unknown> = { status, location_lat, location_lng };
      if (rejectionReason) body.rejection_reason = rejectionReason;

      const res = await fetch(`/api/leads/${assignmentId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) onStatusChange(status);
    } catch (err) {
      console.error('Status update failed:', err);
    } finally {
      setLoading(null);
    }
  }

  if (currentStatus === 'sold') {
    return (
      <div className="flex items-center gap-2 py-3 px-4 bg-emerald-50 rounded-xl">
        <Check className="w-4 h-4 text-emerald-600" />
        <span className="text-[13px] font-medium text-emerald-700">Sale complete</span>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="flex gap-2">
        {action && (
          <button
            onClick={() => handleAction(action.status)}
            disabled={!!loading}
            className="flex-1 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-[13px] font-medium py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
          >
            {loading === action.status ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              action.label
            )}
          </button>
        )}

        {currentStatus !== 'rejected' && (
          <button
            onClick={() => setShowRejectMenu(!showRejectMenu)}
            disabled={!!loading}
            className="py-3 px-4 border border-slate-200 rounded-xl text-slate-400 hover:text-red-500 hover:border-red-200 transition-colors flex items-center gap-1"
            title="Reject lead"
          >
            {loading === 'rejected' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <X className="w-4 h-4" />
                <ChevronDown className="w-3 h-3" />
              </>
            )}
          </button>
        )}
      </div>

      {/* Rejection reason dropdown */}
      {showRejectMenu && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-10" onClick={() => setShowRejectMenu(false)} />

          {/* Menu */}
          <div className="absolute right-0 top-full mt-2 z-20 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden min-w-[240px]">
            <div className="px-4 py-2.5 border-b border-slate-100">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.06em]">Why are you rejecting?</span>
            </div>
            {REJECTION_REASONS.map((reason) => (
              <button
                key={reason}
                onClick={() => handleAction('rejected', reason)}
                className="w-full text-left px-4 py-2.5 text-[13px] text-slate-700 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0"
              >
                {reason}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
