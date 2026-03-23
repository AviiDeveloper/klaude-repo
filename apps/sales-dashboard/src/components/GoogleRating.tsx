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

  const fullStars = Math.floor(rating);
  const hasHalf = rating - fullStars >= 0.3;

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={`w-3.5 h-3.5 ${
              i < fullStars
                ? 'fill-sd-gold text-sd-gold'
                : i === fullStars && hasHalf
                ? 'fill-sd-gold/50 text-sd-gold'
                : 'text-sd-border'
            }`}
          />
        ))}
      </div>
      <span className="text-sd-text-muted text-xs">
        {rating.toFixed(1)}
        {!compact && reviewCount ? ` (${reviewCount})` : ''}
      </span>
    </div>
  );
}
