'use client';

import { useState } from 'react';
import type { AssignmentStatus } from '@/lib/types';
import { Check, Loader2, X } from 'lucide-react';
import clsx from 'clsx';

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

export function ActionButtons({ assignmentId, currentStatus, onStatusChange }: ActionButtonsProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const action = NEXT_ACTION[currentStatus];

  async function handleAction(status: AssignmentStatus) {
    setLoading(status);
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

      const res = await fetch(`/api/leads/${assignmentId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, location_lat, location_lng }),
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
      <div className="flex items-center gap-2 py-2.5 px-3 bg-status-sold/5 rounded-lg">
        <Check className="w-4 h-4 text-status-sold" />
        <span className="text-sm font-medium text-status-sold">Sale complete</span>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      {action && (
        <button
          onClick={() => handleAction(action.status)}
          disabled={!!loading}
          className="flex-1 bg-primary hover:bg-primary/90 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg flex items-center justify-center gap-2 transition-opacity"
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
          onClick={() => handleAction('rejected')}
          disabled={!!loading}
          className="py-2.5 px-3 border border-border rounded-lg text-muted hover:text-status-rejected hover:border-status-rejected/30 transition-colors"
          title="Reject"
        >
          {loading === 'rejected' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <X className="w-4 h-4" />
          )}
        </button>
      )}
    </div>
  );
}
