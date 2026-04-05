'use client';

import { useCallback, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { useVaultStore } from '@/lib/vault-store';

export function VaultSearch() {
  const { searchQuery, searchResults, search, clearSearch, openFile } = useVaultStore();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const handleInput = useCallback(
    (value: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        void search(value);
      }, 250);
    },
    [search]
  );

  return (
    <div className="p-3 border-b border-mc-border">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-mc-text-secondary" />
        <input
          type="text"
          placeholder="Search vault..."
          defaultValue={searchQuery}
          onChange={(e) => handleInput(e.target.value)}
          className="w-full bg-mc-bg border border-mc-border rounded pl-7 pr-7 py-1.5 text-xs text-mc-text placeholder:text-mc-text-secondary/50 focus:outline-none focus:border-mc-accent"
        />
        {searchQuery && (
          <button
            onClick={() => {
              clearSearch();
              const input = document.querySelector<HTMLInputElement>('.vault-search-input');
              if (input) input.value = '';
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-mc-text-secondary hover:text-mc-text"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Search Results */}
      {searchResults.length > 0 && (
        <div className="mt-2 max-h-64 overflow-y-auto space-y-0.5">
          <div className="text-[10px] text-mc-text-secondary uppercase tracking-wider mb-1">
            {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
          </div>
          {searchResults.map((result) => (
            <button
              key={result.id}
              onClick={() => void openFile(result.collection, result.relativePath)}
              className="w-full text-left px-2 py-1.5 rounded hover:bg-mc-bg-tertiary transition-colors"
            >
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] uppercase tracking-wider text-mc-text-secondary bg-mc-bg-tertiary px-1 py-0.5 rounded">
                  {result.collection}
                </span>
                <span className="text-xs text-mc-text font-medium truncate">{result.title}</span>
              </div>
              {result.snippet && (
                <div className="text-[10px] text-mc-text-secondary mt-0.5 line-clamp-2">
                  {result.snippet}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
