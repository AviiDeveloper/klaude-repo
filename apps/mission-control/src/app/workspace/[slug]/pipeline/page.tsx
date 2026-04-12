'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Header } from '@/components/Header';
import { PipelineGraph, type PipelineNode } from '@/components/PipelineGraph';
import { NodeDetail } from '@/components/NodeDetail';
import { PipelineControls } from '@/components/PipelineControls';
import { PipelineRunList } from '@/components/PipelineRunList';
import { Activity } from 'lucide-react';
import type { Workspace } from '@/lib/types';

// ── Types ──

interface PipelineDefinition {
  id: string;
  name: string;
  enabled: boolean;
  nodes: Array<{ id: string; agent_id: string; depends_on: string[] }>;
}

interface PipelineRun {
  id: string;
  pipeline_definition_id: string;
  trigger: string;
  status: string;
  started_at: string;
  ended_at?: string;
  error_message?: string;
}

interface NodeRun {
  run_id: string;
  node_id: string;
  agent_id: string;
  status: string;
  attempts: number;
  depends_on: string[];
  last_error?: string;
  started_at?: string;
  ended_at?: string;
}

interface Artifact {
  id: string;
  run_id: string;
  node_id: string;
  kind: string;
  value_json: Record<string, unknown>;
  created_at: string;
}

interface CriticScore {
  agent_id: string;
  node_id: string;
  iteration: number;
  score: number;
  prediction: string;
  model_version: string;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
}

interface EpisodeData {
  critic_scores: CriticScore[];
  reflection_iterations: number;
  total_cost_usd: number;
}

// ── API helpers ──

const MC_API = process.env.NEXT_PUBLIC_MC_API_URL || 'http://127.0.0.1:4317';

async function fetchJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${MC_API}${path}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json() as Promise<T>;
}

async function postJSON<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${MC_API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json() as Promise<T>;
}

// ── Page ──

