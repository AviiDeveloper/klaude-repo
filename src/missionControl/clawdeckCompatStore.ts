import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { applyProductionPragmas } from "../lib/sqliteDefaults.js";

type AgentStatus = "standby" | "working" | "offline";
type TaskStatus =
  | "planning"
  | "inbox"
  | "assigned"
  | "in_progress"
  | "testing"
  | "review"
  | "done";
type TaskPriority = "low" | "normal" | "high" | "urgent";

interface WorkspaceRecord {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string;
  created_at: string;
  updated_at: string;
}

interface AgentRecord {
  id: string;
  name: string;
  role: string;
  description: string | null;
  avatar_emoji: string;
  status: AgentStatus;
  is_master: number;
  workspace_id: string;
  soul_md: string | null;
  user_md: string | null;
  agents_md: string | null;
  created_at: string;
  updated_at: string;
}

interface TaskRecord {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assigned_agent_id: string | null;
  created_by_agent_id: string | null;
  workspace_id: string;
  business_id: string;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

interface EventRecord {
  id: string;
  type: string;
  agent_id: string | null;
  task_id: string | null;
  message: string;
  metadata_json: string | null;
  created_at: string;
}

export interface CompatTaskFilter {
  workspace_id?: string;
  status?: string;
  business_id?: string;
  assigned_agent_id?: string;
}

export class ClawdeckCompatStore {
  private readonly db: Database.Database;

  constructor(dbPath: string) {
    this.ensureParentDir(dbPath);
    this.db = new Database(dbPath);
    applyProductionPragmas(this.db);
    this.createSchema();
    this.ensureDefaultWorkspace();
  }

  listWorkspaces(includeStats: boolean): Array<Record<string, unknown>> {
    const workspaces = this.db
      .prepare("SELECT * FROM mc_workspaces ORDER BY name")
      .all() as WorkspaceRecord[];
    if (!includeStats) {
      return workspaces.map((item) => this.toWorkspace(item));
    }

    return workspaces.map((workspace) => {
      const statusRows = this.db
        .prepare(
          `
            SELECT status, COUNT(*) AS count
            FROM mc_tasks
            WHERE workspace_id = ?
            GROUP BY status
          `,
        )
        .all(workspace.id) as Array<{ status: TaskStatus; count: number }>;
      const taskCounts = {
        planning: 0,
        inbox: 0,
        assigned: 0,
        in_progress: 0,
        testing: 0,
        review: 0,
        done: 0,
        total: 0,
      };
      for (const row of statusRows) {
        taskCounts[row.status] = row.count;
        taskCounts.total += row.count;
      }

      const agentCount = this.db
        .prepare("SELECT COUNT(*) AS count FROM mc_agents WHERE workspace_id = ?")
        .get(workspace.id) as { count: number };

      return {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        icon: workspace.icon,
        taskCounts,
        agentCount: agentCount.count,
      };
    });
  }

  getWorkspace(idOrSlug: string): Record<string, unknown> | undefined {
    const row = this.db
      .prepare("SELECT * FROM mc_workspaces WHERE id = ? OR slug = ?")
      .get(idOrSlug, idOrSlug) as WorkspaceRecord | undefined;
    return row ? this.toWorkspace(row) : undefined;
  }

