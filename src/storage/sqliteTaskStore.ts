import { mkdirSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { Task } from "../types/task.js";
import { TaskStore } from "./taskStore.js";

interface TaskRow {
  id: string;
  title: string;
  created_at: string;
  status: Task["status"];
  objective: string;
  constraints_json: string;
  plan_steps_json: string;
  assigned_agents_json: string;
  approvals_required_json: string;
  artifacts_json: string;
  logs_json: string;
  side_effects_json: string;
  rollback_plan: string;
  stop_conditions_json: string;
}

export class SQLiteTaskStore implements TaskStore {
  private readonly db: Database.Database;

  constructor(dbPath: string) {
    this.ensureParentDir(dbPath);
    this.db = new Database(dbPath);
    this.createSchema();
  }

  save(task: Task): Task {
    this.persist(task);
    return task;
  }

  get(taskId: string): Task | undefined {
    const row = this.db
      .prepare("SELECT * FROM tasks WHERE id = ?")
      .get(taskId) as TaskRow | undefined;
    return row ? this.toTask(row) : undefined;
  }

  list(): Task[] {
    const rows = this.db.prepare("SELECT * FROM tasks ORDER BY created_at DESC").all() as TaskRow[];
    return rows.map((row) => this.toTask(row));
  }

  update(taskId: string, updater: (task: Task) => Task): Task {
    const current = this.get(taskId);
    if (!current) {
      throw new Error(`Task not found: ${taskId}`);
    }
    const next = updater(current);
    this.persist(next);
    return next;
  }

  private createSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        created_at TEXT NOT NULL,
        status TEXT NOT NULL,
        objective TEXT NOT NULL,
        constraints_json TEXT NOT NULL,
        plan_steps_json TEXT NOT NULL,
        assigned_agents_json TEXT NOT NULL,
        approvals_required_json TEXT NOT NULL,
        artifacts_json TEXT NOT NULL,
        logs_json TEXT NOT NULL,
        side_effects_json TEXT NOT NULL,
        rollback_plan TEXT NOT NULL,
        stop_conditions_json TEXT NOT NULL
      )
    `);
  }

  private persist(task: Task): void {
    this.db
      .prepare(
        `
        INSERT INTO tasks (
          id, title, created_at, status, objective,
          constraints_json, plan_steps_json, assigned_agents_json,
          approvals_required_json, artifacts_json, logs_json,
          side_effects_json, rollback_plan, stop_conditions_json
        ) VALUES (
          @id, @title, @created_at, @status, @objective,
          @constraints_json, @plan_steps_json, @assigned_agents_json,
          @approvals_required_json, @artifacts_json, @logs_json,
          @side_effects_json, @rollback_plan, @stop_conditions_json
        )
        ON CONFLICT(id) DO UPDATE SET
          title = excluded.title,
          created_at = excluded.created_at,
          status = excluded.status,
          objective = excluded.objective,
          constraints_json = excluded.constraints_json,
          plan_steps_json = excluded.plan_steps_json,
          assigned_agents_json = excluded.assigned_agents_json,
          approvals_required_json = excluded.approvals_required_json,
          artifacts_json = excluded.artifacts_json,
          logs_json = excluded.logs_json,
          side_effects_json = excluded.side_effects_json,
          rollback_plan = excluded.rollback_plan,
          stop_conditions_json = excluded.stop_conditions_json
        `,
      )
      .run(this.toTaskRow(task));
  }

  private toTaskRow(task: Task): TaskRow {
    return {
      id: task.id,
      title: task.title,
      created_at: task.created_at,
      status: task.status,
      objective: task.objective,
      constraints_json: JSON.stringify(task.constraints),
      plan_steps_json: JSON.stringify(task.plan_steps),
      assigned_agents_json: JSON.stringify(task.assigned_agents),
      approvals_required_json: JSON.stringify(task.approvals_required),
      artifacts_json: JSON.stringify(task.artifacts),
      logs_json: JSON.stringify(task.logs),
      side_effects_json: JSON.stringify(task.side_effects),
      rollback_plan: task.rollback_plan,
      stop_conditions_json: JSON.stringify(task.stop_conditions),
    };
  }

  private toTask(row: TaskRow): Task {
    return {
      id: row.id,
      title: row.title,
      created_at: row.created_at,
      status: row.status,
      objective: row.objective,
      constraints: JSON.parse(row.constraints_json) as Task["constraints"],
      plan_steps: JSON.parse(row.plan_steps_json) as Task["plan_steps"],
      assigned_agents: JSON.parse(row.assigned_agents_json) as Task["assigned_agents"],
      approvals_required: JSON.parse(row.approvals_required_json) as Task["approvals_required"],
      artifacts: JSON.parse(row.artifacts_json) as Task["artifacts"],
      logs: JSON.parse(row.logs_json) as Task["logs"],
      side_effects: JSON.parse(row.side_effects_json) as Task["side_effects"],
      rollback_plan: row.rollback_plan,
      stop_conditions: JSON.parse(row.stop_conditions_json) as Task["stop_conditions"],
    };
  }

  private ensureParentDir(targetPath: string): void {
    const parent = path.dirname(targetPath);
    mkdirSync(parent, { recursive: true });
  }
}
