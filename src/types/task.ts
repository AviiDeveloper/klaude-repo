export type TaskStatus =
  | "created"
  | "awaiting_approval"
  | "in_progress"
  | "blocked"
  | "failed"
  | "completed";

export type SideEffectType =
  | "file_write"
  | "shell_exec"
  | "network_call"
  | "git_push"
  | "message_send"
  | "deploy";

export interface SideEffectProposal {
  type: SideEffectType;
  description: string;
  scope: string;
  risk_notes: string;
  requires_approval: boolean;
}

export interface AgentRequest {
  task_id: string;
  agent_name: "code-agent" | "ops-agent";
  objective: string;
  plan_step: string;
  constraints: string[];
  inputs: string[];
  approval_token?: string;
  deadline?: string;
}

export interface AgentResponse {
  task_id: string;
  agent_name: "code-agent" | "ops-agent";
  status: "ok" | "needs_approval" | "blocked" | "failed";
  summary: string;
  actions_proposed: SideEffectProposal[];
  artifacts: string[];
  logs: string[];
}

export interface Task {
  id: string;
  title: string;
  created_at: string;
  status: TaskStatus;
  objective: string;
  constraints: string[];
  plan_steps: string[];
  assigned_agents: string[];
  approvals_required: SideEffectProposal[];
  artifacts: string[];
  logs: string[];
  side_effects: SideEffectProposal[];
  rollback_plan: string;
  stop_conditions: string[];
}
