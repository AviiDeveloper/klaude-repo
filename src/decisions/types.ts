/**
 * Decision Logger types — captures every agent decision with expected vs actual
 * outcomes for self-learning. Follows the spec schema from project_context.md.
 */

export interface DecisionInput {
  agent_id: string;
  decision_type: string;
  description: string;
  rationale: string;
  input_data: Record<string, unknown>;
  expected_outcome: string;
  expected_metric?: Record<string, unknown>;
  requires_human_review?: boolean;
}

export interface DecisionOutcome {
  actual_outcome: string;
  actual_metric?: Record<string, unknown>;
}

export interface DecisionRecord {
  decision_id: string;
  made_at: string;
  agent_id: string;
  decision_type: string;
  description: string;
  rationale: string;
  input_data: Record<string, unknown>;
  expected_outcome: string;
  expected_metric: Record<string, unknown> | null;
  actual_outcome: string | null;
  actual_metric: Record<string, unknown> | null;
  outcome_measured_at: string | null;
  prediction_accuracy: number | null;
  requires_human_review: boolean;
}

export interface DecisionQuery {
  agent_id?: string;
  decision_type?: string;
  pending_outcome_only?: boolean;
  requires_human_review?: boolean;
  since?: string;
  limit?: number;
}

export interface AccuracyReport {
  agent_id: string;
  total_decisions: number;
  measured_decisions: number;
  average_accuracy: number | null;
  since: string;
}
