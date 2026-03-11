/**
 * Database Migrations System
 * 
 * Handles schema changes in a production-safe way:
 * 1. Tracks which migrations have been applied
 * 2. Runs new migrations automatically on startup
 * 3. Never runs the same migration twice
 */

import Database from 'better-sqlite3';

interface Migration {
  id: string;
  name: string;
  up: (db: Database.Database) => void;
}

// All migrations in order - NEVER remove or reorder existing migrations
const migrations: Migration[] = [
  {
    id: '001',
    name: 'initial_schema',
    up: (db) => {
      // Core tables - these are created in schema.ts on fresh databases
      // This migration exists to mark the baseline for existing databases
      console.log('[Migration 001] Baseline schema marker');
    }
  },
  {
    id: '002',
    name: 'add_workspaces',
    up: (db) => {
      console.log('[Migration 002] Adding workspaces table and columns...');
      
      // Create workspaces table if not exists
      db.exec(`
        CREATE TABLE IF NOT EXISTS workspaces (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          slug TEXT NOT NULL UNIQUE,
          description TEXT,
          icon TEXT DEFAULT '📁',
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        );
      `);
      
      // Insert default workspace if not exists
      db.exec(`
        INSERT OR IGNORE INTO workspaces (id, name, slug, description, icon) 
        VALUES ('default', 'Default Workspace', 'default', 'Default workspace', '🏠');
      `);
      
      // Add workspace_id to tasks if not exists
      const tasksInfo = db.prepare("PRAGMA table_info(tasks)").all() as { name: string }[];
      if (!tasksInfo.some(col => col.name === 'workspace_id')) {
        db.exec(`ALTER TABLE tasks ADD COLUMN workspace_id TEXT DEFAULT 'default' REFERENCES workspaces(id)`);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_workspace ON tasks(workspace_id)`);
        console.log('[Migration 002] Added workspace_id to tasks');
      }
      
      // Add workspace_id to agents if not exists
      const agentsInfo = db.prepare("PRAGMA table_info(agents)").all() as { name: string }[];
      if (!agentsInfo.some(col => col.name === 'workspace_id')) {
        db.exec(`ALTER TABLE agents ADD COLUMN workspace_id TEXT DEFAULT 'default' REFERENCES workspaces(id)`);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_agents_workspace ON agents(workspace_id)`);
        console.log('[Migration 002] Added workspace_id to agents');
      }
    }
  },
  {
    id: '003',
    name: 'add_planning_tables',
    up: (db) => {
      console.log('[Migration 003] Adding planning tables...');
      
      // Create planning_questions table if not exists
      db.exec(`
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
      `);
      
      // Create planning_specs table if not exists
      db.exec(`
        CREATE TABLE IF NOT EXISTS planning_specs (
          id TEXT PRIMARY KEY,
          task_id TEXT NOT NULL UNIQUE REFERENCES tasks(id) ON DELETE CASCADE,
          spec_markdown TEXT NOT NULL,
          locked_at TEXT NOT NULL,
          locked_by TEXT,
          created_at TEXT DEFAULT (datetime('now'))
        );
      `);
      
      // Create index
      db.exec(`CREATE INDEX IF NOT EXISTS idx_planning_questions_task ON planning_questions(task_id, sort_order)`);
      
      // Update tasks status check constraint to include 'planning'
      // SQLite doesn't support ALTER CONSTRAINT, so we check if it's needed
      const taskSchema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='tasks'").get() as { sql: string } | undefined;
      if (taskSchema && !taskSchema.sql.includes("'planning'")) {
        console.log('[Migration 003] Note: tasks table needs planning status - will be handled by schema recreation on fresh dbs');
      }
    }
  },
  {
    id: '004',
    name: 'add_planning_session_columns',
    up: (db) => {
      console.log('[Migration 004] Adding planning session columns to tasks...');
      
      const tasksInfo = db.prepare("PRAGMA table_info(tasks)").all() as { name: string }[];
      
      // Add planning_session_key column
      if (!tasksInfo.some(col => col.name === 'planning_session_key')) {
        db.exec(`ALTER TABLE tasks ADD COLUMN planning_session_key TEXT`);
        console.log('[Migration 004] Added planning_session_key');
      }
      
      // Add planning_messages column (stores JSON array of messages)
      if (!tasksInfo.some(col => col.name === 'planning_messages')) {
        db.exec(`ALTER TABLE tasks ADD COLUMN planning_messages TEXT`);
        console.log('[Migration 004] Added planning_messages');
      }
      
      // Add planning_complete column
      if (!tasksInfo.some(col => col.name === 'planning_complete')) {
        db.exec(`ALTER TABLE tasks ADD COLUMN planning_complete INTEGER DEFAULT 0`);
        console.log('[Migration 004] Added planning_complete');
      }
      
      // Add planning_spec column (stores final spec JSON)
      if (!tasksInfo.some(col => col.name === 'planning_spec')) {
        db.exec(`ALTER TABLE tasks ADD COLUMN planning_spec TEXT`);
        console.log('[Migration 004] Added planning_spec');
      }
      
      // Add planning_agents column (stores generated agents JSON)
      if (!tasksInfo.some(col => col.name === 'planning_agents')) {
        db.exec(`ALTER TABLE tasks ADD COLUMN planning_agents TEXT`);
        console.log('[Migration 004] Added planning_agents');
      }
    }
  },
  {
    id: '005',
    name: 'add_agent_reference_sheets',
    up: (db) => {
      console.log('[Migration 005] Adding agent_reference_sheets table...');

      db.exec(`
        CREATE TABLE IF NOT EXISTS agent_reference_sheets (
          id TEXT PRIMARY KEY,
          agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
          version INTEGER NOT NULL,
          title TEXT NOT NULL,
          markdown TEXT NOT NULL,
          metadata TEXT,
          created_at TEXT DEFAULT (datetime('now'))
        );
      `);

      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_agent_reference_sheets_agent
        ON agent_reference_sheets(agent_id, version DESC)
      `);
    }
  },
  {
    id: '006',
    name: 'add_operator_profiles',
    up: (db) => {
      console.log('[Migration 006] Adding operator_profiles table...');

      db.exec(`
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
      `);

      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_operator_profiles_workspace
        ON operator_profiles(workspace_id)
      `);
    }
  },
  {
    id: '007',
    name: 'add_lead_orchestrator_tables',
    up: (db) => {
      console.log('[Migration 007] Adding lead orchestrator control-plane tables...');

      db.exec(`
        CREATE TABLE IF NOT EXISTS lead_task_intake (
          task_id TEXT PRIMARY KEY REFERENCES tasks(id) ON DELETE CASCADE,
          workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          status TEXT NOT NULL DEFAULT 'intake' CHECK (status IN ('intake', 'triage', 'delegated', 'monitoring', 'awaiting_operator', 'closed', 'blocked')),
          triage_summary TEXT,
          lead_agent_id TEXT NOT NULL REFERENCES agents(id),
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        );
      `);

      db.exec(`
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
      `);

      db.exec(`
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
      `);

      db.exec(`
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
      `);

      db.exec(`
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
      `);

      db.exec(`
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
      `);

      db.exec(`
        CREATE TABLE IF NOT EXISTS lead_operator_commands (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
          operator_id TEXT NOT NULL,
          command TEXT NOT NULL,
          metadata_json TEXT,
          created_at TEXT DEFAULT (datetime('now'))
        );
      `);

      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_lead_task_intake_workspace_status
        ON lead_task_intake(workspace_id, status, updated_at DESC)
      `);
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_lead_delegations_task
        ON lead_task_delegations(task_id, created_at DESC)
      `);
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_lead_decisions_task
        ON lead_decision_logs(task_id, created_at DESC)
      `);
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_lead_findings_task
        ON lead_findings(task_id, created_at DESC)
      `);
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_lead_approvals_task_status
        ON lead_approval_requests(task_id, status, created_at DESC)
      `);
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_lead_journal_workspace
        ON lead_memory_journal(workspace_id, created_at DESC)
      `);
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_lead_commands_workspace
        ON lead_operator_commands(workspace_id, created_at DESC)
      `);
    }
  },
  {
    id: '008',
    name: 'add_app_settings',
    up: (db) => {
      console.log('[Migration 008] Adding app_settings table...');

      db.exec(`
        CREATE TABLE IF NOT EXISTS app_settings (
          setting_key TEXT PRIMARY KEY,
          setting_value TEXT NOT NULL,
          updated_at TEXT DEFAULT (datetime('now'))
        );
      `);

      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_app_settings_updated
        ON app_settings(updated_at DESC)
      `);
    }
  },
  {
    id: '009',
    name: 'add_eval_and_learning_tables',
    up: (db) => {
      console.log('[Migration 009] Adding eval + learning tables...');

      db.exec(`
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
      `);

      db.exec(`
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
      `);

      db.exec(`
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
      `);

      db.exec(`
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
      `);

      db.exec(`
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
      `);

      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_eval_specs_workspace_agent
        ON agent_eval_specs(workspace_id, agent_id, task_type, version DESC)
      `);
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_eval_runs_task
        ON agent_eval_runs(task_id, evaluated_at DESC)
      `);
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_eval_runs_agent
        ON agent_eval_runs(agent_id, evaluated_at DESC)
      `);
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_perf_profiles_workspace
        ON agent_performance_profiles(workspace_id, rolling_score DESC)
      `);
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_learning_questions_workspace
        ON learning_questions(workspace_id, created_at DESC)
      `);
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_learning_answers_question
        ON learning_answers(question_id, created_at DESC)
      `);
    }
  },
  {
    id: '010',
    name: 'add_ai_request_telemetry',
    up: (db) => {
      console.log('[Migration 010] Adding ai_request_telemetry table...');

      db.exec(`
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
      `);

      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_ai_request_telemetry_created_at
        ON ai_request_telemetry(created_at DESC)
      `);
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_ai_request_telemetry_method
        ON ai_request_telemetry(method, created_at DESC)
      `);
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_ai_request_telemetry_session_id
        ON ai_request_telemetry(session_id, created_at DESC)
      `);
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_ai_request_telemetry_model
        ON ai_request_telemetry(model, created_at DESC)
      `);
    }
  },
  {
    id: '011',
    name: 'learning_answers_confidence_breakdown',
    up: (db) => {
      console.log('[Migration 011] Adding learning scorer confidence/breakdown columns...');

      const columns = db
        .prepare(`PRAGMA table_info(learning_answers)`)
        .all() as Array<{ name: string }>;
      const names = new Set(columns.map((column) => column.name));

      if (!names.has('coverage_score')) {
        db.exec(`ALTER TABLE learning_answers ADD COLUMN coverage_score REAL NOT NULL DEFAULT 0`);
      }
      if (!names.has('reasoning_score')) {
        db.exec(`ALTER TABLE learning_answers ADD COLUMN reasoning_score REAL NOT NULL DEFAULT 0`);
      }
      if (!names.has('confidence')) {
        db.exec(`ALTER TABLE learning_answers ADD COLUMN confidence REAL NOT NULL DEFAULT 0`);
      }
    }
  },
  {
    id: '012',
    name: 'add_reference_sheet_lifecycle',
    up: (db) => {
      console.log('[Migration 012] Adding reference sheet lifecycle columns and transitions...');

      const columns = db.prepare(`PRAGMA table_info(agent_reference_sheets)`).all() as Array<{ name: string }>;
      const hasColumn = (name: string) => columns.some((col) => col.name === name);

      if (!hasColumn('lifecycle_state')) {
        db.exec(`ALTER TABLE agent_reference_sheets ADD COLUMN lifecycle_state TEXT NOT NULL DEFAULT 'active' CHECK (lifecycle_state IN ('draft', 'active', 'archived'))`);
      }
      if (!hasColumn('lifecycle_action')) {
        db.exec(`ALTER TABLE agent_reference_sheets ADD COLUMN lifecycle_action TEXT NOT NULL DEFAULT 'create' CHECK (lifecycle_action IN ('create', 'version', 'revise'))`);
      }
      if (!hasColumn('parent_sheet_id')) {
        db.exec(`ALTER TABLE agent_reference_sheets ADD COLUMN parent_sheet_id TEXT REFERENCES agent_reference_sheets(id) ON DELETE SET NULL`);
      }
      if (!hasColumn('archived_at')) {
        db.exec(`ALTER TABLE agent_reference_sheets ADD COLUMN archived_at TEXT`);
      }
      if (!hasColumn('updated_at')) {
        db.exec(`ALTER TABLE agent_reference_sheets ADD COLUMN updated_at TEXT DEFAULT (datetime('now'))`);
      }

      db.exec(`
        UPDATE agent_reference_sheets
        SET lifecycle_state = COALESCE(lifecycle_state, 'active'),
            lifecycle_action = COALESCE(lifecycle_action, 'create'),
            updated_at = COALESCE(updated_at, created_at, datetime('now'))
      `);

      db.exec(`
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
        )
      `);

      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_agent_reference_sheets_agent_state
        ON agent_reference_sheets(agent_id, lifecycle_state, version DESC)
      `);
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_agent_reference_sheet_transitions_sheet
        ON agent_reference_sheet_transitions(sheet_id, created_at DESC)
      `);
    }
  }
];

