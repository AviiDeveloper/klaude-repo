import { SideEffectType } from "../types/task.js";

export type TimelineEventType =
  | "task.created"
  | "plan.generated"
  | "agent.requested"
  | "agent.completed"
  | "approval.requested"
  | "approval.resolved"
  | "notify.requested"
  | "error";

export type TraceComponent =
  | "openclaw"
  | "caller_model"
  | "orchestrator"
  | "agent.code"
  | "agent.ops"
  | "storage"
  | "queue";

export interface TimelineEvent {
  timestamp: string;
  event_type: TimelineEventType;
  component: TraceComponent;
  summary: string;
  details: Record<string, unknown>;
}

export interface ApprovalRecord {
  approval_id: string;
  requested_at: string;
  resolved_at: string;
  requested_by: string;
  channel: "openclaw";
  decision: "approved" | "denied";
  scope: string;
  expires_at: string;
}

export interface TraceSideEffect {
  type: SideEffectType;
  description: string;
  approved_by_token_id: string;
  started_at: string;
  ended_at: string;
  result: string;
}

export interface ExecutionTraceRecord {
  task_id: string;
  objective: string;
  created_at: string;
  build_version: string;
  changelog_change_id: string;
  final_state: string;
  timeline: TimelineEvent[];
  approvals: ApprovalRecord[];
  side_effects: TraceSideEffect[];
  artifacts: string[];
}
