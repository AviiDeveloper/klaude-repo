import { Star } from 'lucide-react';

export function GoogleRating({
  rating,
  reviewCount,
  compact = false,
}: {
  rating: number | null;
  reviewCount: number | null;
  compact?: boolean;
}) {
  if (!rating) return null;

  return (
    <span className="inline-flex items-center gap-1 text-xs text-secondary">
      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
      <span className="font-medium">{rating.toFixed(1)}</span>
      {!compact && reviewCount ? <span className="text-muted">({reviewCount})</span> : null}
    </span>
  );
}