/**
 * Run all pending migrations
 */
export function runMigrations(db: Database.Database): void {
  // Create migrations tracking table
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT DEFAULT (datetime('now'))
    )
  `);
  
  // Get already applied migrations
  const applied = new Set(
    (db.prepare('SELECT id FROM _migrations').all() as { id: string }[]).map(m => m.id)
  );
  
  // Run pending migrations in order
  for (const migration of migrations) {
    if (applied.has(migration.id)) {
      continue;
    }
    
    console.log(`[DB] Running migration ${migration.id}: ${migration.name}`);
    
    try {
      // Run migration in a transaction
      db.transaction(() => {
        migration.up(db);
        db.prepare('INSERT INTO _migrations (id, name) VALUES (?, ?)').run(migration.id, migration.name);
      })();
      
      console.log(`[DB] Migration ${migration.id} completed`);
    } catch (error) {
      console.error(`[DB] Migration ${migration.id} failed:`, error);
      throw error;
    }
  }
}

/**
 * Get migration status
 */
export function getMigrationStatus(db: Database.Database): { applied: string[]; pending: string[] } {
  const applied = (db.prepare('SELECT id FROM _migrations ORDER BY id').all() as { id: string }[]).map(m => m.id);
  const pending = migrations.filter(m => !applied.includes(m.id)).map(m => m.id);
  return { applied, pending };
}
