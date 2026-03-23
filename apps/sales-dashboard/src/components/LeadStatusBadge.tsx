import type { AssignmentStatus } from '@/lib/types';
import clsx from 'clsx';

const STATUS_CONFIG: Record<AssignmentStatus, { label: string; bg: string; text: string }> = {
  new: { label: 'New', bg: 'bg-sd-blue/15', text: 'text-sd-blue' },
  visited: { label: 'Visited', bg: 'bg-sd-amber/15', text: 'text-sd-amber' },
  pitched: { label: 'Pitched', bg: 'bg-purple-500/15', text: 'text-purple-400' },
  sold: { label: 'Sold', bg: 'bg-sd-green/15', text: 'text-sd-green' },
  rejected: { label: 'Rejected', bg: 'bg-sd-red/15', text: 'text-sd-red' },
};

export function LeadStatusBadge({ status }: { status: AssignmentStatus }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.new;

  return (
    <span className={clsx('px-2.5 py-0.5 rounded-full text-xs font-semibold', config.bg, config.text)}>
      {config.label}
    </span>
  );
}
