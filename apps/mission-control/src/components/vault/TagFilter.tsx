'use client';

import { useVaultStore } from '@/lib/vault-store';

export function TagFilter() {
  const { allTags, activeTags, toggleTag } = useVaultStore();

  if (allTags.length === 0) return null;

  return (
    <div className="px-3 py-2 border-b border-mc-border">
      <div className="text-[10px] uppercase tracking-wider text-mc-text-secondary mb-1.5">Tags</div>
      <div className="flex flex-wrap gap-1">
        {allTags.map((tag) => {
          const isActive = activeTags.includes(tag);
          return (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                isActive
                  ? 'bg-mc-accent-purple/25 text-mc-accent-purple border-mc-accent-purple/50'
                  : 'bg-mc-bg-tertiary text-mc-text-secondary border-mc-border hover:border-mc-text-secondary'
              }`}
            >
              {tag}
            </button>
          );
        })}
      </div>
    </div>
  );
}