  createWorkspace(input: {
    name: string;
    description?: string;
    icon?: string;
  }): Record<string, unknown> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const slug = this.generateUniqueSlug(input.name);
    this.db
      .prepare(
        `
          INSERT INTO mc_workspaces (
            id, name, slug, description, icon, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        id,
        input.name.trim(),
        slug,
        input.description?.trim() || null,
        input.icon ?? "📁",
        now,
        now,
      );
    return this.getWorkspace(id) as Record<string, unknown>;
  }

  patchWorkspace(
    id: string,
    patch: { name?: string; description?: string; icon?: string },
  ): Record<string, unknown> | undefined {
    const existing = this.db
      .prepare("SELECT * FROM mc_workspaces WHERE id = ?")
      .get(id) as WorkspaceRecord | undefined;
    if (!existing) {
      return undefined;
    }
    const name = patch.name?.trim() || existing.name;
    const slug = patch.name?.trim()
      ? this.generateUniqueSlug(patch.name, id)
      : existing.slug;
    this.db
      .prepare(
        `
          UPDATE mc_workspaces
          SET name = ?, slug = ?, description = ?, icon = ?, updated_at = ?
          WHERE id = ?
        `,
      )
      .run(
        name,
        slug,
        patch.description !== undefined ? patch.description : existing.description,
        patch.icon !== undefined ? patch.icon : existing.icon,
        new Date().toISOString(),
        id,
      );
    return this.getWorkspace(id);
  }

  deleteWorkspace(
    id: string,
  ): { ok: true } | { ok: false; reason: string; taskCount?: number; agentCount?: number } {
    if (id === "default") {
      return { ok: false, reason: "Cannot delete the default workspace" };
    }
    const workspace = this.db
      .prepare("SELECT id FROM mc_workspaces WHERE id = ?")
      .get(id) as { id: string } | undefined;
    if (!workspace) {
      return { ok: false, reason: "Workspace not found" };
    }
    const taskCount = this.db
      .prepare("SELECT COUNT(*) AS count FROM mc_tasks WHERE workspace_id = ?")
      .get(id) as { count: number };
    const agentCount = this.db
      .prepare("SELECT COUNT(*) AS count FROM mc_agents WHERE workspace_id = ?")
      .get(id) as { count: number };
    if (taskCount.count > 0 || agentCount.count > 0) {
      return {
        ok: false,
        reason: "Cannot delete workspace with existing tasks or agents",
        taskCount: taskCount.count,
        agentCount: agentCount.count,
      };
    }
    this.db.prepare("DELETE FROM mc_workspaces WHERE id = ?").run(id);
    return { ok: true };
  }

  listAgents(workspaceId?: string): Array<Record<string, unknown>> {
    const rows = workspaceId
      ? (this.db
          .prepare(
            "SELECT * FROM mc_agents WHERE workspace_id = ? ORDER BY is_master DESC, name ASC",
          )
          .all(workspaceId) as AgentRecord[])
      : (this.db
          .prepare("SELECT * FROM mc_agents ORDER BY is_master DESC, name ASC")
          .all() as AgentRecord[]);
    return rows.map((row) => this.toAgent(row));
  }

  getAgent(id: string): Record<string, unknown> | undefined {
    const row = this.db
      .prepare("SELECT * FROM mc_agents WHERE id = ?")
      .get(id) as AgentRecord | undefined;
    return row ? this.toAgent(row) : undefined;
  }

  createAgent(input: {
    name: string;
    role: string;
    description?: string;
    avatar_emoji?: string;
    is_master?: boolean;
    workspace_id?: string;
    soul_md?: string;
    user_md?: string;
    agents_md?: string;
  }): Record<string, unknown> {
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db
      .prepare(
        `
          INSERT INTO mc_agents (
            id, name, role, description, avatar_emoji, status, is_master,
            workspace_id, soul_md, user_md, agents_md, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        id,
        input.name.trim(),
        input.role.trim(),
        input.description ?? null,
        input.avatar_emoji ?? "🤖",
        "standby",
        input.is_master ? 1 : 0,
        input.workspace_id ?? "default",
        input.soul_md ?? null,
        input.user_md ?? null,
        input.agents_md ?? null,
        now,
        now,
      );
    this.createEvent({
      type: "agent_joined",
      agent_id: id,
      message: `${input.name.trim()} joined the team`,
    });
    return this.getAgent(id) as Record<string, unknown>;
  }

