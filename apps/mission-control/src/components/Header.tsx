'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Zap, Settings, ChevronLeft, LayoutGrid, Crown, Brain, DollarSign, BookOpen } from 'lucide-react';
import { useMissionControl } from '@/lib/store';
import { format } from 'date-fns';
import type { Workspace } from '@/lib/types';

interface HeaderProps {
  workspace?: Workspace;
}

export function Header({ workspace }: HeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { agents, tasks, isOnline } = useMissionControl();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeSubAgents, setActiveSubAgents] = useState(0);

  const fetchJsonSafely = async (url: string): Promise<unknown | null> => {
    try {
      const res = await Promise.race<Response | null>([
        fetch(url),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
      ]);
      if (!res) {
        return null;
      }
      if (!res.ok) {
        return null;
      }
      return await res.json();
    } catch {
      return null;
    }
  };

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Load active sub-agent count
  useEffect(() => {
    const loadSubAgentCount = () => {
      void (async () => {
        const sessions = await fetchJsonSafely('/api/openclaw/sessions?session_type=subagent&status=active');
        if (Array.isArray(sessions)) {
          setActiveSubAgents(sessions.length);
        } else {
          setActiveSubAgents(0);
        }
      })();
    };

    loadSubAgentCount();

    // Poll every 10 seconds
    const interval = setInterval(loadSubAgentCount, 10000);
    return () => clearInterval(interval);
  }, []);

  const workingAgents = agents.filter((a) => a.status === 'working').length;
  const activeAgents = workingAgents + activeSubAgents;
  const tasksInQueue = tasks.filter((t) => t.status !== 'done' && t.status !== 'review').length;

  return (
    <header className="h-14 bg-mc-bg-secondary border-b border-mc-border flex items-center justify-between px-4">
      {/* Left: Logo & Title */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-mc-accent-cyan" />
          <span className="font-semibold text-mc-text uppercase tracking-wider text-sm">
            Mission Control
          </span>
        </div>

        {/* Workspace indicator or back to dashboard */}
        {workspace ? (
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="flex items-center gap-1 text-mc-text-secondary hover:text-mc-accent transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              <LayoutGrid className="w-4 h-4" />
            </Link>
            <span className="text-mc-text-secondary">/</span>
            <div className="flex items-center gap-2 px-3 py-1 bg-mc-bg-tertiary rounded">
              <span className="text-lg">{workspace.icon}</span>
              <span className="font-medium">{workspace.name}</span>
            </div>
          </div>
        ) : (
          <Link
            href="/"
            className="flex items-center gap-2 px-3 py-1 bg-mc-bg-tertiary rounded hover:bg-mc-bg transition-colors"
          >
            <LayoutGrid className="w-4 h-4" />
            <span className="text-sm">All Workspaces</span>
          </Link>
        )}
      </div>

      {/* Center: Stats - only show in workspace view */}
      {workspace && (
        <div className="flex items-center gap-8">
          <div className="text-center">
            <div className="text-2xl font-bold text-mc-accent-cyan">{activeAgents}</div>
            <div className="text-xs text-mc-text-secondary uppercase">Agents Active</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-mc-accent-purple">{tasksInQueue}</div>
            <div className="text-xs text-mc-text-secondary uppercase">Tasks in Queue</div>
          </div>
        </div>
      )}

      {/* Right: Time & Status */}
      <div className="flex items-center gap-4">
        <span className="text-mc-text-secondary text-sm font-mono">
          {format(currentTime, 'HH:mm:ss')}
        </span>
        {workspace ? (
          <>
            <Link
              href={`/workspace/${workspace.slug}/learning`}
              className={`inline-flex items-center gap-2 px-3 py-1 rounded border text-sm font-medium ${
                pathname?.includes('/learning')
                  ? 'border-mc-accent-cyan text-mc-accent-cyan bg-mc-accent-cyan/15'
                  : 'border-mc-border text-mc-text-secondary hover:bg-mc-bg-tertiary'
              }`}
              title="Open Learning Loop"
            >
              <Brain className="w-4 h-4" />
              Learning
            </Link>
            <Link
              href={`/workspace/${workspace.slug}/lead`}
              className={`inline-flex items-center gap-2 px-3 py-1 rounded border text-sm font-medium ${
                pathname?.includes('/lead')
                  ? 'border-mc-accent-yellow text-mc-accent-yellow bg-mc-accent-yellow/15'
                  : 'border-mc-border text-mc-text-secondary hover:bg-mc-bg-tertiary'
              }`}
              title="Open Lead Console"
            >
              <Crown className="w-4 h-4" />
              Lead Console
            </Link>
            <Link
              href={`/workspace/${workspace.slug}/costs`}
              className={`inline-flex items-center gap-2 px-3 py-1 rounded border text-sm font-medium ${
                pathname?.includes('/costs')
                  ? 'border-mc-accent-green text-mc-accent-green bg-mc-accent-green/15'
                  : 'border-mc-border text-mc-text-secondary hover:bg-mc-bg-tertiary'
              }`}
              title="Open Cost Observatory"
            >
              <DollarSign className="w-4 h-4" />
              Costs
            </Link>
            <Link
              href={`/workspace/${workspace.slug}/vault`}
              className={`inline-flex items-center gap-2 px-3 py-1 rounded border text-sm font-medium ${
                pathname?.includes('/vault')
                  ? 'border-mc-accent-purple text-mc-accent-purple bg-mc-accent-purple/15'
                  : 'border-mc-border text-mc-text-secondary hover:bg-mc-bg-tertiary'
              }`}
              title="Open Vault Viewer"
            >
              <BookOpen className="w-4 h-4" />
              Vault
            </Link>
          </>
        ) : null}
        <div
          className={`flex items-center gap-2 px-3 py-1 rounded border text-sm font-medium ${
            isOnline
              ? 'bg-mc-accent-green/20 border-mc-accent-green text-mc-accent-green'
              : 'bg-mc-accent-red/20 border-mc-accent-red text-mc-accent-red'
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              isOnline ? 'bg-mc-accent-green animate-pulse' : 'bg-mc-accent-red'
            }`}
          />
          {isOnline ? 'ONLINE' : 'OFFLINE'}
        </div>
        <button
          onClick={() => router.push('/settings')}
          className="p-2 hover:bg-mc-bg-tertiary rounded text-mc-text-secondary"
          title="Settings"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}
