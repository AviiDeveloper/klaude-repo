/**
 * Pipeline agent IDs are open strings to support dynamic agent registration.
 * Well-known content pipeline agents are listed for reference:
 *   "trend-scout-agent", "research-verifier-agent", "idea-ranker-agent",
 *   "script-writer-agent", "media-generator-agent", "compliance-reviewer-agent",
 *   "publisher-agent", "performance-analyst-agent"
 *
 * Outreach pipeline agents:
 *   "lead-scout-agent", "lead-profiler-agent", "lead-qualifier-agent",
 *   "site-composer-agent", "site-qa-agent", "outreach-copywriter-agent",
 *   "outreach-compliance-agent", "site-deployer-agent", "client-onboarding-agent",
 *   "outreach-performance-analyst-agent", "site-maintenance-agent", "client-health-agent"
 */
export type PipelineAgentId = string;

export type PipelineNodeStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "blocked"
  | "awaiting_approval";

export type PipelineRunStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "blocked";

export interface PipelineNodeDefinition {
  id: string;
  agent_id: PipelineAgentId;
  depends_on: string[];
  config?: Record<string, unknown>;
  paid_action?: boolean;
}

export interface PipelineDefinition {
  id: string;
  name: string;
  enabled: boolean;
  schedule_rrule: string;
  max_retries: number;
  nodes: PipelineNodeDefinition[];
  config?: Record<string, unknown>;
  next_run_at?: string;
  created_at: string;
  updated_at: string;
}

export interface PipelineRun {
  id: string;
  pipeline_definition_id: string;
  trigger: "scheduler" | "manual" | "retry";
  status: PipelineRunStatus;
  started_at: string;
  ended_at?: string;
  error_message?: string;
  approval_token?: string;
}

export interface PipelineNodeRun {
  run_id: string;
  node_id: string;
  agent_id: PipelineAgentId;
  status: PipelineNodeStatus;
  attempts: number;
  depends_on: string[];
  last_error?: string;
  started_at?: string;
  ended_at?: string;
  config?: Record<string, unknown>;
  paid_action: boolean;
}

export interface AgentTaskRecord {
  id: string;
  run_id: string;
  node_id: string;
  agent_id: PipelineAgentId;
  status: "ready" | "running" | "completed" | "failed";
  created_at: string;
  started_at?: string;
  completed_at?: string;
  input_json: Record<string, unknown>;
  output_json?: Record<string, unknown>;
  error_message?: string;
}

export interface AgentTaskArtifact {
  id: string;
  run_id: string;
  node_id: string;
  kind: string;
  value_json: Record<string, unknown>;
  created_at: string;
}

export interface SourceRegistryRecord {
  id: string;
  name: string;
  source_type: "rss" | "api";
  enabled: boolean;
  config_json: Record<string, unknown>;
  last_success_at?: string;
  last_error?: string;
}

export interface MediaJobRecord {
  id: string;
  run_id: string;
  node_id: string;
  provider: "higgsfield";
  status: "pending" | "running" | "completed" | "failed" | "blocked_approval";
  input_json: Record<string, unknown>;
  output_json?: Record<string, unknown>;
  cost_usd?: number;
  approved_by_token?: string;
  created_at: string;
  updated_at: string;
}

export interface PostQueueRecord {
  id: string;
  run_id: string;
  platform: "tiktok" | "reels" | "shorts";
  status: "pending_approval" | "approved" | "dispatched" | "failed" | "dead_letter";
  payload_json: Record<string, unknown>;
  attempts: number;
  approved_by?: string;
  dispatched_at?: string;
  last_error?: string;
  created_at: string;
  updated_at: string;
}

export interface SpendLedgerRecord {
  id: string;
  timestamp: string;
  scope: "task" | "daily";
  reference_id: string;
  provider: string;
  amount_usd: number;
}

export interface PipelineBudgetPolicy {
  max_cost_per_task_usd: number;
  max_cost_per_day_usd: number;
}
