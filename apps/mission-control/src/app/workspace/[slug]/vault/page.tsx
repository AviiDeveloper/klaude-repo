'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { ChevronLeft, Network, RefreshCw } from 'lucide-react';
import { Header } from '@/components/Header';
import { VaultFileTree } from '@/components/vault/VaultFileTree';
import { VaultSearch } from '@/components/vault/VaultSearch';
import { TagFilter } from '@/components/vault/TagFilter';
import { MarkdownViewer } from '@/components/vault/MarkdownViewer';
import { MetadataPanel } from '@/components/vault/MetadataPanel';
import { useVaultStore } from '@/lib/vault-store';
import type { Workspace } from '@/lib/types';

const GraphView = dynamic(() => import('@/components/vault/GraphView').then((m) => m.GraphView), {
  ssr: false,
});

export default function WorkspaceVaultPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const { toggleGraph, refreshIndex } = useVaultStore();

  useEffect(() => {
    async function loadWorkspace() {
      setIsLoading(true);
      setNotFound(false);
      try {
        const res = await fetch(`/api/workspaces/${slug}`);
        if (!res.ok) {
          setNotFound(res.status === 404);
          return;
        }
        const data = (await res.json()) as Workspace;
        setWorkspace(data);
      } catch {
        setNotFound(true);
      } finally {
        setIsLoading(false);
      }
    }
    void loadWorkspace();
  }, [slug]);

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Cmd+K for search focus
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        const input = document.querySelector<HTMLInputElement>('input[placeholder="Search vault..."]');
        if (input) input.focus();
      }
      // Escape to close graph
      if (e.key === 'Escape') {
        const { graphVisible } = useVaultStore.getState();
        if (graphVisible) {
          useVaultStore.getState().toggleGraph();
        }
      }
    },
    []
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (notFound) {
    return (
      <div className="min-h-screen bg-mc-bg flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Workspace Not Found</h1>
          <p className="text-mc-text-secondary mb-6">
            The workspace &ldquo;{slug}&rdquo; doesn&apos;t exist.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-mc-accent text-mc-bg rounded-lg font-medium"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading || !workspace) {
    return (
      <div className="min-h-screen bg-mc-bg flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-pulse opacity-30">{"{ }"}</div>
          <p className="text-mc-text-secondary">Loading Vault...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-mc-bg overflow-hidden">
      <Header workspace={workspace} />

      {/* Toolbar */}
      <div className="h-10 bg-mc-bg-secondary border-b border-mc-border flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-mc-text-secondary uppercase tracking-wider">Vault Viewer</span>
          <span className="text-xs text-mc-text-secondary opacity-40">|</span>
          <span className="text-[10px] text-mc-text-secondary">Cmd+K to search</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void refreshIndex()}
            className="inline-flex items-center gap-1.5 px-2 py-1 text-xs text-mc-text-secondary hover:text-mc-text hover:bg-mc-bg-tertiary rounded transition-colors"
            title="Refresh index"
          >
            <RefreshCw className="w-3 h-3" />
            Refresh
          </button>
          <button
            onClick={toggleGraph}
            className="inline-flex items-center gap-1.5 px-2 py-1 text-xs text-mc-accent hover:bg-mc-accent/10 rounded transition-colors border border-mc-accent/30"
            title="Open graph view"
          >
            <Network className="w-3.5 h-3.5" />
            Graph
          </button>
        </div>
      </div>

      {/* Three-column layout */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left sidebar: File Tree */}
        <aside className="w-64 flex-shrink-0 border-r border-mc-border bg-mc-bg-secondary flex flex-col overflow-hidden">
          <VaultSearch />
          <TagFilter />
          <VaultFileTree />
        </aside>

        {/* Center: Markdown Viewer */}
        <div className="flex-1 bg-mc-bg flex flex-col overflow-hidden">
          <MarkdownViewer />
        </div>

        {/* Right sidebar: Metadata Panel */}
        <aside className="w-56 flex-shrink-0 border-l border-mc-border bg-mc-bg-secondary overflow-hidden">
          <MetadataPanel />
        </aside>
      </main>

      {/* Graph overlay */}
      <GraphView />
    </div>
  );
}