  patchAgent(
    id: string,
    patch: {
      name?: string;
      role?: string;
      description?: string;
      avatar_emoji?: string;
      status?: AgentStatus;
      is_master?: boolean;
      soul_md?: string;
      user_md?: string;
      agents_md?: string;
    },
  ): Record<string, unknown> | undefined {
    const current = this.db
      .prepare("SELECT * FROM mc_agents WHERE id = ?")
      .get(id) as AgentRecord | undefined;
    if (!current) {
      return undefined;
    }
    this.db
      .prepare(
        `
          UPDATE mc_agents
          SET name = ?, role = ?, description = ?, avatar_emoji = ?, status = ?, is_master = ?,
              soul_md = ?, user_md = ?, agents_md = ?, updated_at = ?
          WHERE id = ?
        `,
      )
      .run(
        patch.name?.trim() ?? current.name,
        patch.role?.trim() ?? current.role,
        patch.description !== undefined ? patch.description : current.description,
        patch.avatar_emoji !== undefined ? patch.avatar_emoji : current.avatar_emoji,
        patch.status ?? current.status,
        patch.is_master !== undefined ? (patch.is_master ? 1 : 0) : current.is_master,
        patch.soul_md !== undefined ? patch.soul_md : current.soul_md,
        patch.user_md !== undefined ? patch.user_md : current.user_md,
        patch.agents_md !== undefined ? patch.agents_md : current.agents_md,
        new Date().toISOString(),
        id,
      );
    if (patch.status && patch.status !== current.status) {
      this.createEvent({
        type: "agent_status_changed",
        agent_id: id,
        message: `${current.name} is now ${patch.status}`,
      });
    }
    return this.getAgent(id);
  }

  deleteAgent(id: string): { ok: boolean } {
    const exists = this.db
      .prepare("SELECT id FROM mc_agents WHERE id = ?")
      .get(id) as { id: string } | undefined;
    if (!exists) {
      return { ok: false };
    }
    this.db.prepare("DELETE FROM mc_events WHERE agent_id = ?").run(id);
    this.db.prepare("UPDATE mc_tasks SET assigned_agent_id = NULL WHERE assigned_agent_id = ?").run(id);
    this.db.prepare("UPDATE mc_tasks SET created_by_agent_id = NULL WHERE created_by_agent_id = ?").run(id);
    this.db.prepare("DELETE FROM mc_agents WHERE id = ?").run(id);
    return { ok: true };
  }

  listTasks(filter: CompatTaskFilter): Array<Record<string, unknown>> {
    let sql = "SELECT * FROM mc_tasks WHERE 1=1";
    const params: unknown[] = [];
    if (filter.workspace_id) {
      sql += " AND workspace_id = ?";
      params.push(filter.workspace_id);
    }
    if (filter.business_id) {
      sql += " AND business_id = ?";
      params.push(filter.business_id);
    }
    if (filter.assigned_agent_id) {
      sql += " AND assigned_agent_id = ?";
      params.push(filter.assigned_agent_id);
    }
    if (filter.status) {
      const statuses = filter.status
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      if (statuses.length === 1) {
        sql += " AND status = ?";
        params.push(statuses[0]);
      } else if (statuses.length > 1) {
        sql += ` AND status IN (${statuses.map(() => "?").join(",")})`;
        params.push(...statuses);
      }
    }
    sql += " ORDER BY created_at DESC";
    const rows = this.db.prepare(sql).all(...params) as TaskRecord[];
    return rows.map((row) => this.toTask(row));
  }

  getTask(id: string): Record<string, unknown> | undefined {
    const row = this.db
      .prepare("SELECT * FROM mc_tasks WHERE id = ?")
      .get(id) as TaskRecord | undefined;
    return row ? this.toTask(row) : undefined;
  }

