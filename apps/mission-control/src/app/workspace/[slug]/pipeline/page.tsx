'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Header } from '@/components/Header';
import { PipelineGraph, type PipelineNode } from '@/components/PipelineGraph';
import { NodeDetail } from '@/components/NodeDetail';
import { PipelineControls } from '@/components/PipelineControls';
import { PipelineRunList } from '@/components/PipelineRunList';
import { Activity, GitBranch, Rocket, Brain, ExternalLink, Layers } from 'lucide-react';
import { InteractiveFlowchart } from '@/components/InteractiveFlowchart';
import { ALL_FLOWCHARTS } from '@/lib/flowchart-data';
import type { Workspace } from '@/lib/types';

// ── Flowchart config ──

const FLOWCHARTS = [
  {
    id: 'lead-gen',
    label: 'Lead Generation',
    icon: GitBranch,
    figmaUrl: 'https://www.figma.com/board/AkwCrxbE90kno2bjNoKLC7/MAS-%E2%80%94-Lead-Generation-Pipeline',
    embedUrl: 'https://embed.figma.com/board/AkwCrxbE90kno2bjNoKLC7/MAS-%E2%80%94-Lead-Generation-Pipeline?node-id=0-1&embed-host=share',
    description: 'SP signup → scrape → demo gen → QC → assign to salesperson',
  },
  {
    id: 'pitch-fulfil',
    label: 'Pitch to Fulfilment',
    icon: Rocket,
    figmaUrl: 'https://www.figma.com/board/UsMR2GFR7Y5NhA3xtWUjUA/MAS-%E2%80%94-Pitch-to-Fulfillment',
    embedUrl: 'https://embed.figma.com/board/UsMR2GFR7Y5NhA3xtWUjUA/MAS-%E2%80%94-Pitch-to-Fulfillment?node-id=0-1&embed-host=share',
    description: 'SP visits → demo shown → sale or rejection → fulfilment pipeline → client portal',
  },
  {
    id: 'learning-loop',
    label: 'Self-Learning Loop',
    icon: Brain,
    figmaUrl: 'https://www.figma.com/board/lYBACgMhVS41eVG04wI3hI/MAS-%E2%80%94-Self-Learning-Loop',
    embedUrl: 'https://embed.figma.com/board/lYBACgMhVS41eVG04wI3hI/MAS-%E2%80%94-Self-Learning-Loop?node-id=0-1&embed-host=share',
    description: 'Critic evaluation → reflection → episodic memory → strategy learning',
  },
];

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

type TabId = 'lead-gen' | 'pitch-fulfil' | 'learning-loop' | 'runner';

