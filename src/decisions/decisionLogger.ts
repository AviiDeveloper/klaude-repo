/**
 * DecisionLogger — core self-learning data capture.
 *
 * Every agent decision flows through here. The logger records what was decided,
 * why, what was expected, and later what actually happened. This creates the
 * dataset that powers threshold learning, targeting learning, and model training.
 *
 * Spec reference: full_production_context/project_context.md — Decision Logger
 */

import { randomUUID } from "node:crypto";
import { InMemoryEventBus } from "../events/bus.js";
import { DecisionStore } from "./decisionStore.js";
import {
  AccuracyReport,
  DecisionInput,
  DecisionOutcome,
  DecisionQuery,
  DecisionRecord,
} from "./types.js";

export class DecisionLogger {
  constructor(
    private readonly store: DecisionStore,
    private readonly bus?: InMemoryEventBus,
  ) {}

  /**
   * Log a decision made by an agent. Returns the decision_id for later
   * outcome recording.
   */
  async log(input: DecisionInput): Promise<string> {
    const decisionId = randomUUID();
    const now = new Date().toISOString();

    const record: DecisionRecord = {
      decision_id: decisionId,
      made_at: now,
      agent_id: input.agent_id,
      decision_type: input.decision_type,
      description: input.description,
      rationale: input.rationale,
      input_data: input.input_data,
      expected_outcome: input.expected_outcome,
      expected_metric: input.expected_metric ?? null,
      actual_outcome: null,
      actual_metric: null,
      outcome_measured_at: null,
      prediction_accuracy: null,
      requires_human_review: input.requires_human_review ?? false,
    };

    this.store.insert(record);

    if (this.bus) {
      await this.bus.publish("decision.logged", {
        decision_id: decisionId,
        agent_id: input.agent_id,
        decision_type: input.decision_type,
      });
    }

    return decisionId;
  }

  /**
   * Record the actual outcome of a previously logged decision.
   * Computes prediction_accuracy if both expected and actual metrics exist.
   */
  async recordOutcome(decisionId: string, outcome: DecisionOutcome): Promise<void> {
    const existing = this.store.get(decisionId);
    if (!existing) {
      throw new Error(`Decision not found: ${decisionId}`);
    }

    const measuredAt = new Date().toISOString();
    const accuracy = this.computeAccuracy(existing, outcome);

    this.store.updateOutcome(decisionId, outcome, measuredAt, accuracy);

    if (this.bus) {
      await this.bus.publish("decision.outcome_measured", {
        decision_id: decisionId,
        agent_id: existing.agent_id,
        prediction_accuracy: accuracy,
      });
    }
  }

  /**
   * Query decisions with filters.
   */
  query(q: DecisionQuery): DecisionRecord[] {
    return this.store.query(q);
  }

  /**
   * List decisions by a specific agent.
   */
  listByAgent(agentId: string, limit?: number): DecisionRecord[] {
    return this.store.query({ agent_id: agentId, limit });
  }

  /**
   * List decisions that have not yet had their outcome measured.
   */
  listPendingOutcomes(limit?: number): DecisionRecord[] {
    return this.store.query({ pending_outcome_only: true, limit });
  }

  /**
   * Get accuracy report for an agent over a time window.
   */
  getAccuracy(agentId: string, since?: string): AccuracyReport {
    const sinceDate = since ?? new Date(0).toISOString();
    return this.store.getAccuracy(agentId, sinceDate);
  }

  /**
   * Compute prediction accuracy by comparing expected and actual metrics.
   *
   * If both metrics have a numeric "score" field, accuracy is
   * 1 - |expected - actual| (clamped to [0, 1]).
   *
   * If metrics are not comparable or missing, returns null.
   */
  private computeAccuracy(
    existing: DecisionRecord,
    outcome: DecisionOutcome,
  ): number | null {
    if (!existing.expected_metric || !outcome.actual_metric) return null;

    const expectedScore = existing.expected_metric.score;
    const actualScore = outcome.actual_metric.score;

    if (typeof expectedScore !== "number" || typeof actualScore !== "number") {
      // Fall back to simple outcome match
      if (existing.expected_outcome === outcome.actual_outcome) return 1.0;
      return 0.0;
    }

    // Normalised accuracy: 1 - absolute error, clamped to [0, 1]
    const error = Math.abs(expectedScore - actualScore);
    return Math.max(0, Math.min(1, 1 - error));
  }
}
