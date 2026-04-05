'use client';

import { useEffect } from 'react';
import { ChevronRight, ChevronDown, FileText, FolderOpen, Folder, BookOpen, Lock, History, File } from 'lucide-react';
import { useVaultStore, type CollectionTreeEntry } from '@/lib/vault-store';

const COLLECTION_ICONS: Record<string, typeof BookOpen> = {
  BookOpen,
  Lock,
  History,
  FileText,
};

function TreeNode({
  entry,
  collectionId,
  depth,
}: {
  entry: CollectionTreeEntry;
  collectionId: string;
  depth: number;
}) {
  const { openFile, activeFile, expandedFolders, toggleFolder } = useVaultStore();
  const folderId = `${collectionId}:${entry.path}`;
  const isExpanded = expandedFolders.has(folderId);
  const isActive = activeFile?.collection === collectionId && activeFile?.path === entry.path;

  if (entry.type === 'directory') {
    return (
      <div>
        <button
          onClick={() => toggleFolder(folderId)}
          className="w-full flex items-center gap-1.5 px-2 py-1 text-xs text-mc-text-secondary hover:text-mc-text hover:bg-mc-bg-tertiary rounded transition-colors"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          {isExpanded ? (
            <ChevronDown className="w-3 h-3 flex-shrink-0" />
          ) : (
            <ChevronRight className="w-3 h-3 flex-shrink-0" />
          )}
          {isExpanded ? (
            <FolderOpen className="w-3.5 h-3.5 flex-shrink-0 text-mc-accent" />
          ) : (
            <Folder className="w-3.5 h-3.5 flex-shrink-0 text-mc-accent" />
          )}
          <span className="truncate">{entry.name}</span>
        </button>
        {isExpanded && entry.children && (
          <div>
            {entry.children.map((child) => (
              <TreeNode key={child.path} entry={child} collectionId={collectionId} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={() => void openFile(collectionId, entry.path)}
      className={`w-full flex items-center gap-1.5 px-2 py-1 text-xs rounded transition-colors ${
        isActive
          ? 'bg-mc-accent/15 text-mc-accent'
          : 'text-mc-text-secondary hover:text-mc-text hover:bg-mc-bg-tertiary'
      }`}
      style={{ paddingLeft: `${depth * 12 + 8}px` }}
      title={entry.path}
    >
      <File className="w-3.5 h-3.5 flex-shrink-0" />
      <span className="truncate">{entry.name.replace(/\.md$/, '')}</span>
    </button>
  );
}

export function VaultFileTree() {
  const { collections, loadTree, expandedFolders, toggleFolder } = useVaultStore();

  useEffect(() => {
    void loadTree();
  }, [loadTree]);

  if (!collections) {
    return (
      <div className="p-4 text-xs text-mc-text-secondary animate-pulse">
        Loading vault index...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-3 border-b border-mc-border">
        <div className="text-xs uppercase tracking-wider text-mc-text-secondary font-semibold">
          Vault Explorer
        </div>
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {collections.map((col) => {
          const Icon = COLLECTION_ICONS[col.icon] || FileText;
          const colFolderId = `root:${col.id}`;
          const isExpanded = expandedFolders.has(colFolderId);
          const fileCount = countFiles(col.entries);

          return (
            <div key={col.id} className="mb-1">
              <button
                onClick={() => toggleFolder(colFolderId)}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-mc-bg-tertiary transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="w-3 h-3 text-mc-text-secondary" />
                ) : (
                  <ChevronRight className="w-3 h-3 text-mc-text-secondary" />
                )}
                <Icon className={`w-3.5 h-3.5 text-${col.color}`} />
                <span className="font-medium text-mc-text">{col.label}</span>
                <span className="ml-auto text-[10px] text-mc-text-secondary">{fileCount}</span>
              </button>
              {isExpanded && (
                <div>
                  {col.entries.map((entry) => (
                    <TreeNode key={entry.path} entry={entry} collectionId={col.id} depth={1} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function countFiles(entries: CollectionTreeEntry[]): number {
  let count = 0;
  for (const e of entries) {
    if (e.type === 'file') count++;
    if (e.children) count += countFiles(e.children);
  }
  return count;
}
