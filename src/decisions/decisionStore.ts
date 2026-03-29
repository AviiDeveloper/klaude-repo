import { DecisionRecord, DecisionQuery, AccuracyReport, DecisionOutcome } from "./types.js";

export interface DecisionStore {
  insert(record: DecisionRecord): void;
  get(decisionId: string): DecisionRecord | undefined;
  updateOutcome(decisionId: string, outcome: DecisionOutcome, measuredAt: string, accuracy: number | null): void;
  query(q: DecisionQuery): DecisionRecord[];
  getAccuracy(agentId: string, since: string): AccuracyReport;
}

export class InMemoryDecisionStore implements DecisionStore {
  private readonly records = new Map<string, DecisionRecord>();

  insert(record: DecisionRecord): void {
    this.records.set(record.decision_id, record);
  }

  get(decisionId: string): DecisionRecord | undefined {
    return this.records.get(decisionId);
  }

  updateOutcome(
    decisionId: string,
    outcome: DecisionOutcome,
    measuredAt: string,
    accuracy: number | null,
  ): void {
    const record = this.records.get(decisionId);
    if (!record) throw new Error(`Decision not found: ${decisionId}`);
    record.actual_outcome = outcome.actual_outcome;
    record.actual_metric = outcome.actual_metric ?? null;
    record.outcome_measured_at = measuredAt;
    record.prediction_accuracy = accuracy;
  }

  query(q: DecisionQuery): DecisionRecord[] {
    let results = [...this.records.values()];

    if (q.agent_id) {
      results = results.filter((r) => r.agent_id === q.agent_id);
    }
    if (q.decision_type) {
      results = results.filter((r) => r.decision_type === q.decision_type);
    }
    if (q.pending_outcome_only) {
      results = results.filter((r) => r.actual_outcome === null);
    }
    if (q.requires_human_review !== undefined) {
      results = results.filter((r) => r.requires_human_review === q.requires_human_review);
    }
    if (q.since) {
      results = results.filter((r) => r.made_at >= q.since!);
    }

    results.sort((a, b) => (a.made_at > b.made_at ? -1 : 1));

    if (q.limit) {
      results = results.slice(0, q.limit);
    }

    return results;
  }

  getAccuracy(agentId: string, since: string): AccuracyReport {
    const agentRecords = [...this.records.values()].filter(
      (r) => r.agent_id === agentId && r.made_at >= since,
    );
    const measured = agentRecords.filter((r) => r.prediction_accuracy !== null);
    const avgAccuracy =
      measured.length > 0
        ? measured.reduce((sum, r) => sum + r.prediction_accuracy!, 0) / measured.length
        : null;

    return {
      agent_id: agentId,
      total_decisions: agentRecords.length,
      measured_decisions: measured.length,
      average_accuracy: avgAccuracy,
      since,
    };
  }
}
