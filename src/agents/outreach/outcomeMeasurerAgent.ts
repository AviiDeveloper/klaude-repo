/**
 * Outcome Measurer Agent — nightly feedback loop.
 *
 * Scans for pending decision outcomes, cross-references demo QA results,
 * expires stale decisions past the 14-day signal lag window, and computes
 * per-agent prediction accuracy reports.
 *
 * Spec reference: Step 5 of self-learning build order.
 * Runs nightly at 02:00 UTC via pipeline scheduler.
 */

import { AgentHandler } from "../../pipeline/agentRuntime.js";
import { DecisionLogger } from "../../decisions/decisionLogger.js";
import { DemoRecorder } from "../../demos/demoRecorder.js";
import type { DecisionRecord } from "../../decisions/types.js";

const EXPIRY_DAYS = 14;

interface AccuracySummary {
  agent_id: string;
  total: number;
  measured: number;
  accuracy: number | null;
}

export const outcomeMeasurerAgent: AgentHandler = async (input) => {
  const config = (input.config ?? {}) as {
    decisionLogger?: DecisionLogger;
    demoRecorder?: DemoRecorder;
  };

  const decisionLogger = config.decisionLogger;
  const demoRecorder = config.demoRecorder;

  if (!decisionLogger) {
    return {
      summary: "Outcome measurer skipped — no DecisionLogger available.",
      artifacts: { skipped: true },
    };
  }

  const pending = decisionLogger.listPendingOutcomes();
  const now = new Date();
  const expiryThreshold = new Date(now.getTime() - EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();

  let measuredCount = 0;
  let expiredCount = 0;
  let skippedCount = 0;

  for (const decision of pending) {
    // Phase A: Try to measure outcome based on decision type
    const measured = await tryMeasure(decision, demoRecorder, decisionLogger);
    if (measured) {
      measuredCount++;
      continue;
    }

    // Phase B: Expire old decisions past the signal lag window
    if (decision.made_at < expiryThreshold) {
      await decisionLogger.recordOutcome(decision.decision_id, {
        actual_outcome: "expired",
        actual_metric: { reason: "past_14_day_window" },
      });
      expiredCount++;
      continue;
    }

    skippedCount++;
  }

  // Phase C: Compute per-agent accuracy reports
  const agentIds = getUniqueAgentIds(pending);
  const since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(); // last 30 days
  const accuracyReports: AccuracySummary[] = [];

  for (const agentId of agentIds) {
    const report = decisionLogger.getAccuracy(agentId, since);
    accuracyReports.push({
      agent_id: agentId,
      total: report.total_decisions,
      measured: report.measured_decisions,
      accuracy: report.average_accuracy,
    });
  }

  const summaryLines = [
    `Outcome measurement complete.`,
    `Pending: ${pending.length} | Measured: ${measuredCount} | Expired: ${expiredCount} | Skipped: ${skippedCount}`,
  ];

  if (accuracyReports.length > 0) {
    summaryLines.push(`Agent accuracy (30d):`);
    for (const r of accuracyReports) {
      const accStr = r.accuracy !== null ? `${(r.accuracy * 100).toFixed(1)}%` : "N/A";
      summaryLines.push(`  ${r.agent_id}: ${accStr} (${r.measured}/${r.total} measured)`);
    }
  }

  return {
    summary: summaryLines.join("\n"),
    artifacts: {
      pending_count: pending.length,
      measured_count: measuredCount,
      expired_count: expiredCount,
      skipped_count: skippedCount,
      accuracy_reports: accuracyReports,
      measured_at: now.toISOString(),
    },
  };
};

/**
 * Try to measure the outcome of a decision by cross-referencing available data.
 * Returns true if the outcome was successfully measured.
 */
async function tryMeasure(
  decision: DecisionRecord,
  demoRecorder: DemoRecorder | undefined,
  decisionLogger: DecisionLogger,
): Promise<boolean> {
  // demo_generated decisions → check if the demo passed QA
  if (decision.decision_type === "demo_generated" && demoRecorder) {
    // Prefer precise demo_id match, fall back to lead_id
    const demoId = decision.input_data.demo_id as string | undefined;
    const leadId = decision.input_data.lead_id as string | undefined;

    let qaDemo;
    if (demoId) {
      qaDemo = demoRecorder.get(demoId);
      if (qaDemo && qaDemo.quality_score === null) qaDemo = undefined; // not yet QA'd
    } else if (leadId) {
      const demos = demoRecorder.getByBusiness(leadId);
      qaDemo = demos.find((d) => d.quality_score !== null);
    }

    if (!qaDemo) return false;

    await decisionLogger.recordOutcome(decision.decision_id, {
      actual_outcome: qaDemo.quality_passed ? "qa_passed" : "qa_failed",
      actual_metric: { quality_score: qaDemo.quality_score },
    });
    return true;
  }

  // pitch_outcome_recorded decisions are already terminal — they don't need measurement
  if (decision.decision_type === "pitch_outcome_recorded") {
    return false; // already captured at recording time
  }

  // pipeline_execution, task_created, agent_dispatched are measured at execution time
  // by the orchestrator and agentRuntime wrappers — skip
  if (
    decision.decision_type === "pipeline_execution" ||
    decision.decision_type === "task_created" ||
    decision.decision_type === "agent_dispatched"
  ) {
    return false; // should already be measured; if not, will expire
  }

  return false;
}

function getUniqueAgentIds(decisions: DecisionRecord[]): string[] {
  const ids = new Set<string>();
  for (const d of decisions) {
    ids.add(d.agent_id);
  }
  return [...ids].sort();
}
