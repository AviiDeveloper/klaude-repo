'use client';

import { useState } from 'react';
import type { AssignmentStatus } from '@/lib/types';
import { Footprints, MessageCircle, BadgePoundSterling, XCircle, Loader2 } from 'lucide-react';
import clsx from 'clsx';

interface ActionButtonsProps {
  assignmentId: string;
  currentStatus: AssignmentStatus;
  onStatusChange: (newStatus: AssignmentStatus) => void;
}

const NEXT_ACTIONS: Record<AssignmentStatus, Array<{
  status: AssignmentStatus;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bg: string;
}>> = {
  new: [
    { status: 'visited', label: 'Mark Visited', icon: Footprints, color: 'text-white', bg: 'bg-sd-amber' },
  ],
  visited: [
    { status: 'pitched', label: 'Mark Pitched', icon: MessageCircle, color: 'text-white', bg: 'bg-purple-500' },
  ],
  pitched: [
    { status: 'sold', label: 'Mark Sold!', icon: BadgePoundSterling, color: 'text-white', bg: 'bg-sd-green' },
    { status: 'visited', label: 'Revisit', icon: Footprints, color: 'text-sd-amber', bg: 'bg-sd-amber/10 border border-sd-amber/30' },
  ],
  sold: [],
  rejected: [
    { status: 'new', label: 'Reopen', icon: Footprints, color: 'text-sd-blue', bg: 'bg-sd-blue/10 border border-sd-blue/30' },
  ],
};

export function ActionButtons({ assignmentId, currentStatus, onStatusChange }: ActionButtonsProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const actions = NEXT_ACTIONS[currentStatus] ?? [];

  if (actions.length === 0 && currentStatus === 'sold') {
    return (
      <div className="bg-sd-green/10 border border-sd-green/20 rounded-xl px-4 py-3 text-center">
        <BadgePoundSterling className="w-6 h-6 text-sd-green mx-auto mb-1" />
        <span className="text-sd-green font-semibold text-sm">Sale Complete</span>
      </div>
    );
  }

  async function handleAction(status: AssignmentStatus) {
    setLoading(status);
    try {
      const res = await fetch(`/api/leads/${assignmentId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      if (res.ok) {
        onStatusChange(status);
      }
    } catch (err) {
      console.error('Failed to update status:', err);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex gap-2">
      {actions.map(({ status, label, icon: Icon, color, bg }) => (
        <button
          key={status}
          onClick={() => handleAction(status)}
          disabled={!!loading}
          className={clsx(
            'flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-sm transition-all active:scale-[0.97]',
            bg,
            color,
            loading === status && 'opacity-70',
          )}
        >
          {loading === status ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <Icon className="w-5 h-5" />
              {label}
            </>
          )}
        </button>
      ))}

      {/* Reject button (always available unless sold) */}
      {currentStatus !== 'sold' && currentStatus !== 'rejected' && (
        <button
          onClick={() => handleAction('rejected')}
          disabled={!!loading}
          className="p-3.5 rounded-xl bg-sd-red/10 border border-sd-red/20 text-sd-red transition-all active:scale-[0.97]"
          title="Reject lead"
        >
          {loading === 'rejected' ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <XCircle className="w-5 h-5" />
          )}
        </button>
      )}
    </div>
  );
}
