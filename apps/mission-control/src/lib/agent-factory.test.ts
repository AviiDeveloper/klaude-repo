import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAgentFactoryArtifacts, validateReferenceTemplateCompleteness } from './agent-factory';
import type { AgentFactoryRequest } from './types';

const baseInput: AgentFactoryRequest = {
  workspace_id: 'default',
  name: 'Template Guard Agent',
  role: 'automation',
  objective: 'Deliver deterministic outputs for template completeness checks.',
  specialization: 'operations',
  autonomy_level: 'semi-autonomous',
  risk_tolerance: 'medium',
  tool_stack: ['openclaw'],
  handoff_targets: ['qa-agent'],
  approval_required_actions: ['deploy'],
  output_contract: 'Return concise markdown with structured checklist.',
  cadence: 'daily',
  competency_profile: ['analysis'],
  knowledge_sources: ['runbooks'],
  kpi_targets: ['on-time delivery'],
  expertise_primary_skills: ['planning'],
  expertise_secondary_skills: ['communication'],
};

test('generated reference template passes deterministic completeness checks', () => {
  const artifacts = buildAgentFactoryArtifacts(baseInput);
  assert.equal(artifacts.templateCompleteness.ready, true);
  assert.equal(artifacts.templateCompleteness.missing.length, 0);
});

test('completeness checker flags missing required sections', () => {
  const invalid = validateReferenceTemplateCompleteness('## Page 1: Identity and Strategic Charter');
  assert.equal(invalid.ready, false);
  assert.ok(invalid.missing.length > 0);
});
