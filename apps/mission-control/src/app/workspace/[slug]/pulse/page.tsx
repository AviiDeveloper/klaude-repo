'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Activity, RefreshCw } from 'lucide-react';
import { Header } from '@/components/Header';
import { NextSteps } from '@/components/pulse/NextSteps';
import { UnfinishedWork } from '@/components/pulse/UnfinishedWork';
import { RecentActivity } from '@/components/pulse/RecentActivity';
import { LaunchChecklist } from '@/components/pulse/LaunchChecklist';
import { usePulseStore } from '@/lib/pulse-store';
import type { Workspace } from '@/lib/types';

export default function WorkspacePulsePage() {
  const params = useParams();
  const slug = params.slug as string;
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const { loadAll, isLoading: pulseLoading } = usePulseStore();

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
        await loadAll();
      } catch {
        setNotFound(true);
      } finally {
        setIsLoading(false);
      }
    }
    void loadWorkspace();
  }, [slug, loadAll]);

  if (notFound) {
    return (
      <div className="min-h-screen bg-mc-bg flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Workspace Not Found</h1>
          <p className="text-mc-text-secondary mb-6">
            The workspace &ldquo;{slug}&rdquo; doesn&apos;t exist.
          </p>
          <Link href="/" className="inline-flex items-center gap-2 px-6 py-3 bg-mc-accent text-mc-bg rounded-lg font-medium">
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
          <div className="text-4xl mb-4 animate-pulse opacity-30">~</div>
          <p className="text-mc-text-secondary">Scanning project...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-mc-bg overflow-hidden">
      <Header workspace={workspace} />
      <main className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Title */}
          <div className="rounded border border-mc-border bg-mc-bg-secondary p-4 flex items-center justify-between">
            <div>
              <div className="inline-flex items-center gap-2 text-sm text-mc-accent-pink uppercase tracking-wide">
                <Activity className="w-4 h-4" />
                Project Pulse
              </div>
              <h1 className="text-xl font-semibold mt-1">Where you left off</h1>
              <p className="text-sm text-mc-text-secondary mt-1">
                What&apos;s unfinished, what happened recently, and what&apos;s blocking launch.
              </p>
            </div>
            <button
              onClick={() => void loadAll()}
              disabled={pulseLoading}
              className="inline-flex items-center gap-2 px-3 py-2 rounded bg-mc-accent-pink text-mc-bg text-sm font-medium hover:bg-mc-accent-pink/90 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${pulseLoading ? 'animate-spin' : ''}`} />
              {pulseLoading ? 'Scanning...' : 'Refresh'}
            </button>
          </div>

          {/* Sections */}
          <NextSteps />
          <UnfinishedWork />
          <RecentActivity />
          <LaunchChecklist />
        </div>
      </main>
    </div>
  );
}
