// Core types for Mission Control

export type AgentStatus = 'standby' | 'working' | 'offline';

export type TaskStatus = 'planning' | 'inbox' | 'assigned' | 'in_progress' | 'testing' | 'review' | 'done';

export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';

export type MessageType = 'text' | 'system' | 'task_update' | 'file';

export type ConversationType = 'direct' | 'group' | 'task';

export type EventType =
  | 'task_created'
  | 'task_assigned'
  | 'task_dispatched'
  | 'task_status_changed'
  | 'task_completed'
  | 'message_sent'
  | 'agent_status_changed'
  | 'agent_joined'
  | 'lead_intake'
  | 'lead_delegated'
  | 'lead_approval_requested'
  | 'lead_approval_resolved'
  | 'lead_command'
  | 'system';

export interface Agent {
  id: string;
  name: string;
  role: string;
  description?: string;
  avatar_emoji: string;
  status: AgentStatus;
  is_master: boolean;
  workspace_id: string;
  soul_md?: string;
  user_md?: string;
  agents_md?: string;
  created_at: string;
  updated_at: string;
}

export interface AgentReferenceSheet {
  id: string;
  agent_id: string;
  version: number;
  title: string;
  markdown: string;
  metadata?: string;
  created_at: string;
}

export interface OperatorProfile {
  id: string;
  workspace_id: string;
  operator_name?: string;
  identity_summary?: string;
  strategic_goals?: string;
  communication_preferences?: string;
  approval_preferences?: string;
  risk_preferences?: string;
  budget_preferences?: string;
  schedule_preferences?: string;
  tool_preferences?: string;
  escalation_preferences?: string;
  memory_notes?: string;
  metadata?: string;
  created_at: string;
  updated_at: string;
}

export interface MemoryPacket {
  workspace_id: string;
  operator_profile: {
    operator_name?: string;
    identity_summary?: string;
    strategic_goals?: string;
    communication_preferences?: string;
    approval_preferences?: string;
    risk_preferences?: string;
    budget_preferences?: string;
    schedule_preferences?: string;
    tool_preferences?: string;
    escalation_preferences?: string;
    memory_notes?: string;
  } | null;
  workspace_context: {
    id: string;
    name: string;
    slug: string;
  } | null;
  task_context: {
    id: string;
    title: string;
    description?: string;
    priority: string;
    status: string;
    due_date?: string;
  } | null;
  agent_context: {
    id: string;
    name: string;
    role: string;
    status: string;
  } | null;
  learning_context: {
    sample_count: number;
    recent_answer_count: number;
    avg_score: number;
    latest_score: number | null;
    good_rate: number;
    partial_rate: number;
    wrong_rate: number;
    trend: 'improving' | 'declining' | 'stable' | 'insufficient_data';
    delegation_mode: 'conservative' | 'balanced' | 'exploratory';
    coaching_focus: string;
    latest_concept_tag?: string | null;
  } | null;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigned_agent_id?: string;
  created_by_agent_id?: string;
  workspace_id: string;
  business_id: string;
  due_date?: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  assigned_agent?: Agent;
  created_by_agent?: Agent;
}

export interface LeadDecisionLog {
  id: string;
  workspace_id: string;
  task_id: string;
  decision_type: string;
  summary: string;
  details_json?: string;
  actor_type: 'lead' | 'operator' | 'worker' | 'system';
  actor_id?: string;
  created_at: string;
}

export type EvalStatus = 'pass' | 'partial' | 'fail';
export type EvalFaultAttribution = 'agent_error' | 'input_gap' | 'mixed' | 'unknown';
export type LearningSourceType = 'git_diff' | 'decision_log' | 'manual';

export interface AgentEvalSpec {
  id: string;
  workspace_id: string;
  agent_id?: string | null;
  task_type: string;
  version: number;
  criteria_json: string;
  rubric_json: string;
  created_at: string;
  updated_at: string;
}

export interface AgentEvalRun {
  id: string;
  workspace_id: string;
  task_id: string;
  delegation_id?: string | null;
  agent_id: string;
  eval_spec_id?: string | null;
  quality_score: number;
  status: EvalStatus;
  confidence: number;
  fault_attribution: EvalFaultAttribution;
  reason_codes_json?: string | null;
  summary: string;
  details_json?: string | null;
  evaluated_at: string;
}

