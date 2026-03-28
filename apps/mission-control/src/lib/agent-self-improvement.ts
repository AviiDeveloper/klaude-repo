/**
 * Agent Self-Improvement — closes the feedback loop.
 *
 * Monitors agent performance profiles. When failure_rate exceeds thresholds,
 * queries memory for failure patterns, analyzes root causes, and proposes
 * reference sheet revisions (draft state, requires operator approval).
 */

import { v4 as uuidv4 } from 'uuid';
import { queryAll, queryOne, run } from '@/lib/db';
import { buildAgentFactoryArtifacts } from '@/lib/agent-factory';
import { PRODUCTION_AGENTS } from '@/lib/production-agent-profiles';
import type { Agent, AgentFactoryRequest } from '@/lib/types';

interface AgentPerformanceProfile {
  agent_id: string;
  workspace_id: string;
  rolling_score: number;
  pass_rate: number;
  failure_rate: number;
  input_gap_rate: number;
  avg_confidence: number;
  samples: number;
  updated_at: string;
}

interface EvalRunRow {
  id: string;
  quality_score: number;
  status: string;
  fault_attribution: string;
  reason_codes_json: string | null;
  summary: string;
  evaluated_at: string;
}

interface MemoryDocRow {
  id: string;
  tags_json: string;
  compressed_content: string;
}

interface RevisionProposal {
  agent_id: string;
  agent_name: string;
  trigger: string;
  failure_patterns: string[];
  common_reason_codes: string[];
  recommended_adjustments: string[];
  draft_sheet_id: string | null;
  approval_request_id: string | null;
}

const FAILURE_RATE_THRESHOLD = 0.3;
const MIN_SAMPLES = 5;

/**
 * Evaluate an agent for potential reference sheet revision.
 * Returns a revision proposal if improvement is needed, null otherwise.
 */
