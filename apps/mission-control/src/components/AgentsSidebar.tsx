'use client';

import { useState, useEffect } from 'react';
import { Plus, ChevronRight, Zap, ZapOff, Loader2, Sparkles } from 'lucide-react';
import { useMissionControl } from '@/lib/store';
import type { Agent, AgentStatus, OpenClawSession } from '@/lib/types';
import { AgentModal } from './AgentModal';
import { AgentFactoryModal } from './AgentFactoryModal';
import { formatDistanceToNowStrict } from 'date-fns';

type FilterTab = 'all' | 'working' | 'standby';

interface AgentsSidebarProps {
  workspaceId?: string;
}

type AgentRuntimeSnapshot = {
  agent_id: string;
  current_job: {
    task_id: string;
    title: string;
    status: string;
    priority: string;
    updated_at: string;
    rationale?: string;
    output_contract?: string;
  } | null;
  queue_depth: number;
  progress_percent: number;
  progress_label: string;
  completed_24h: number;
  last_heartbeat_at: string | null;
  next_heartbeat_at: string | null;
  heartbeat_state: 'healthy' | 'lagging' | 'stale' | 'event' | 'unknown';
  cadence: string;
  role_summary: string;
};

export function AgentsSidebar({ workspaceId }: AgentsSidebarProps) {
  const { agents, selectedAgent, setSelectedAgent, agentOpenClawSessions, setAgentOpenClawSession } = useMissionControl();
  const [filter, setFilter] = useState<FilterTab>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showFactoryModal, setShowFactoryModal] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [connectingAgentId, setConnectingAgentId] = useState<string | null>(null);
  const [activeSubAgents, setActiveSubAgents] = useState(0);
  const [runtimeByAgent, setRuntimeByAgent] = useState<Record<string, AgentRuntimeSnapshot>>({});

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

  // Load OpenClaw session status for all agents on mount
  useEffect(() => {
    const loadOpenClawSessions = async () => {
      for (const agent of agents) {
        const data = await fetchJsonSafely(`/api/agents/${agent.id}/openclaw`) as
          | { linked?: boolean; session?: OpenClawSession }
          | null;
        if (data?.linked && data.session) {
          setAgentOpenClawSession(agent.id, data.session as OpenClawSession);
        }
      }
    };
    if (agents.length > 0) {
      void loadOpenClawSessions();
    }
  }, [agents, setAgentOpenClawSession]);

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

    const interval = setInterval(loadSubAgentCount, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const loadRuntime = () => {
      void (async () => {
        const query = workspaceId ? `?workspace_id=${encodeURIComponent(workspaceId)}` : '';
        const payload = await fetchJsonSafely(`/api/agents/runtime${query}`) as
          | { snapshots?: AgentRuntimeSnapshot[] }
          | null;
        if (!payload?.snapshots || !Array.isArray(payload.snapshots)) {
          return;
        }
        const next: Record<string, AgentRuntimeSnapshot> = {};
        for (const snapshot of payload.snapshots) {
          next[snapshot.agent_id] = snapshot;
        }
        setRuntimeByAgent(next);
      })();
    };

    loadRuntime();
    const interval = setInterval(loadRuntime, 10000);
    return () => clearInterval(interval);
  }, [workspaceId]);

  const handleConnectToOpenClaw = async (agent: Agent, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent selecting the agent
    setConnectingAgentId(agent.id);

    try {
      const existingSession = agentOpenClawSessions[agent.id];

      if (existingSession) {
        // Disconnect
        const res = await fetch(`/api/agents/${agent.id}/openclaw`, { method: 'DELETE' });
        if (res.ok) {
          setAgentOpenClawSession(agent.id, null);
        }
      } else {
        // Connect
        const res = await fetch(`/api/agents/${agent.id}/openclaw`, { method: 'POST' });
        if (res.ok) {
          const data = await res.json();
          setAgentOpenClawSession(agent.id, data.session as OpenClawSession);
        } else {
          const error = await res.json();
          console.error('Failed to connect to OpenClaw:', error);
          alert(`Failed to connect: ${error.error || 'Unknown error'}`);
        }
      }
    } catch (error) {
      console.error('OpenClaw connection error:', error);
    } finally {
      setConnectingAgentId(null);
    }
  };

  const filteredAgents = agents.filter((agent) => {
    if (filter === 'all') return true;
    return agent.status === filter;
  });

  const getStatusBadge = (status: AgentStatus) => {
    const styles = {
      standby: 'status-standby',
      working: 'status-working',
      offline: 'status-offline',
    };
    return styles[status] || styles.standby;
  };

  const getHeartbeatStyles = (state: AgentRuntimeSnapshot['heartbeat_state']) => {
    switch (state) {
      case 'healthy':
        return 'text-green-400';
      case 'lagging':
        return 'text-yellow-400';
      case 'stale':
        return 'text-red-400';
      case 'event':
        return 'text-mc-accent-cyan';
      default:
        return 'text-mc-text-secondary';
    }
  };

  const heartbeatLabel = (runtime?: AgentRuntimeSnapshot) => {
    if (!runtime) return 'No heartbeat yet';
    if (runtime.heartbeat_state === 'event') return 'Event-driven';
    if (!runtime.last_heartbeat_at) return 'No heartbeat yet';
    return `${formatDistanceToNowStrict(new Date(runtime.last_heartbeat_at), { addSuffix: true })}`;
  };

  return (
    <aside className="w-64 bg-mc-bg-secondary border-r border-mc-border flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-mc-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ChevronRight className="w-4 h-4 text-mc-text-secondary" />
            <span className="text-sm font-medium uppercase tracking-wider">Agents</span>
            <span className="bg-mc-bg-tertiary text-mc-text-secondary text-xs px-2 py-0.5 rounded">
              {agents.length}
            </span>
          </div>
        </div>

        {/* Active Sub-Agents Counter */}
        {activeSubAgents > 0 && (
          <div className="mb-3 px-3 py-2 bg-green-500/10 border border-green-500/20 rounded-lg">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-green-400">●</span>
              <span className="text-mc-text">Active Sub-Agents:</span>
              <span className="font-bold text-green-400">{activeSubAgents}</span>
            </div>
          </div>
        )}

        {/* Filter Tabs */}
        <div className="flex gap-1">
          {(['all', 'working', 'standby'] as FilterTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3 py-1 text-xs rounded uppercase ${
                filter === tab
                  ? 'bg-mc-accent text-mc-bg font-medium'
                  : 'text-mc-text-secondary hover:bg-mc-bg-tertiary'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Agent List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filteredAgents.map((agent) => {
          const openclawSession = agentOpenClawSessions[agent.id];
          const isConnecting = connectingAgentId === agent.id;
          const runtime = runtimeByAgent[agent.id];

          return (
            <div
              key={agent.id}
              className={`w-full rounded hover:bg-mc-bg-tertiary transition-colors ${
                selectedAgent?.id === agent.id ? 'bg-mc-bg-tertiary' : ''
              }`}
            >
              <button
                onClick={() => {
                  setSelectedAgent(agent);
                  setEditingAgent(agent);
                }}
                className="w-full flex items-center gap-3 p-2 text-left"
              >
                {/* Avatar */}
                <div className="text-2xl relative">
                  {agent.avatar_emoji}
                  {openclawSession && (
                    <span className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-mc-bg-secondary" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{agent.name}</span>
                    {!!agent.is_master && (
                      <span className="text-xs text-mc-accent-yellow">★</span>
                    )}
                  </div>
                  <div className="text-xs text-mc-text-secondary truncate">
                    {agent.role}
                  </div>
                  <div className="text-[11px] text-mc-text-secondary/80 truncate mt-1">
                    {runtime?.role_summary || agent.description || 'No role summary yet'}
                  </div>
                </div>

                {/* Status */}
                <span
                  className={`text-xs px-2 py-0.5 rounded uppercase ${getStatusBadge(
                    agent.status
                  )}`}
                >
                  {agent.status}
                </span>
              </button>

              <div className="px-2 pb-2 space-y-2">
                <div className="rounded border border-mc-border/60 bg-mc-bg/50 p-2">
                  <div className="text-[10px] uppercase tracking-wider text-mc-text-secondary mb-1">Current Job</div>
                  {runtime?.current_job ? (
                    <>
                      <div className="text-xs text-mc-text truncate">{runtime.current_job.title}</div>
                      <div className="text-[11px] text-mc-text-secondary mt-1">
                        {runtime.current_job.status.replace('_', ' ')} • queue {runtime.queue_depth}
                      </div>
                    </>
                  ) : (
                    <div className="text-xs text-mc-text-secondary">Idle</div>
                  )}
                </div>

                <div className="rounded border border-mc-border/60 bg-mc-bg/50 p-2">
                  <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-mc-text-secondary mb-1">
                    <span>Progress</span>
                    <span>{runtime?.progress_percent ?? 0}%</span>
                  </div>
                  <div className="h-1.5 rounded bg-mc-bg-tertiary overflow-hidden">
                    <div
                      className="h-full bg-mc-accent transition-all"
                      style={{ width: `${Math.max(0, Math.min(100, runtime?.progress_percent ?? 0))}%` }}
                    />
                  </div>
                  <div className="text-[11px] text-mc-text-secondary mt-1 capitalize">
                    {runtime?.progress_label || 'idle'} • {runtime?.completed_24h ?? 0} done/24h
                  </div>
                </div>

                <div className="rounded border border-mc-border/60 bg-mc-bg/50 p-2">
                  <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-mc-text-secondary mb-1">
                    <span>Heartbeat</span>
                    <span className={getHeartbeatStyles(runtime?.heartbeat_state || 'unknown')}>
                      {runtime?.heartbeat_state || 'unknown'}
                    </span>
                  </div>
                  <div className={`text-xs ${getHeartbeatStyles(runtime?.heartbeat_state || 'unknown')}`}>
                    {heartbeatLabel(runtime)}
                  </div>
                  <div className="text-[11px] text-mc-text-secondary mt-1 truncate">
                    Next:{' '}
                    {runtime?.next_heartbeat_at
                      ? formatDistanceToNowStrict(new Date(runtime.next_heartbeat_at), { addSuffix: true })
                      : 'pending'}
                    {' '}• {runtime?.cadence || 'event-driven'}
                  </div>
                </div>
              </div>

              {/* OpenClaw Connect Button - show for master agents */}
              {!!agent.is_master && (
                <div className="px-2 pb-2">
                  <button
                    onClick={(e) => handleConnectToOpenClaw(agent, e)}
                    disabled={isConnecting}
                    className={`w-full flex items-center justify-center gap-2 px-2 py-1 rounded text-xs transition-colors ${
                      openclawSession
                        ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                        : 'bg-mc-bg text-mc-text-secondary hover:bg-mc-bg-tertiary hover:text-mc-text'
                    }`}
                  >
                    {isConnecting ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Connecting...</span>
                      </>
                    ) : openclawSession ? (
                      <>
                        <Zap className="w-3 h-3" />
                        <span>OpenClaw Connected</span>
                      </>
                    ) : (
                      <>
                        <ZapOff className="w-3 h-3" />
                        <span>Connect to OpenClaw</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Agent Button */}
      <div className="p-3 border-t border-mc-border">
        <div className="space-y-2">
          <button
            onClick={() => setShowFactoryModal(true)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-mc-accent/15 border border-mc-accent/30 hover:bg-mc-accent/20 rounded text-sm text-mc-accent transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            Agent Factory
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-mc-bg-tertiary hover:bg-mc-border rounded text-sm text-mc-text-secondary hover:text-mc-text transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Agent
          </button>
        </div>
      </div>

      {/* Modals */}
      {showCreateModal && (
        <AgentModal onClose={() => setShowCreateModal(false)} workspaceId={workspaceId} />
      )}
      {showFactoryModal && (
        <AgentFactoryModal onClose={() => setShowFactoryModal(false)} workspaceId={workspaceId} />
      )}
      {editingAgent && (
        <AgentModal
          agent={editingAgent}
          onClose={() => setEditingAgent(null)}
          workspaceId={workspaceId}
        />
      )}
    </aside>
  );
}