export interface AgentPerformanceProfile {
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

export interface LearningQuestion {
  id: string;
  workspace_id: string;
  source_type: LearningSourceType;
  source_ref?: string | null;
  question: string;
  expected_answer_json: string;
  concept_tag?: string | null;
  created_at: string;
}

export interface LearningAnswer {
  id: string;
  question_id: string;
  workspace_id: string;
  operator_id?: string | null;
  answer_text: string;
  score: number;
  grade: 'good' | 'partial' | 'wrong';
  feedback: string;
  next_resource?: string | null;
  created_at: string;
}

export interface LeadQueueItem {
  task_id: string;
  workspace_id: string;
  status: 'intake' | 'triage' | 'delegated' | 'monitoring' | 'awaiting_operator' | 'closed' | 'blocked';
  triage_summary?: string | null;
  lead_agent_id: string;
  created_at: string;
  updated_at: string;
  task_title: string;
  task_description?: string | null;
  task_priority: string;
  task_status: string;
  assigned_agent_id?: string | null;
  assigned_agent_name?: string | null;
  latest_delegation_id?: string | null;
  latest_delegation_status?: string | null;
  latest_eval_status?: EvalStatus | null;
  latest_eval_score?: number | null;
  latest_eval_fault?: EvalFaultAttribution | null;
  latest_eval_at?: string | null;
}

export interface Conversation {
  id: string;
  title?: string;
  type: ConversationType;
  task_id?: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  participants?: Agent[];
  last_message?: Message;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_agent_id?: string;
  content: string;
  message_type: MessageType;
  metadata?: string;
  created_at: string;
  // Joined fields
  sender?: Agent;
}

export interface Event {
  id: string;
  type: EventType;
  agent_id?: string;
  task_id?: string;
  message: string;
  metadata?: string;
  created_at: string;
  // Joined fields
  agent?: Agent;
  task?: Task;
}

export interface Business {
  id: string;
  name: string;
  description?: string;
  created_at: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon: string;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceStats {
  id: string;
  name: string;
  slug: string;
  icon: string;
  taskCounts: {
    planning: number;
    inbox: number;
    assigned: number;
    in_progress: number;
    testing: number;
    review: number;
    done: number;
    total: number;
  };
  agentCount: number;
}

export interface OpenClawSession {
  id: string;
  agent_id: string;
  openclaw_session_id: string;
  channel?: string;
  status: string;
  session_type: 'persistent' | 'subagent';
  task_id?: string;
  ended_at?: string;
  created_at: string;
  updated_at: string;
}

export type ActivityType =
  | 'spawned'
  | 'updated'
  | 'completed'
  | 'file_created'
  | 'status_changed'
  | 'test_passed'
  | 'test_failed';

export interface TaskActivity {
  id: string;
  task_id: string;
  agent_id?: string;
  activity_type: ActivityType;
  message: string;
  metadata?: string;
  created_at: string;
  // Joined fields
  agent?: Agent;
}

export type DeliverableType = 'file' | 'url' | 'artifact';

export interface TaskDeliverable {
  id: string;
  task_id: string;
  deliverable_type: DeliverableType;
  title: string;
  path?: string;
  description?: string;
  created_at: string;
}

// Planning types
export type PlanningQuestionType = 'multiple_choice' | 'text' | 'yes_no';

export type PlanningCategory = 
  | 'goal'
  | 'audience'
  | 'scope'
  | 'design'
  | 'content'
  | 'technical'
  | 'timeline'
  | 'constraints';

export interface PlanningQuestionOption {
  id: string;
  label: string;
}

export interface PlanningQuestion {
  id: string;
  task_id: string;
  category: PlanningCategory;
  question: string;
  question_type: PlanningQuestionType;
  options?: PlanningQuestionOption[];
  answer?: string;
  answered_at?: string;
  sort_order: number;
  created_at: string;
}

export interface PlanningSpec {
  id: string;
  task_id: string;
  spec_markdown: string;
  locked_at: string;
  locked_by?: string;
  created_at: string;
}

export interface PlanningState {
  questions: PlanningQuestion[];
  spec?: PlanningSpec;
  progress: {
    total: number;
    answered: number;
    percentage: number;
  };
  isLocked: boolean;
}

// API request/response types
export interface CreateAgentRequest {
  name: string;
  role: string;
  description?: string;
  avatar_emoji?: string;
  is_master?: boolean;
  soul_md?: string;
  user_md?: string;
  agents_md?: string;
}

export interface AgentFactoryRequest {
  workspace_id?: string;
  name: string;
  role: string;
  objective: string;
  factory_context_sheet?: string;
  specialization: string;
  autonomy_level: 'assisted' | 'semi-autonomous' | 'autonomous';
  risk_tolerance: 'low' | 'medium' | 'high';
  tool_stack: string[];
  handoff_targets: string[];
  approval_required_actions: string[];
  output_contract: string;
  cadence: string;
  industry_context?: string;
  competency_profile?: string[];
  knowledge_sources?: string[];
  quality_bar?: string;
  decision_framework?: string;
  constraints_and_policies?: string;
  escalation_protocol?: string;
  reporting_contract?: string;
  kpi_targets?: string[];
  learning_loop?: string;
  identity_role_title?: string;
  identity_seniority_experience?: string;
  identity_core_belief?: string;
  identity_decision_style?: string;
  identity_professional_ego?: string;
  expertise_primary_skills?: string[];
  expertise_secondary_skills?: string[];
  expertise_domain_knowledge?: string;
  expertise_failure_modes?: string;
  expertise_quality_bar?: string;
  operating_context_org_identity?: string;
  operating_context_team_map?: string;
  operating_context_org_glossary?: string;
  operating_context_non_negotiables?: string;
  operating_context_political_awareness?: string;
  communication_voice_tone?: string;
  communication_output_format?: string;
  communication_reporting_standard?: string;
  communication_escalation_language?: string;
  communication_never_says?: string;
  authority_acts_alone_on?: string;
  authority_flags_before_acting_on?: string;
  authority_never_without_instruction?: string;
  authority_confidence_threshold?: string;
  authority_scope_creep_rule?: string;
  professional_definition_of_done?: string;
  professional_self_review_process?: string;
  professional_bad_day_standard?: string;
  professional_pride_standard?: string;
  heartbeat_on_wake?: string;
  heartbeat_on_load?: string;
  heartbeat_on_think?: string;
  heartbeat_on_act?: string;
  heartbeat_on_write?: string;
  heartbeat_on_report?: string;
  heartbeat_on_sleep?: string;
}

export interface UpdateAgentRequest extends Partial<CreateAgentRequest> {
  status?: AgentStatus;
}

export interface CreateTaskRequest {
  title: string;
  description?: string;
  priority?: TaskPriority;
  assigned_agent_id?: string;
  created_by_agent_id?: string;
  business_id?: string;
  due_date?: string;
}

export interface CreateEvalSpecRequest {
  workspace_id?: string;
  agent_id?: string | null;
  task_type: string;
  criteria: unknown;
  rubric: unknown;
}

export interface UpdateEvalSpecRequest {
  task_type?: string;
  criteria?: unknown;
  rubric?: unknown;
}

export interface RunEvalRequest {
  workspace_id?: string;
  task_id: string;
  agent_id?: string;
  delegation_id?: string;
  eval_spec_id?: string;
}

export interface UpdateTaskRequest extends Partial<CreateTaskRequest> {
  status?: TaskStatus;
}

export interface SendMessageRequest {
  conversation_id: string;
  sender_agent_id: string;
  content: string;
  message_type?: MessageType;
  metadata?: string;
}

// OpenClaw WebSocket message types
export interface OpenClawMessage {
  id?: number;
  method?: string;
  params?: Record<string, unknown>;
  result?: unknown;
  error?: { code: number; message: string };
}

export interface OpenClawSessionInfo {
  id: string;
  channel: string;
  peer?: string;
  model?: string;
  status: string;
}

// OpenClaw history message format (from Gateway)
export interface OpenClawHistoryMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
}

// Agent with OpenClaw session info (extended for UI use)
export interface AgentWithOpenClaw extends Agent {
  openclawSession?: OpenClawSession | null;
}

// Real-time SSE event types
export type SSEEventType =
  | 'task_updated'
  | 'task_created'
  | 'task_deleted'
  | 'activity_logged'
  | 'deliverable_added'
  | 'agent_spawned'
  | 'agent_completed';

export interface SSEEvent {
  type: SSEEventType;
  payload: Task | TaskActivity | TaskDeliverable | {
    taskId: string;
    sessionId: string;
    agentName?: string;
    summary?: string;
    deleted?: boolean;
  } | {
    id: string;  // For task_deleted events
  };
}