  createTask(input: {
    title: string;
    description?: string;
    status?: TaskStatus;
    priority?: TaskPriority;
    assigned_agent_id?: string | null;
    created_by_agent_id?: string | null;
    workspace_id?: string;
    business_id?: string;
    due_date?: string | null;
  }): Record<string, unknown> {
    const id = `mctask_${randomUUID()}`;
    const now = new Date().toISOString();
    this.db
      .prepare(
        `
          INSERT INTO mc_tasks (
            id, title, description, status, priority, assigned_agent_id,
            created_by_agent_id, workspace_id, business_id, due_date, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        id,
        input.title.trim(),
        input.description ?? null,
        input.status ?? "inbox",
        input.priority ?? "normal",
        input.assigned_agent_id ?? null,
        input.created_by_agent_id ?? null,
        input.workspace_id ?? "default",
        input.business_id ?? "default",
        input.due_date ?? null,
        now,
        now,
      );

    this.createEvent({
      type: "task_created",
      agent_id: input.created_by_agent_id ?? null,
      task_id: id,
      message: `New task: ${input.title.trim()}`,
    });
    return this.getTask(id) as Record<string, unknown>;
  }

  patchTask(
    id: string,
    patch: {
      title?: string;
      description?: string;
      status?: TaskStatus;
      priority?: TaskPriority;
      assigned_agent_id?: string | null;
      due_date?: string | null;
    },
  ): Record<string, unknown> | undefined {
    const current = this.db
      .prepare("SELECT * FROM mc_tasks WHERE id = ?")
      .get(id) as TaskRecord | undefined;
    if (!current) {
      return undefined;
    }
    this.db
      .prepare(
        `
          UPDATE mc_tasks
          SET title = ?, description = ?, status = ?, priority = ?, assigned_agent_id = ?,
              due_date = ?, updated_at = ?
          WHERE id = ?
        `,
      )
      .run(
        patch.title?.trim() ?? current.title,
        patch.description !== undefined ? patch.description : current.description,
        patch.status ?? current.status,
        patch.priority ?? current.priority,
        patch.assigned_agent_id !== undefined ? patch.assigned_agent_id : current.assigned_agent_id,
        patch.due_date !== undefined ? patch.due_date : current.due_date,
        new Date().toISOString(),
        id,
      );

    if (patch.status && patch.status !== current.status) {
      this.createEvent({
        type: patch.status === "done" ? "task_completed" : "task_status_changed",
        task_id: id,
        message: `Task "${current.title}" moved to ${patch.status}`,
      });
    }
    if (patch.assigned_agent_id !== undefined && patch.assigned_agent_id !== current.assigned_agent_id) {
      this.createEvent({
        type: "task_assigned",
        agent_id: patch.assigned_agent_id,
        task_id: id,
        message: `Task "${current.title}" reassigned`,
      });
    }
    return this.getTask(id);
  }

  deleteTask(id: string): { ok: boolean } {
    const exists = this.db
      .prepare("SELECT id FROM mc_tasks WHERE id = ?")
      .get(id) as { id: string } | undefined;
    if (!exists) {
      return { ok: false };
    }
    this.db.prepare("DELETE FROM mc_events WHERE task_id = ?").run(id);
    this.db.prepare("DELETE FROM mc_tasks WHERE id = ?").run(id);
    return { ok: true };
  }

  listEvents(input: { limit: number; since?: string }): Array<Record<string, unknown>> {
    let sql = "SELECT * FROM mc_events WHERE 1=1";
    const params: unknown[] = [];
    if (input.since) {
      sql += " AND created_at > ?";
      params.push(input.since);
    }
    sql += " ORDER BY created_at DESC LIMIT ?";
    params.push(input.limit);
    const rows = this.db.prepare(sql).all(...params) as EventRecord[];
    return rows.map((row) => ({
      id: row.id,
      type: row.type,
      agent_id: row.agent_id,
      task_id: row.task_id,
      message: row.message,
      metadata: row.metadata_json ? JSON.parse(row.metadata_json) : undefined,
      created_at: row.created_at,
    }));
  }

  createEvent(input: {
    type: string;
    agent_id?: string | null;
    task_id?: string | null;
    message: string;
    metadata?: unknown;
  }): Record<string, unknown> {
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    this.db
      .prepare(
        `
          INSERT INTO mc_events (
            id, type, agent_id, task_id, message, metadata_json, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        id,
        input.type,
        input.agent_id ?? null,
        input.task_id ?? null,
        input.message,
        input.metadata ? JSON.stringify(input.metadata) : null,
        createdAt,
      );
    return {
      id,
      type: input.type,
      agent_id: input.agent_id ?? undefined,
      task_id: input.task_id ?? undefined,
      message: input.message,
      metadata: input.metadata,
      created_at: createdAt,
    };
  }

  private toWorkspace(row: WorkspaceRecord): Record<string, unknown> {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description ?? undefined,
      icon: row.icon,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  private toAgent(row: AgentRecord): Record<string, unknown> {
    return {
      id: row.id,
      name: row.name,
      role: row.role,
      description: row.description ?? undefined,
      avatar_emoji: row.avatar_emoji,
      status: row.status,
      is_master: row.is_master === 1,
      workspace_id: row.workspace_id,
      soul_md: row.soul_md ?? undefined,
      user_md: row.user_md ?? undefined,
      agents_md: row.agents_md ?? undefined,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  private toTask(row: TaskRecord): Record<string, unknown> {
    return {
      id: row.id,
      title: row.title,
      description: row.description ?? undefined,
      status: row.status,
      priority: row.priority,
      assigned_agent_id: row.assigned_agent_id ?? undefined,
      created_by_agent_id: row.created_by_agent_id ?? undefined,
      workspace_id: row.workspace_id,
      business_id: row.business_id,
      due_date: row.due_date ?? undefined,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  private ensureDefaultWorkspace(): void {
    const existing = this.db
      .prepare("SELECT id FROM mc_workspaces WHERE id = 'default'")
      .get() as { id: string } | undefined;
    if (existing) {
      return;
    }
    const now = new Date().toISOString();
    this.db
      .prepare(
        `
          INSERT INTO mc_workspaces (
            id, name, slug, description, icon, created_at, updated_at
          ) VALUES ('default', 'Default Workspace', 'default', ?, '🦞', ?, ?)
        `,
      )
      .run("Primary mission control workspace", now, now);
  }

  private generateUniqueSlug(name: string, existingId?: string): string {
    const base = name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "workspace";
    let slug = base;
    let i = 2;
    while (true) {
      const row = this.db
        .prepare("SELECT id FROM mc_workspaces WHERE slug = ?")
        .get(slug) as { id: string } | undefined;
      if (!row || row.id === existingId) {
        return slug;
      }
      slug = `${base}-${i}`;
      i += 1;
    }
  }

  private createSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS mc_workspaces (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        description TEXT,
        icon TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS mc_agents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        description TEXT,
        avatar_emoji TEXT NOT NULL,
        status TEXT NOT NULL,
        is_master INTEGER NOT NULL DEFAULT 0,
        workspace_id TEXT NOT NULL,
        soul_md TEXT,
        user_md TEXT,
        agents_md TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS mc_tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL,
        priority TEXT NOT NULL,
        assigned_agent_id TEXT,
        created_by_agent_id TEXT,
        workspace_id TEXT NOT NULL,
        business_id TEXT NOT NULL,
        due_date TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS mc_events (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        agent_id TEXT,
        task_id TEXT,
        message TEXT NOT NULL,
        metadata_json TEXT,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_mc_agents_workspace ON mc_agents (workspace_id);
      CREATE INDEX IF NOT EXISTS idx_mc_tasks_workspace ON mc_tasks (workspace_id);
      CREATE INDEX IF NOT EXISTS idx_mc_tasks_status ON mc_tasks (status);
      CREATE INDEX IF NOT EXISTS idx_mc_events_created_at ON mc_events (created_at DESC);
    `);
  }

  private ensureParentDir(targetPath: string): void {
    const parent = path.dirname(targetPath);
    mkdirSync(parent, { recursive: true });
  }
}
