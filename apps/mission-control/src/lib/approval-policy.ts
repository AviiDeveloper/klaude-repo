/**
 * Production Approval Policy — defines which actions are auto-approved vs manual.
 *
 * Aligned with production context:
 * - Auto: training (if cheap), GPU terminate, score updates, anomaly flags, A/B staging
 * - Manual: full deploy, scrape pause, SP suspension, budget override, new market
 */

interface ApprovalRule {
  action: string;
  condition: (params: { cost_gbp?: number; agent_id?: string }) => boolean;
}

const AUTO_APPROVED: ApprovalRule[] = [
  { action: 'training_start', condition: ({ cost_gbp }) => (cost_gbp ?? 0) < 20 },
  { action: 'gpu_terminate', condition: () => true },
  { action: 'score_update', condition: () => true },
  { action: 'lead_score_update', condition: () => true },
  { action: 'anomaly_flag', condition: () => true },
  { action: 'ab_test_stage', condition: () => true },
  { action: 'data_validation', condition: () => true },
  { action: 'analytics_run', condition: () => true },
  { action: 'cost_alert', condition: () => true },
  { action: 'backup_check', condition: () => true },
];

const MANUAL_REQUIRED = new Set([
  'full_model_deploy',
  'model_deploy_full',
  'scrape_source_pause',
  'scrape_pause',
  'sp_suspension',
  'budget_override',
  'new_market_action',
  'new_market',
  'pricing_change',
  'legal_compliance',
]);

/**
 * Check if an action should be auto-approved.
 * Returns true if auto-approved, false if manual approval required.
 */
export function shouldAutoApprove(
  action: string,
  params: { cost_gbp?: number; agent_id?: string } = {},
): boolean {
  // Manual-required actions always need operator approval
  if (MANUAL_REQUIRED.has(action)) {
    return false;
  }

  // Check auto-approve rules
  const rule = AUTO_APPROVED.find((r) => r.action === action);
  if (rule) {
    return rule.condition(params);
  }

  // Default: require approval for unknown actions (fail-closed)
  return false;
}

/**
 * Get the approval requirement for a given action.
 */
export function getApprovalRequirement(action: string): 'auto' | 'manual' | 'conditional' | 'unknown' {
  if (MANUAL_REQUIRED.has(action)) return 'manual';

  const rule = AUTO_APPROVED.find((r) => r.action === action);
  if (rule) {
    // Check if the condition is always-true (unconditional auto-approve)
    try {
      return rule.condition({}) ? 'auto' : 'conditional';
    } catch {
      return 'conditional';
    }
  }

  return 'unknown';
}

/**
 * List all configured approval policies for operator visibility.
 */
export function listApprovalPolicies(): Array<{
  action: string;
  type: 'auto' | 'manual' | 'conditional';
}> {
  const policies: Array<{ action: string; type: 'auto' | 'manual' | 'conditional' }> = [];

  for (const rule of AUTO_APPROVED) {
    const type = getApprovalRequirement(rule.action) as 'auto' | 'conditional';
    policies.push({ action: rule.action, type });
  }

  Array.from(MANUAL_REQUIRED).forEach((action) => {
    policies.push({ action, type: 'manual' });
  });

  return policies.sort((a, b) => a.action.localeCompare(b.action));
}
