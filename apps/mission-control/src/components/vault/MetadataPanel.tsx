'use client';

import { ArrowLeft, Link2, Tag } from 'lucide-react';
import { useVaultStore } from '@/lib/vault-store';

export function MetadataPanel() {
  const { activeFile, openFile } = useVaultStore();

  if (!activeFile) {
    return (
      <div className="p-4 text-xs text-mc-text-secondary">
        <div className="text-[10px] uppercase tracking-wider mb-3 font-semibold">Metadata</div>
        <p>Select a file to view its metadata, backlinks, and connections.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-3 border-b border-mc-border">
        <div className="text-xs uppercase tracking-wider text-mc-text-secondary font-semibold">
          Metadata
        </div>
      </div>

      <div className="p-3 space-y-4 flex-1 overflow-y-auto">
        {/* File info */}
        <section>
          <div className="text-[10px] uppercase tracking-wider text-mc-text-secondary mb-2">File</div>
          <div className="text-xs text-mc-text break-all">{activeFile.path}</div>
          <div className="text-[10px] text-mc-text-secondary mt-1">
            Collection: <span className="text-mc-text">{activeFile.collection}</span>
          </div>
        </section>

        {/* Tags */}
        {activeFile.tags.length > 0 && (
          <section>
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-mc-text-secondary mb-2">
              <Tag className="w-3 h-3" />
              Tags
            </div>
            <div className="flex flex-wrap gap-1">
              {activeFile.tags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => useVaultStore.getState().toggleTag(tag)}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-mc-accent-purple/15 text-mc-accent-purple border border-mc-accent-purple/30 hover:bg-mc-accent-purple/25 transition-colors"
                >
                  {tag}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Backlinks */}
        <section>
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-mc-text-secondary mb-2">
            <ArrowLeft className="w-3 h-3" />
            Backlinks ({activeFile.backlinks.length})
          </div>
          {activeFile.backlinks.length === 0 ? (
            <div className="text-xs text-mc-text-secondary italic">No backlinks</div>
          ) : (
            <div className="space-y-1">
              {activeFile.backlinks.map((bl) => (
                <button
                  key={bl.id}
                  onClick={() => {
                    const [col, ...pathParts] = bl.id.split(':');
                    void openFile(col, pathParts.join(':'));
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-mc-text-secondary hover:text-mc-accent hover:bg-mc-bg-tertiary rounded transition-colors text-left"
                >
                  <ArrowLeft className="w-3 h-3 flex-shrink-0" />
                  <div className="truncate">
                    <span className="text-mc-text">{bl.title}</span>
                    <span className="text-[10px] text-mc-text-secondary ml-1">({bl.collection})</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Outgoing Links (wikilinks) */}
        {activeFile.wikilinks.length > 0 && (
          <section>
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-mc-text-secondary mb-2">
              <Link2 className="w-3 h-3" />
              Outgoing Links ({activeFile.wikilinks.length})
            </div>
            <div className="space-y-1">
              {activeFile.wikilinks.map((wl, i) => {
                const resolved = activeFile.wikilinkMap[wl];
                if (!resolved) {
                  return (
                    <div key={i} className="px-2 py-1 text-xs text-mc-text-secondary opacity-50 flex items-center gap-2">
                      <Link2 className="w-3 h-3" />
                      <span className="line-through">{wl}</span>
                      <span className="text-[10px]">(unresolved)</span>
                    </div>
                  );
                }
                const [col, ...pathParts] = resolved.split(':');
                return (
                  <button
                    key={i}
                    onClick={() => void openFile(col, pathParts.join(':'))}
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-mc-text-secondary hover:text-mc-accent-cyan hover:bg-mc-bg-tertiary rounded transition-colors text-left"
                  >
                    <Link2 className="w-3 h-3 flex-shrink-0" />
                    <span>{wl}</span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Frontmatter details */}
        {Object.keys(activeFile.frontmatter).filter((k) => k !== 'tags').length > 0 && (
          <section>
            <div className="text-[10px] uppercase tracking-wider text-mc-text-secondary mb-2">
              Properties
            </div>
            <div className="space-y-1">
              {Object.entries(activeFile.frontmatter)
                .filter(([key]) => key !== 'tags')
                .map(([key, value]) => (
                  <div key={key} className="text-xs">
                    <span className="text-mc-text-secondary">{key}</span>
                    <div className="text-mc-text ml-2 break-all">
                      {Array.isArray(value) ? value.join(', ') : String(value)}
                    </div>
                  </div>
                ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
