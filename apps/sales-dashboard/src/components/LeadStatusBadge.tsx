import type { AssignmentStatus } from '@/lib/types';
import clsx from 'clsx';

const STATUS_CONFIG: Record<AssignmentStatus, { label: string; dot: string; text: string }> = {
  new: { label: 'New', dot: 'bg-status-new', text: 'text-status-new' },
  visited: { label: 'Visited', dot: 'bg-status-visited', text: 'text-status-visited' },
  pitched: { label: 'Pitched', dot: 'bg-status-pitched', text: 'text-status-pitched' },
  sold: { label: 'Sold', dot: 'bg-status-sold', text: 'text-status-sold' },
  rejected: { label: 'Rejected', dot: 'bg-status-rejected', text: 'text-status-rejected' },
};

export function LeadStatusBadge({ status }: { status: AssignmentStatus }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.new;
  return (
    <span className={clsx('inline-flex items-center gap-1.5 text-2xs font-medium', config.text)}>
      <span className={clsx('w-1.5 h-1.5 rounded-full', config.dot)} />
      {config.label}
    </span>
  );
}