export function evaluateAgentForRevision(
  agentId: string,
  workspaceId: string,
): RevisionProposal | null {
  const profile = queryOne<AgentPerformanceProfile>(
    'SELECT * FROM agent_performance_profiles WHERE agent_id = ? AND workspace_id = ?',
    [agentId, workspaceId],
  );

  if (!profile) return null;
  if (profile.samples < MIN_SAMPLES) return null;
  if (profile.failure_rate <= FAILURE_RATE_THRESHOLD) return null;

  const agent = queryOne<Agent>('SELECT * FROM agents WHERE id = ?', [agentId]);
  if (!agent) return null;

  // Analyze recent failures
  const recentFailures = queryAll<EvalRunRow>(
    `SELECT * FROM agent_eval_runs
     WHERE agent_id = ? AND workspace_id = ? AND status = 'fail'
     ORDER BY evaluated_at DESC LIMIT 10`,
    [agentId, workspaceId],
  );

  // Extract failure patterns
  const reasonCodeCounts = new Map<string, number>();
  const faultCounts = new Map<string, number>();
  for (const failure of recentFailures) {
    const codes: string[] = failure.reason_codes_json ? JSON.parse(failure.reason_codes_json) : [];
    for (const code of codes) {
      reasonCodeCounts.set(code, (reasonCodeCounts.get(code) || 0) + 1);
    }
    faultCounts.set(failure.fault_attribution, (faultCounts.get(failure.fault_attribution) || 0) + 1);
  }

  const commonReasonCodes = [...reasonCodeCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([code]) => code);

  const primaryFault = [...faultCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown';

  // Query memory for failure context
  const failureMemories = queryAll<MemoryDocRow>(
    `SELECT id, tags_json, compressed_content FROM memory_documents
     WHERE agent_id = ? AND workspace_id = ?
     AND json_extract(tags_json, '$.outcome') = 'fail'
     ORDER BY created_at DESC LIMIT 5`,
    [agentId, workspaceId],
  );

  const failurePatterns = failureMemories.map((m) => m.compressed_content.slice(0, 100));

  // Generate recommended adjustments based on failure analysis
  const adjustments: string[] = [];
  if (primaryFault === 'agent_error') {
    adjustments.push('Tighten quality bar in reference sheet');
    adjustments.push('Add specific failure mode awareness for: ' + commonReasonCodes.slice(0, 3).join(', '));
    adjustments.push('Strengthen self-review process to catch common errors');
  } else if (primaryFault === 'input_gap') {
    adjustments.push('Expand input validation requirements');
    adjustments.push('Add upstream dependency checks before execution');
    adjustments.push('Request richer context from delegating agent');
  } else {
    adjustments.push('Review decision framework for edge cases');
    adjustments.push('Add specific handling for failure modes: ' + commonReasonCodes.slice(0, 3).join(', '));
  }

  // Create draft reference sheet revision
  let draftSheetId: string | null = null;
  let approvalRequestId: string | null = null;

  const factoryProfile = PRODUCTION_AGENTS.find((p) => p.name === agent.name);
  if (factoryProfile) {
    const revisedProfile: AgentFactoryRequest = {
      ...factoryProfile,
      workspace_id: workspaceId,
      quality_bar: `${factoryProfile.quality_bar || 'Production-ready outputs required.'} REVISION NOTE: Recent failure rate ${(profile.failure_rate * 100).toFixed(0)}%. Common issues: ${commonReasonCodes.slice(0, 3).join(', ')}. ${adjustments[0]}.`,
      learning_loop: `${factoryProfile.learning_loop || 'Log and learn from each run.'} REVISION: Focus on preventing ${primaryFault} failures. Monitor: ${commonReasonCodes.slice(0, 2).join(', ')}.`,
    };

    const artifacts = buildAgentFactoryArtifacts(revisedProfile);

    // Get current version
    const currentSheet = queryOne<{ version: number; id: string }>(
      `SELECT id, version FROM agent_reference_sheets
       WHERE agent_id = ? AND lifecycle_state = 'active'
       ORDER BY version DESC LIMIT 1`,
      [agentId],
    );

    const newVersion = (currentSheet?.version || 0) + 1;
    draftSheetId = uuidv4();
    const now = new Date().toISOString();

    run(
      `INSERT INTO agent_reference_sheets
        (id, agent_id, version, title, markdown, lifecycle_state, lifecycle_action, parent_sheet_id, metadata, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'draft', 'revise', ?, ?, ?, ?)`,
      [
        draftSheetId,
        agentId,
        newVersion,
        `${agent.name} — Revised Reference Dossier v${newVersion}`,
        artifacts.referenceSheet,
        currentSheet?.id || null,
        JSON.stringify({
          revision_trigger: 'performance_threshold',
          failure_rate: profile.failure_rate,
          samples: profile.samples,
          common_reason_codes: commonReasonCodes,
          primary_fault: primaryFault,
          adjustments,
        }),
        now,
        now,
      ],
    );

    // Log transition
    run(
      `INSERT INTO agent_reference_sheet_transitions
        (id, sheet_id, agent_id, transition_type, from_state, to_state, actor, reason, metadata, created_at)
       VALUES (?, ?, ?, 'revise', NULL, 'draft', 'self-improvement', ?, ?, ?)`,
      [
        uuidv4(),
        draftSheetId,
        agentId,
        `Failure rate ${(profile.failure_rate * 100).toFixed(0)}% exceeded ${(FAILURE_RATE_THRESHOLD * 100).toFixed(0)}% threshold`,
        JSON.stringify({ common_reason_codes: commonReasonCodes, primary_fault: primaryFault }),
        now,
      ],
    );

    // Create approval request for the revision
    approvalRequestId = uuidv4();
    try {
      run(
        `INSERT INTO lead_approval_requests
          (id, workspace_id, task_id, requested_by_agent_id, recommendation, risks_json, decision_options_json, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
        [
          approvalRequestId,
          workspaceId,
          agentId, // Using agent_id as task_id for reference
          agentId,
          `Agent ${agent.name} has a ${(profile.failure_rate * 100).toFixed(0)}% failure rate over ${profile.samples} samples. Proposing reference sheet revision to address: ${adjustments[0]}`,
          JSON.stringify([`Revision may change agent behavior`, `Common failures: ${commonReasonCodes.join(', ')}`]),
          JSON.stringify(['Approve revision (activate draft)', 'Deny revision (keep current sheet)']),
          now,
          now,
        ],
      );
    } catch {
      // Approval request creation may fail if task_id FK doesn't match — non-critical
      approvalRequestId = null;
    }
  }

  return {
    agent_id: agentId,
    agent_name: agent.name,
    trigger: `failure_rate=${(profile.failure_rate * 100).toFixed(0)}% > threshold=${(FAILURE_RATE_THRESHOLD * 100).toFixed(0)}%`,
    failure_patterns: failurePatterns,
    common_reason_codes: commonReasonCodes,
    recommended_adjustments: adjustments,
    draft_sheet_id: draftSheetId,
    approval_request_id: approvalRequestId,
  };
}

/**
 * Run self-improvement check across all agents in a workspace.
 */
export function runSelfImprovementCycle(workspaceId: string): RevisionProposal[] {
  const agents = queryAll<Agent>(
    'SELECT * FROM agents WHERE workspace_id = ? AND is_master = 0',
    [workspaceId],
  );

  const proposals: RevisionProposal[] = [];
  for (const agent of agents) {
    const proposal = evaluateAgentForRevision(agent.id, workspaceId);
    if (proposal) {
      proposals.push(proposal);
    }
  }

  return proposals;
}