export default function PipelinePage() {
  const params = useParams();
  const slug = params?.slug as string;

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('lead-gen');

  // Runner state
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
  const [viewMode, setViewMode] = useState<'interactive' | 'figma'>('interactive');

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

  // Load pipeline data when runner tab is active
  useEffect(() => {
    if (activeTab !== 'runner') return;

    fetchJSON<{ jobs: PipelineDefinition[] }>('/api/jobs')
      .then((data) => {
        const jobs = data.jobs ?? [];
        setDefinitions(jobs);
        if (jobs.length > 0 && nodes.length === 0 && !selectedRunId) {
          setNodes(jobs[0].nodes.map((n) => ({
            node_id: n.id, agent_id: n.agent_id,
            status: 'pending' as const, depends_on: n.depends_on, attempts: 0,
          })));
        }
      })
      .catch(() => null);

    fetchJSON<{ runs: PipelineRun[] }>('/api/job-runs')
      .then((data) => {
        const sorted = (data.runs ?? []).sort(
          (a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
        );
        setRuns(sorted);
      })
      .catch(() => null);
  }, [activeTab, pollCount]);

  // Load run details
  useEffect(() => {
    if (activeTab !== 'runner' || !selectedRunId) {
      if (activeTab === 'runner' && !selectedRunId && definitions.length > 0) {
        setNodes(definitions[0].nodes.map((n) => ({
          node_id: n.id, agent_id: n.agent_id,
          status: 'pending' as const, depends_on: n.depends_on, attempts: 0,
        })));
        setArtifacts([]);
        setCriticScores([]);
      }
      return;
    }

    fetchJSON<{ run: PipelineRun; nodes: NodeRun[]; artifacts: Artifact[] }>(
      `/api/job-runs/${selectedRunId}`
    ).then((data) => {
      setNodes((data.nodes ?? []).map((n) => ({
        ...n, status: n.status as PipelineNode['status'],
      })));
      setArtifacts(data.artifacts ?? []);
      setIsRunning(data.run?.status === 'running');
    }).catch(() => null);

    fetchJSON<{ critic_scores?: CriticScore[] }>(`/api/pipelines/${selectedRunId}/episodes`)
      .then((data) => setCriticScores(data.critic_scores ?? []))
      .catch(() => setCriticScores([]));
  }, [activeTab, selectedRunId, pollCount, definitions]);

  // Poll while running
  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => setPollCount((c) => c + 1), 3000);
    return () => clearInterval(interval);
  }, [isRunning]);

  // Enriched nodes
  const enrichedNodes = nodes.map((node) => {
    const nodeScores = criticScores.filter((s) => s.node_id === node.node_id);
    const bestScore = nodeScores.length > 0 ? Math.max(...nodeScores.map((s) => s.score)) : undefined;
    return { ...node, critic_score: bestScore, reflection_iterations: nodeScores.length };
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
    } catch (err) { setError(`Failed to start: ${err}`); }
  }, []);

  const handleCancelRun = useCallback(async (runId: string) => {
    try {
      await postJSON(`/api/pipelines/${runId}/cancel`);
      setIsRunning(false);
      setPollCount((c) => c + 1);
    } catch (err) { setError(`Failed to cancel: ${err}`); }
  }, []);

  const handleRetryNode = useCallback(async (nodeId: string) => {
    if (!selectedRunId) return;
    try {
      await postJSON(`/api/pipelines/${selectedRunId}/nodes/${nodeId}/retry`);
      setIsRunning(true);
      setPollCount((c) => c + 1);
    } catch (err) { setError(`Failed to retry: ${err}`); }
  }, [selectedRunId]);

  const handleOverrideNode = useCallback(async (nodeId: string, reason: string) => {
    if (!selectedRunId) return;
    try {
      await postJSON(`/api/pipelines/${selectedRunId}/nodes/${nodeId}/override`, { reason });
      setPollCount((c) => c + 1);
    } catch (err) { setError(`Failed to override: ${err}`); }
  }, [selectedRunId]);

  const handleTestNode = useCallback(async (nodeId: string) => {
    try {
      const defId = definitions[0]?.id;
      if (!defId) return;
      const data = await postJSON<{ run: PipelineRun }>(`/api/jobs/${defId}/run`);
      setSelectedRunId(data.run.id);
      setSelectedNodeId(nodeId);
      setIsRunning(true);
      setPollCount((c) => c + 1);
    } catch (err) { setError(`Failed to test: ${err}`); }
  }, [definitions]);

  // ── Tabs ──

  const tabs = [
    ...FLOWCHARTS.map((f) => ({ id: f.id as TabId, label: f.label, Icon: f.icon })),
    { id: 'runner' as TabId, label: 'Live Runner', Icon: Activity },
  ];

  return (
    <div className="min-h-screen bg-mc-bg text-mc-text flex flex-col">
      <Header workspace={workspace ?? undefined} />

      {/* Tab bar */}
      <div className="px-4 py-2 border-b border-mc-border flex items-center gap-1 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-t text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? 'bg-mc-bg-secondary border border-mc-border border-b-transparent text-mc-text -mb-px'
                : 'text-mc-text-secondary hover:text-mc-text hover:bg-mc-bg-tertiary'
            }`}
          >
            <tab.Icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
        {error && <span className="ml-auto text-xs text-mc-accent-red">{error}</span>}
      </div>

      {/* Tab content */}
      <div className="flex-1 flex overflow-hidden">
        {activeTab !== 'runner' ? (
          /* ── Flowchart view ── */
          (() => {
            const chart = FLOWCHARTS.find((f) => f.id === activeTab);
            const interactiveData = ALL_FLOWCHARTS.find((f) => f.id === activeTab);
            if (!chart) return null;
            return (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Flowchart header */}
                <div className="px-4 py-3 border-b border-mc-border flex items-center justify-between bg-mc-bg-secondary">
                  <div>
                    <h2 className="text-sm font-bold uppercase tracking-wider text-mc-text">{chart.label}</h2>
                    <p className="text-xs text-mc-text-secondary mt-0.5">{chart.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* View mode toggle */}
                    <div className="flex items-center bg-mc-bg rounded border border-mc-border">
                      <button
                        onClick={() => setViewMode('interactive')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-l transition-colors ${
                          viewMode === 'interactive'
                            ? 'bg-mc-accent-purple/20 text-mc-accent-purple border-r border-mc-accent-purple/30'
                            : 'text-mc-text-secondary hover:text-mc-text'
                        }`}
                      >
                        <Layers className="w-3.5 h-3.5" />
                        Interactive
                      </button>
                      <button
                        onClick={() => setViewMode('figma')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-r transition-colors ${
                          viewMode === 'figma'
                            ? 'bg-mc-accent/20 text-mc-accent border-l border-mc-accent/30'
                            : 'text-mc-text-secondary hover:text-mc-text'
                        }`}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Figma
                      </button>
                    </div>
                    <a
                      href={chart.figmaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-mc-text-secondary hover:text-mc-accent border border-mc-border rounded hover:border-mc-accent transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Edit
                    </a>
                  </div>
                </div>
                {/* Content */}
                {viewMode === 'figma' ? (
                  <div className="flex-1 bg-mc-bg">
                    <iframe
                      src={chart.embedUrl}
                      className="w-full h-full border-0"
                      allowFullScreen
                    />
                  </div>
                ) : interactiveData ? (
                  <InteractiveFlowchart flowchart={interactiveData} />
                ) : null}
              </div>
            );
          })()
        ) : (
          /* ── Live Runner view ── */
          <>
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
              <PipelineGraph
                nodes={enrichedNodes}
                selectedNodeId={selectedNodeId}
                onSelectNode={setSelectedNodeId}
              />
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
                  onTestNode={handleTestNode}
                  hasActiveRun={isRunning}
                />
              ) : (
                <div className="h-full flex items-center justify-center text-mc-text-secondary p-4">
                  <p className="text-xs text-center">Click a node in the graph to inspect it</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
