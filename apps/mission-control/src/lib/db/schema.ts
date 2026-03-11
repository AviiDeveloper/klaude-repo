/**
 * Database Schema for Mission Control
 * 
 * This defines the current desired schema state.
 * For existing databases, migrations handle schema updates.
 * 
 * IMPORTANT: When adding new tables or columns:
 * 1. Add them here for new databases
 * 2. Create a migration in migrations.ts for existing databases
 */

export const schema = `
-- Workspaces table
CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT DEFAULT '📁',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Agents table
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  description TEXT,
  avatar_emoji TEXT DEFAULT '🤖',
  status TEXT DEFAULT 'standby' CHECK (status IN ('standby', 'working', 'offline')),
  is_master INTEGER DEFAULT 0,
  workspace_id TEXT DEFAULT 'default' REFERENCES workspaces(id),
  soul_md TEXT,
  user_md TEXT,
  agents_md TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Tasks table (Mission Queue)
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'inbox' CHECK (status IN ('planning', 'inbox', 'assigned', 'in_progress', 'testing', 'review', 'done')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  assigned_agent_id TEXT REFERENCES agents(id),
  created_by_agent_id TEXT REFERENCES agents(id),
  workspace_id TEXT DEFAULT 'default' REFERENCES workspaces(id),
  business_id TEXT DEFAULT 'default',
  due_date TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Planning questions table
CREATE TABLE IF NOT EXISTS planning_questions (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  question TEXT NOT NULL,
  question_type TEXT DEFAULT 'multiple_choice' CHECK (question_type IN ('multiple_choice', 'text', 'yes_no')),
  options TEXT,
  answer TEXT,
  answered_at TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Planning specs table (locked specifications)
CREATE TABLE IF NOT EXISTS planning_specs (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL UNIQUE REFERENCES tasks(id) ON DELETE CASCADE,
  spec_markdown TEXT NOT NULL,
  locked_at TEXT NOT NULL,
  locked_by TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Conversations table (agent-to-agent or task-related)
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  title TEXT,
  type TEXT DEFAULT 'direct' CHECK (type IN ('direct', 'group', 'task')),
  task_id TEXT REFERENCES tasks(id),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Conversation participants
CREATE TABLE IF NOT EXISTS conversation_participants (
  conversation_id TEXT REFERENCES conversations(id) ON DELETE CASCADE,
  agent_id TEXT REFERENCES agents(id) ON DELETE CASCADE,
  joined_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (conversation_id, agent_id)
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT REFERENCES conversations(id) ON DELETE CASCADE,
  sender_agent_id TEXT REFERENCES agents(id),
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'system', 'task_update', 'file')),
  metadata TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Events table (for live feed)
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  agent_id TEXT REFERENCES agents(id),
  task_id TEXT REFERENCES tasks(id),
  message TEXT NOT NULL,
  metadata TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Businesses/Workspaces table (legacy - kept for compatibility)
CREATE TABLE IF NOT EXISTS businesses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- OpenClaw session mapping
CREATE TABLE IF NOT EXISTS openclaw_sessions (
  id TEXT PRIMARY KEY,
  agent_id TEXT REFERENCES agents(id),
  openclaw_session_id TEXT NOT NULL,
  channel TEXT,
  status TEXT DEFAULT 'active',
  session_type TEXT DEFAULT 'persistent',
  task_id TEXT REFERENCES tasks(id),
  ended_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Task activities table (for real-time activity log)
CREATE TABLE IF NOT EXISTS task_activities (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  agent_id TEXT REFERENCES agents(id),
  activity_type TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Task deliverables table (files, URLs, artifacts)
CREATE TABLE IF NOT EXISTS task_deliverables (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  deliverable_type TEXT NOT NULL,
  title TEXT NOT NULL,
  path TEXT,
  description TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Agent reference sheets (generated capability/runbook docs)
CREATE TABLE IF NOT EXISTS agent_reference_sheets (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  title TEXT NOT NULL,
  markdown TEXT NOT NULL,
  lifecycle_state TEXT NOT NULL DEFAULT 'active' CHECK (lifecycle_state IN ('draft', 'active', 'archived')),
  lifecycle_action TEXT NOT NULL DEFAULT 'create' CHECK (lifecycle_action IN ('create', 'version', 'revise')),
  parent_sheet_id TEXT REFERENCES agent_reference_sheets(id) ON DELETE SET NULL,
  archived_at TEXT,
  metadata TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS agent_reference_sheet_transitions (
  id TEXT PRIMARY KEY,
  sheet_id TEXT NOT NULL REFERENCES agent_reference_sheets(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  transition_type TEXT NOT NULL CHECK (transition_type IN ('create', 'version', 'revise', 'archive')),
  from_state TEXT CHECK (from_state IN ('draft', 'active', 'archived')),
  to_state TEXT NOT NULL CHECK (to_state IN ('draft', 'active', 'archived')),
  actor TEXT,
  reason TEXT,
  metadata TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Operator profile memory (global human context per workspace)
CREATE TABLE IF NOT EXISTS operator_profiles (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL UNIQUE REFERENCES workspaces(id) ON DELETE CASCADE,
  operator_name TEXT,
  identity_summary TEXT,
  strategic_goals TEXT,
  communication_preferences TEXT,
  approval_preferences TEXT,
  risk_preferences TEXT,
  budget_preferences TEXT,
  schedule_preferences TEXT,
  tool_preferences TEXT,
  escalation_preferences TEXT,
  memory_notes TEXT,
  metadata TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Server-side application settings (gateway/config overrides)
CREATE TABLE IF NOT EXISTS app_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_tasks_workspace ON tasks(workspace_id);
CREATE INDEX IF NOT EXISTS idx_agents_workspace ON agents(workspace_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
CREATE INDEX IF NOT EXISTS idx_activities_task ON task_activities(task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deliverables_task ON task_deliverables(task_id);
CREATE INDEX IF NOT EXISTS idx_openclaw_sessions_task ON openclaw_sessions(task_id);
CREATE INDEX IF NOT EXISTS idx_planning_questions_task ON planning_questions(task_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_agent_reference_sheets_agent ON agent_reference_sheets(agent_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_agent_reference_sheets_agent_state ON agent_reference_sheets(agent_id, lifecycle_state, version DESC);
CREATE INDEX IF NOT EXISTS idx_agent_reference_sheet_transitions_sheet ON agent_reference_sheet_transitions(sheet_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_operator_profiles_workspace ON operator_profiles(workspace_id);
CREATE INDEX IF NOT EXISTS idx_app_settings_updated ON app_settings(updated_at DESC);

-- Lead orchestrator intake queue
CREATE TABLE IF NOT EXISTS lead_task_intake (
  task_id TEXT PRIMARY KEY REFERENCES tasks(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'intake' CHECK (status IN ('intake', 'triage', 'delegated', 'monitoring', 'awaiting_operator', 'closed', 'blocked')),
  triage_summary TEXT,
  lead_agent_id TEXT NOT NULL REFERENCES agents(id),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Lead-to-worker task delegations
CREATE TABLE IF NOT EXISTS lead_task_delegations (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  delegated_by_agent_id TEXT NOT NULL REFERENCES agents(id),
  delegated_to_agent_id TEXT NOT NULL REFERENCES agents(id),
  rationale TEXT NOT NULL,
  expected_output_contract TEXT NOT NULL,
  timeout_ms INTEGER NOT NULL DEFAULT 600000,
  retry_limit INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'delegated' CHECK (status IN ('delegated', 'running', 'completed', 'failed', 'blocked')),
  last_error TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Lead decision log
CREATE TABLE IF NOT EXISTS lead_decision_logs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  decision_type TEXT NOT NULL,
  summary TEXT NOT NULL,
  details_json TEXT,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('lead', 'operator', 'worker', 'system')),
  actor_id TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Worker findings routed to lead
CREATE TABLE IF NOT EXISTS lead_findings (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL REFERENCES agents(id),
  summary TEXT NOT NULL,
  evidence_json TEXT,
  risk_level TEXT NOT NULL DEFAULT 'medium' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  recommendation TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'triaged', 'approval_requested', 'resolved')),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Operator approval requests created by lead
CREATE TABLE IF NOT EXISTS lead_approval_requests (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  finding_id TEXT REFERENCES lead_findings(id) ON DELETE SET NULL,
  requested_by_agent_id TEXT NOT NULL REFERENCES agents(id),
  recommendation TEXT NOT NULL,
  risks_json TEXT,
  decision_options_json TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  operator_id TEXT,
  decision TEXT CHECK (decision IN ('approved', 'denied')),
  rationale TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  resolved_at TEXT
);

-- Lead memory journal (learning + run notes)
CREATE TABLE IF NOT EXISTS lead_memory_journal (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  decision_id TEXT REFERENCES lead_decision_logs(id) ON DELETE SET NULL,
  entry_type TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata_json TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Operator command history for lead
CREATE TABLE IF NOT EXISTS lead_operator_commands (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  operator_id TEXT NOT NULL,
  command TEXT NOT NULL,
  metadata_json TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_lead_task_intake_workspace_status ON lead_task_intake(workspace_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_delegations_task ON lead_task_delegations(task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_decisions_task ON lead_decision_logs(task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_findings_task ON lead_findings(task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_approvals_task_status ON lead_approval_requests(task_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_journal_workspace ON lead_memory_journal(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_commands_workspace ON lead_operator_commands(workspace_id, created_at DESC);

-- Agent evaluation specifications per task type
CREATE TABLE IF NOT EXISTS agent_eval_specs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  agent_id TEXT REFERENCES agents(id) ON DELETE CASCADE,
  task_type TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  criteria_json TEXT NOT NULL,
  rubric_json TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Evaluation runs produced for delegated work
CREATE TABLE IF NOT EXISTS agent_eval_runs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  delegation_id TEXT REFERENCES lead_task_delegations(id) ON DELETE SET NULL,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  eval_spec_id TEXT REFERENCES agent_eval_specs(id) ON DELETE SET NULL,
  quality_score INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pass', 'partial', 'fail')),
  confidence REAL NOT NULL,
  fault_attribution TEXT NOT NULL CHECK (fault_attribution IN ('agent_error', 'input_gap', 'mixed', 'unknown')),
  reason_codes_json TEXT,
  summary TEXT NOT NULL,
  details_json TEXT,
  evaluated_at TEXT DEFAULT (datetime('now'))
);

-- Aggregated rolling performance profile per agent
CREATE TABLE IF NOT EXISTS agent_performance_profiles (
  agent_id TEXT PRIMARY KEY REFERENCES agents(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  rolling_score REAL NOT NULL DEFAULT 0,
  pass_rate REAL NOT NULL DEFAULT 0,
  failure_rate REAL NOT NULL DEFAULT 0,
  input_gap_rate REAL NOT NULL DEFAULT 0,
  avg_confidence REAL NOT NULL DEFAULT 0,
  samples INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Generated architecture learning questions
CREATE TABLE IF NOT EXISTS learning_questions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('git_diff', 'decision_log', 'manual')),
  source_ref TEXT,
  question TEXT NOT NULL,
  expected_answer_json TEXT NOT NULL,
  concept_tag TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Operator answers with scoring feedback
CREATE TABLE IF NOT EXISTS learning_answers (
  id TEXT PRIMARY KEY,
  question_id TEXT NOT NULL REFERENCES learning_questions(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  operator_id TEXT,
  answer_text TEXT NOT NULL,
  score INTEGER NOT NULL,
  grade TEXT NOT NULL CHECK (grade IN ('good', 'partial', 'wrong')),
  feedback TEXT NOT NULL,
  next_resource TEXT,
  coverage_score REAL NOT NULL DEFAULT 0,
  reasoning_score REAL NOT NULL DEFAULT 0,
  confidence REAL NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_eval_specs_workspace_agent ON agent_eval_specs(workspace_id, agent_id, task_type, version DESC);
CREATE INDEX IF NOT EXISTS idx_eval_runs_task ON agent_eval_runs(task_id, evaluated_at DESC);
CREATE INDEX IF NOT EXISTS idx_eval_runs_agent ON agent_eval_runs(agent_id, evaluated_at DESC);
CREATE INDEX IF NOT EXISTS idx_perf_profiles_workspace ON agent_performance_profiles(workspace_id, rolling_score DESC);
CREATE INDEX IF NOT EXISTS idx_learning_questions_workspace ON learning_questions(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_learning_answers_question ON learning_answers(question_id, created_at DESC);

-- OpenClaw/OpenRouter request telemetry captured from gateway responses
CREATE TABLE IF NOT EXISTS ai_request_telemetry (
  id TEXT PRIMARY KEY,
  created_at TEXT DEFAULT (datetime('now')),
  request_id TEXT,
  method TEXT NOT NULL,
  provider TEXT,
  model TEXT,
  finish_reason TEXT,
  status TEXT NOT NULL CHECK (status IN ('ok', 'error')),
  error_message TEXT,
  session_key TEXT,
  session_id TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  total_tokens INTEGER,
  cost_usd REAL,
  request_json TEXT,
  response_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_ai_request_telemetry_created_at ON ai_request_telemetry(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_request_telemetry_method ON ai_request_telemetry(method, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_request_telemetry_session_id ON ai_request_telemetry(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_request_telemetry_model ON ai_request_telemetry(model, created_at DESC);
`;