export default function PipelinePage() {
  const params = useParams();
  const slug = params?.slug as string;

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [definitions, setDefinitions] = useState<PipelineDefinition[]>([]);
  const [runs, setRuns] = useState<PipelineRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [nodes, setNodes] = useState<PipelineNode[]>([]);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [criticScores, setCriticScores] = useState<CriticScore[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pollCount, setPollCount] = useState(0);

  // Load workspace
  useEffect(() => {
    fetch(`/api/workspaces?slug=${slug}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) setWorkspace(data[0]);
        else if (data?.id) setWorkspace(data);
      })
      .catch(() => null);
  }, [slug]);

  // Load pipeline definitions + runs
  useEffect(() => {
    fetchJSON<{ jobs: PipelineDefinition[] }>('/api/jobs')
      .then((data) => setDefinitions(data.jobs ?? []))
      .catch(() => null);

    fetchJSON<{ runs: PipelineRun[] }>('/api/job-runs')
      .then((data) => {
        const sorted = (data.runs ?? []).sort(
          (a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
        );
        setRuns(sorted);
        if (sorted.length > 0 && !selectedRunId) {
          setSelectedRunId(sorted[0].id);
        }
      })
      .catch(() => null);
  }, [pollCount]);

  // Load run details when selected
  useEffect(() => {
    if (!selectedRunId) return;

    fetchJSON<{ run: PipelineRun; nodes: NodeRun[]; artifacts: Artifact[] }>(
      `/api/job-runs/${selectedRunId}`
    )
      .then((data) => {
        setNodes(
          (data.nodes ?? []).map((n) => ({
            ...n,
            status: n.status as PipelineNode['status'],
          }))
        );
        setArtifacts(data.artifacts ?? []);
        setIsRunning(data.run?.status === 'running');

        // Check for running run and set auto-poll
        if (data.run?.status === 'running') {
          setIsRunning(true);
        }
      })
      .catch(() => null);

    // Try to load episode data for critic scores
    fetchJSON<EpisodeData>(`/api/pipelines/${selectedRunId}/episodes`)
      .then((data) => setCriticScores(data.critic_scores ?? []))
      .catch(() => setCriticScores([]));
  }, [selectedRunId, pollCount]);

  // Poll while running
  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => setPollCount((c) => c + 1), 3000);
    return () => clearInterval(interval);
  }, [isRunning]);

  // Merge critic scores into nodes for graph display
  const enrichedNodes = nodes.map((node) => {
    const nodeScores = criticScores.filter((s) => s.node_id === node.node_id);
    const bestScore = nodeScores.length > 0 ? Math.max(...nodeScores.map((s) => s.score)) : undefined;
    return {
      ...node,
      critic_score: bestScore,
      reflection_iterations: nodeScores.length,
    };
  });

  const selectedNode = enrichedNodes.find((n) => n.node_id === selectedNodeId) ?? null;

  // Actions
  const handleTriggerRun = useCallback(async (definitionId: string) => {
    try {
      setError(null);
      const data = await postJSON<{ run: PipelineRun }>(`/api/jobs/${definitionId}/run`);
      setSelectedRunId(data.run.id);
      setIsRunning(true);
      setPollCount((c) => c + 1);
    } catch (err) {
      setError(`Failed to start run: ${err}`);
    }
  }, []);

  const handleCancelRun = useCallback(async (runId: string) => {
    try {
      setError(null);
      await postJSON(`/api/pipelines/${runId}/cancel`);
      setIsRunning(false);
      setPollCount((c) => c + 1);
    } catch (err) {
      setError(`Failed to cancel: ${err}`);
    }
  }, []);

  const handleRetryNode = useCallback(async (nodeId: string) => {
    if (!selectedRunId) return;
    try {
      setError(null);
      await postJSON(`/api/pipelines/${selectedRunId}/nodes/${nodeId}/retry`);
      setIsRunning(true);
      setPollCount((c) => c + 1);
    } catch (err) {
      setError(`Failed to retry: ${err}`);
    }
  }, [selectedRunId]);

  const handleOverrideNode = useCallback(async (nodeId: string, reason: string) => {
    if (!selectedRunId) return;
    try {
      setError(null);
      await postJSON(`/api/pipelines/${selectedRunId}/nodes/${nodeId}/override`, { reason });
      setPollCount((c) => c + 1);
    } catch (err) {
      setError(`Failed to override: ${err}`);
    }
  }, [selectedRunId]);

  return (
    <div className="min-h-screen bg-mc-bg text-mc-text flex flex-col">
      <Header workspace={workspace ?? undefined} />

      {/* Page header */}
      <div className="px-4 py-3 border-b border-mc-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-mc-accent-purple" />
          <h1 className="text-lg font-bold uppercase tracking-wider">Pipeline Runner</h1>
          {isRunning && (
            <span className="px-2 py-0.5 text-[10px] bg-mc-accent/20 text-mc-accent rounded-full animate-pulse uppercase">
              Running
            </span>
          )}
        </div>
        {error && (
          <span className="text-xs text-mc-accent-red">{error}</span>
        )}
      </div>

      {/* 3-panel layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Controls + Run History */}
        <div className="w-64 border-r border-mc-border flex flex-col overflow-hidden bg-mc-bg-secondary">
          <PipelineControls
            definitions={definitions}
            isRunning={isRunning}
            onTriggerRun={handleTriggerRun}
            onCancelRun={handleCancelRun}
            activeRunId={selectedRunId ?? undefined}
          />
          <div className="border-t border-mc-border flex-1 overflow-y-auto">
            <PipelineRunList
              runs={runs}
              selectedRunId={selectedRunId}
              onSelectRun={setSelectedRunId}
            />
          </div>
        </div>

        {/* Center: Node Graph */}
        <div className="flex-1 p-4 overflow-hidden">
          {enrichedNodes.length > 0 ? (
            <PipelineGraph
              nodes={enrichedNodes}
              selectedNodeId={selectedNodeId}
              onSelectNode={setSelectedNodeId}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-mc-text-secondary">
              <div className="text-center">
                <Activity className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Select a run to view its pipeline graph</p>
                <p className="text-xs mt-1">or trigger a new run from the left panel</p>
              </div>
            </div>
          )}
        </div>

        {/* Right: Node Detail */}
        <div className="w-80 border-l border-mc-border bg-mc-bg-secondary overflow-hidden">
          {selectedNode ? (
            <NodeDetail
              node={selectedNode}
              artifacts={artifacts}
              criticScores={criticScores}
              onRetry={handleRetryNode}
              onOverride={handleOverrideNode}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-mc-text-secondary p-4">
              <p className="text-xs text-center">Click a node in the graph to inspect it</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
