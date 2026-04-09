import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { applyProductionPragmas } from "../lib/sqliteDefaults.js";
import {
  AgentTaskArtifact,
  AgentTaskRecord,
  MediaJobRecord,
  PipelineDefinition,
  PipelineNodeDefinition,
  PipelineNodeRun,
  PipelineRun,
  PipelineRunStatus,
  PostQueueRecord,
  SourceRegistryRecord,
  SpendLedgerRecord,
} from "./types.js";

interface DefinitionRow {
  id: string;
  name: string;
  enabled: number;
  schedule_rrule: string;
  max_retries: number;
  nodes_json: string;
  config_json: string;
  next_run_at: string | null;
  created_at: string;
  updated_at: string;
}

interface RunRow {
  id: string;
  pipeline_definition_id: string;
  trigger: PipelineRun["trigger"];
  status: PipelineRunStatus;
  started_at: string;
  ended_at: string | null;
  error_message: string | null;
  approval_token: string | null;
}

interface NodeRunRow {
  run_id: string;
  node_id: string;
  agent_id: PipelineNodeRun["agent_id"];
  status: PipelineNodeRun["status"];
  attempts: number;
  depends_on_json: string;
  config_json: string;
  paid_action: number;
  last_error: string | null;
  started_at: string | null;
  ended_at: string | null;
}

export class SQLitePipelineStore {
  private readonly db: Database.Database;

  constructor(dbPath: string) {
    this.ensureParentDir(dbPath);
    this.db = new Database(dbPath);
    applyProductionPragmas(this.db);
    this.createSchema();
  }

  close(): void {
    this.db.close();
  }

  upsertDefinition(input: {
    id?: string;
    name: string;
    enabled?: boolean;
    schedule_rrule?: string;
    max_retries?: number;
    nodes: PipelineNodeDefinition[];
    config?: Record<string, unknown>;
  }): PipelineDefinition {
    const now = new Date().toISOString();
    const id = input.id ?? randomUUID();
    const existing = this.getDefinition(id);
    const enabled = input.enabled ?? existing?.enabled ?? true;
    const schedule = input.schedule_rrule ?? existing?.schedule_rrule ?? "FREQ=HOURLY;INTERVAL=1";
    const maxRetries = input.max_retries ?? existing?.max_retries ?? 1;
    const nextRunAt =
      existing?.next_run_at ??
      this.computeNextRunAt(schedule, now);

    this.db
      .prepare(
        `
        INSERT INTO pipeline_definitions (
          id, name, enabled, schedule_rrule, max_retries, nodes_json, config_json,
          next_run_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          enabled = excluded.enabled,
          schedule_rrule = excluded.schedule_rrule,
          max_retries = excluded.max_retries,
          nodes_json = excluded.nodes_json,
          config_json = excluded.config_json,
          next_run_at = excluded.next_run_at,
          updated_at = excluded.updated_at
        `,
      )
      .run(
        id,
        input.name,
        enabled ? 1 : 0,
        schedule,
        maxRetries,
        JSON.stringify(input.nodes),
        JSON.stringify(input.config ?? {}),
        nextRunAt,
        existing?.created_at ?? now,
        now,
      );
    const saved = this.getDefinition(id);
    if (!saved) {
      throw new Error(`pipeline definition not found after save: ${id}`);
    }
    return saved;
  }

  patchDefinition(
    id: string,
    patch: Partial<
      Pick<
        PipelineDefinition,
        "name" | "enabled" | "schedule_rrule" | "max_retries" | "nodes" | "config"
      >
    >,
  ): PipelineDefinition {
    const current = this.getDefinition(id);
    if (!current) {
      throw new Error(`pipeline definition not found: ${id}`);
    }
    return this.upsertDefinition({
      id,
      name: patch.name ?? current.name,
      enabled: patch.enabled ?? current.enabled,
      schedule_rrule: patch.schedule_rrule ?? current.schedule_rrule,
      max_retries: patch.max_retries ?? current.max_retries,
      nodes: patch.nodes ?? current.nodes,
      config: patch.config ?? current.config,
    });
  }

  getDefinition(id: string): PipelineDefinition | undefined {
    const row = this.db
      .prepare("SELECT * FROM pipeline_definitions WHERE id = ?")
      .get(id) as DefinitionRow | undefined;
    return row ? this.toDefinition(row) : undefined;
  }

  listDefinitions(): PipelineDefinition[] {
    const rows = this.db
      .prepare("SELECT * FROM pipeline_definitions ORDER BY updated_at DESC")
      .all() as DefinitionRow[];
    return rows.map((row) => this.toDefinition(row));
  }

  listDueDefinitions(atIso: string): PipelineDefinition[] {
    const rows = this.db
      .prepare(
        "SELECT * FROM pipeline_definitions WHERE enabled = 1 AND next_run_at IS NOT NULL AND next_run_at <= ? ORDER BY next_run_at ASC",
      )
      .all(atIso) as DefinitionRow[];
    return rows.map((row) => this.toDefinition(row));
  }

  bumpNextRunAt(definitionId: string, atIso: string): void {
    const current = this.getDefinition(definitionId);
    if (!current) {
      return;
    }
    const next = this.computeNextRunAt(current.schedule_rrule, atIso);
    this.db
      .prepare("UPDATE pipeline_definitions SET next_run_at = ?, updated_at = ? WHERE id = ?")
      .run(next, new Date().toISOString(), definitionId);
  }

  createRun(input: {
    definition: PipelineDefinition;
    trigger: PipelineRun["trigger"];
    approval_token?: string;
  }): PipelineRun {
    const now = new Date().toISOString();
    const runId = randomUUID();
    this.db
      .prepare(
        `
        INSERT INTO pipeline_runs (
          id, pipeline_definition_id, trigger, status, started_at, approval_token
        ) VALUES (?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        runId,
        input.definition.id,
        input.trigger,
        "pending",
        now,
        input.approval_token ?? null,
      );
    for (const node of input.definition.nodes) {
      this.db
        .prepare(
          `
          INSERT INTO pipeline_nodes (
            run_id, node_id, agent_id, status, attempts, depends_on_json, config_json, paid_action
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `,
        )
        .run(
          runId,
          node.id,
          node.agent_id,
          "pending",
          0,
          JSON.stringify(node.depends_on),
          JSON.stringify(node.config ?? {}),
          node.paid_action ? 1 : 0,
        );
    }
    const created = this.getRun(runId);
    if (!created) {
      throw new Error(`pipeline run not found after create: ${runId}`);
    }
    return created;
  }

  getRun(runId: string): PipelineRun | undefined {
    const row = this.db
      .prepare("SELECT * FROM pipeline_runs WHERE id = ?")
      .get(runId) as RunRow | undefined;
    return row ? this.toRun(row) : undefined;
  }

  listRuns(limit = 50): PipelineRun[] {
    const rows = this.db
      .prepare("SELECT * FROM pipeline_runs ORDER BY started_at DESC LIMIT ?")
      .all(limit) as RunRow[];
    return rows.map((row) => this.toRun(row));
  }

  listNodeRuns(runId: string): PipelineNodeRun[] {
    const rows = this.db
      .prepare(
        "SELECT * FROM pipeline_nodes WHERE run_id = ? ORDER BY rowid ASC",
      )
      .all(runId) as NodeRunRow[];
    return rows.map((row) => this.toNodeRun(row));
  }

  getNodeRun(runId: string, nodeId: string): PipelineNodeRun | undefined {
    const row = this.db
      .prepare("SELECT * FROM pipeline_nodes WHERE run_id = ? AND node_id = ?")
      .get(runId, nodeId) as NodeRunRow | undefined;
    return row ? this.toNodeRun(row) : undefined;
  }

  setRunStatus(runId: string, status: PipelineRunStatus, errorMessage?: string): void {
    const endAt = status === "running" || status === "pending" ? null : new Date().toISOString();
    this.db
      .prepare(
        "UPDATE pipeline_runs SET status = ?, ended_at = ?, error_message = COALESCE(?, error_message) WHERE id = ?",
      )
      .run(status, endAt, errorMessage ?? null, runId);
  }

  setNodeStatus(input: {
    runId: string;
    nodeId: string;
    status: PipelineNodeRun["status"];
    attempts?: number;
    error?: string;
    started?: boolean;
    ended?: boolean;
  }): void {
    const current = this.getNodeRun(input.runId, input.nodeId);
    if (!current) {
      throw new Error(`pipeline node not found: ${input.runId}/${input.nodeId}`);
    }
    this.db
      .prepare(
        `
        UPDATE pipeline_nodes
        SET status = ?,
            attempts = ?,
            last_error = ?,
            started_at = ?,
            ended_at = ?
        WHERE run_id = ? AND node_id = ?
        `,
      )
      .run(
        input.status,
        input.attempts ?? current.attempts,
        input.error ?? null,
        input.started ? new Date().toISOString() : current.started_at ?? null,
        input.ended ? new Date().toISOString() : current.ended_at ?? null,
        input.runId,
        input.nodeId,
      );
  }

  listRunnableNodes(runId: string): PipelineNodeRun[] {
    const nodes = this.listNodeRuns(runId);
    const byId = new Map(nodes.map((node) => [node.node_id, node]));
    return nodes.filter((node) => {
      if (node.status !== "pending") {
        return false;
      }
      return node.depends_on.every((dep) => byId.get(dep)?.status === "completed");
    });
  }

  blockDependents(runId: string, failedNodeId: string, message: string): void {
    const nodes = this.listNodeRuns(runId);
    const dependents = nodes.filter(
      (node) => node.depends_on.includes(failedNodeId) && node.status === "pending",
    );
    for (const node of dependents) {
      this.setNodeStatus({
        runId,
        nodeId: node.node_id,
        status: "blocked",
        error: `blocked by ${failedNodeId}: ${message}`,
      });
      this.blockDependents(runId, node.node_id, message);
    }
  }

  recomputeBlockedNodes(runId: string): void {
    const nodes = this.listNodeRuns(runId);
    const byId = new Map(nodes.map((node) => [node.node_id, node]));
    for (const node of nodes) {
      if (node.status !== "blocked") {
        continue;
      }
      const hasFailedDependency = node.depends_on.some((dep) => {
        const depNode = byId.get(dep);
        return depNode?.status === "failed" || depNode?.status === "blocked";
      });
      if (!hasFailedDependency) {
        this.setNodeStatus({
          runId,
          nodeId: node.node_id,
          status: "pending",
          error: undefined,
        });
      }
    }
  }

  appendAgentTask(
    input: Omit<AgentTaskRecord, "id" | "created_at">,
  ): AgentTaskRecord {
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    this.db
      .prepare(
        `
        INSERT INTO agent_task_queue (
          id, run_id, node_id, agent_id, status, created_at, started_at, completed_at,
          input_json, output_json, error_message
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        id,
        input.run_id,
        input.node_id,
        input.agent_id,
        input.status,
        createdAt,
        input.started_at ?? null,
        input.completed_at ?? null,
        JSON.stringify(input.input_json),
        JSON.stringify(input.output_json ?? {}),
        input.error_message ?? null,
      );
    return {
      ...input,
      id,
      created_at: createdAt,
    };
  }

  appendArtifact(
    input: Omit<AgentTaskArtifact, "id" | "created_at">,
  ): AgentTaskArtifact {
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    this.db
      .prepare(
        `
        INSERT INTO agent_task_artifacts (
          id, run_id, node_id, kind, value_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        id,
        input.run_id,
        input.node_id,
        input.kind,
        JSON.stringify(input.value_json),
        createdAt,
      );
    return {
      ...input,
      id,
      created_at: createdAt,
    };
  }

  listArtifacts(runId: string): AgentTaskArtifact[] {
    const rows = this.db
      .prepare("SELECT * FROM agent_task_artifacts WHERE run_id = ? ORDER BY created_at ASC")
      .all(runId) as Array<{
      id: string;
      run_id: string;
      node_id: string;
      kind: string;
      value_json: string;
      created_at: string;
    }>;
    return rows.map((row) => ({
      id: row.id,
      run_id: row.run_id,
      node_id: row.node_id,
      kind: row.kind,
      value_json: JSON.parse(row.value_json) as Record<string, unknown>,
      created_at: row.created_at,
    }));
  }

  createMediaJob(
    input: Omit<MediaJobRecord, "id" | "created_at" | "updated_at">,
  ): MediaJobRecord {
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db
      .prepare(
        `
        INSERT INTO media_jobs (
          id, run_id, node_id, provider, status, input_json, output_json, cost_usd,
          approved_by_token, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        id,
        input.run_id,
        input.node_id,
        input.provider,
        input.status,
        JSON.stringify(input.input_json),
        JSON.stringify(input.output_json ?? {}),
        input.cost_usd ?? null,
        input.approved_by_token ?? null,
        now,
        now,
      );
    return {
      ...input,
      id,
      created_at: now,
      updated_at: now,
    };
  }

  enqueuePost(
    input: Omit<PostQueueRecord, "id" | "created_at" | "updated_at" | "attempts">,
  ): PostQueueRecord {
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db
      .prepare(
        `
        INSERT INTO post_queue (
          id, run_id, platform, status, payload_json, attempts, approved_by, dispatched_at,
          last_error, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        id,
        input.run_id,
        input.platform,
        input.status,
        JSON.stringify(input.payload_json),
        0,
        input.approved_by ?? null,
        input.dispatched_at ?? null,
        input.last_error ?? null,
        now,
        now,
      );
    return {
      ...input,
      id,
      attempts: 0,
      created_at: now,
      updated_at: now,
    };
  }

  listPostQueue(limit = 100): PostQueueRecord[] {
    const rows = this.db
      .prepare("SELECT * FROM post_queue ORDER BY created_at DESC LIMIT ?")
      .all(limit) as Array<{
      id: string;
      run_id: string;
      platform: PostQueueRecord["platform"];
      status: PostQueueRecord["status"];
      payload_json: string;
      attempts: number;
      approved_by: string | null;
      dispatched_at: string | null;
      last_error: string | null;
      created_at: string;
      updated_at: string;
    }>;
    return rows.map((row) => ({
      id: row.id,
      run_id: row.run_id,
      platform: row.platform,
      status: row.status,
      payload_json: JSON.parse(row.payload_json) as Record<string, unknown>,
      attempts: row.attempts,
      approved_by: row.approved_by ?? undefined,
      dispatched_at: row.dispatched_at ?? undefined,
      last_error: row.last_error ?? undefined,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
  }

  patchPostQueue(
    id: string,
    patch: Partial<
      Pick<PostQueueRecord, "status" | "approved_by" | "dispatched_at" | "last_error" | "attempts">
    >,
  ): PostQueueRecord | undefined {
    const current = this.db
      .prepare("SELECT * FROM post_queue WHERE id = ?")
      .get(id) as
      | {
          id: string;
          run_id: string;
          platform: PostQueueRecord["platform"];
          status: PostQueueRecord["status"];
          payload_json: string;
          attempts: number;
          approved_by: string | null;
          dispatched_at: string | null;
          last_error: string | null;
          created_at: string;
          updated_at: string;
        }
      | undefined;
    if (!current) {
      return undefined;
    }
    const updatedAt = new Date().toISOString();
    this.db
      .prepare(
        `
        UPDATE post_queue
        SET status = ?, attempts = ?, approved_by = ?, dispatched_at = ?, last_error = ?, updated_at = ?
        WHERE id = ?
        `,
      )
      .run(
        patch.status ?? current.status,
        patch.attempts ?? current.attempts,
        patch.approved_by ?? current.approved_by,
        patch.dispatched_at ?? current.dispatched_at,
        patch.last_error ?? current.last_error,
        updatedAt,
        id,
      );
    return this.listPostQueue(1000).find((item) => item.id === id);
  }

  appendSpendLedger(input: Omit<SpendLedgerRecord, "id">): SpendLedgerRecord {
    const id = randomUUID();
    this.db
      .prepare(
        `
        INSERT INTO spend_ledger (id, timestamp, scope, reference_id, provider, amount_usd)
        VALUES (?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        id,
        input.timestamp,
        input.scope,
        input.reference_id,
        input.provider,
        input.amount_usd,
      );
    return { ...input, id };
  }

  dailySpendUsd(dayIso: string): number {
    const prefix = dayIso.slice(0, 10);
    const row = this.db
      .prepare(
        "SELECT COALESCE(SUM(amount_usd), 0) AS total FROM spend_ledger WHERE timestamp LIKE ?",
      )
      .get(`${prefix}%`) as { total: number };
    return Number(row.total ?? 0);
  }

  taskSpendUsd(referenceId: string): number {
    const row = this.db
      .prepare(
        "SELECT COALESCE(SUM(amount_usd), 0) AS total FROM spend_ledger WHERE reference_id = ?",
      )
      .get(referenceId) as { total: number };
    return Number(row.total ?? 0);
  }

  upsertSource(record: SourceRegistryRecord): SourceRegistryRecord {
    this.db
      .prepare(
        `
        INSERT INTO source_registry (
          id, name, source_type, enabled, config_json, last_success_at, last_error
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          source_type = excluded.source_type,
          enabled = excluded.enabled,
          config_json = excluded.config_json,
          last_success_at = excluded.last_success_at,
          last_error = excluded.last_error
        `,
      )
      .run(
        record.id,
        record.name,
        record.source_type,
        record.enabled ? 1 : 0,
        JSON.stringify(record.config_json),
        record.last_success_at ?? null,
        record.last_error ?? null,
      );
    return record;
  }

  listSources(): SourceRegistryRecord[] {
    const rows = this.db
      .prepare("SELECT * FROM source_registry ORDER BY name ASC")
      .all() as Array<{
      id: string;
      name: string;
      source_type: "rss" | "api";
      enabled: number;
      config_json: string;
      last_success_at: string | null;
      last_error: string | null;
    }>;
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      source_type: row.source_type,
      enabled: row.enabled === 1,
      config_json: JSON.parse(row.config_json) as Record<string, unknown>,
      last_success_at: row.last_success_at ?? undefined,
      last_error: row.last_error ?? undefined,
    }));
  }

  private computeNextRunAt(scheduleRrule: string, fromIso: string): string {
    const intervalMatch = scheduleRrule.match(/INTERVAL=(\d+)/);
    const intervalHours = Math.max(1, Number(intervalMatch?.[1] ?? "1"));
    return new Date(new Date(fromIso).getTime() + intervalHours * 60 * 60 * 1000).toISOString();
  }

  private toDefinition(row: DefinitionRow): PipelineDefinition {
    return {
      id: row.id,
      name: row.name,
      enabled: row.enabled === 1,
      schedule_rrule: row.schedule_rrule,
      max_retries: row.max_retries,
      nodes: JSON.parse(row.nodes_json) as PipelineNodeDefinition[],
      config: JSON.parse(row.config_json) as Record<string, unknown>,
      next_run_at: row.next_run_at ?? undefined,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  private toRun(row: RunRow): PipelineRun {
    return {
      id: row.id,
      pipeline_definition_id: row.pipeline_definition_id,
      trigger: row.trigger,
      status: row.status,
      started_at: row.started_at,
      ended_at: row.ended_at ?? undefined,
      error_message: row.error_message ?? undefined,
      approval_token: row.approval_token ?? undefined,
    };
  }

  private toNodeRun(row: NodeRunRow): PipelineNodeRun {
    return {
      run_id: row.run_id,
      node_id: row.node_id,
      agent_id: row.agent_id,
      status: row.status,
      attempts: row.attempts,
      depends_on: JSON.parse(row.depends_on_json) as string[],
      config: JSON.parse(row.config_json) as Record<string, unknown>,
      paid_action: row.paid_action === 1,
      last_error: row.last_error ?? undefined,
      started_at: row.started_at ?? undefined,
      ended_at: row.ended_at ?? undefined,
    };
  }

  private createSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS pipeline_definitions (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        enabled INTEGER NOT NULL,
        schedule_rrule TEXT NOT NULL,
        max_retries INTEGER NOT NULL,
        nodes_json TEXT NOT NULL,
        config_json TEXT NOT NULL,
        next_run_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS pipeline_runs (
        id TEXT PRIMARY KEY,
        pipeline_definition_id TEXT NOT NULL,
        trigger TEXT NOT NULL,
        status TEXT NOT NULL,
        started_at TEXT NOT NULL,
        ended_at TEXT,
        error_message TEXT,
        approval_token TEXT,
        FOREIGN KEY(pipeline_definition_id) REFERENCES pipeline_definitions(id)
      );

      CREATE TABLE IF NOT EXISTS pipeline_nodes (
        run_id TEXT NOT NULL,
        node_id TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        status TEXT NOT NULL,
        attempts INTEGER NOT NULL,
        depends_on_json TEXT NOT NULL,
        config_json TEXT NOT NULL,
        paid_action INTEGER NOT NULL,
        last_error TEXT,
        started_at TEXT,
        ended_at TEXT,
        PRIMARY KEY(run_id, node_id),
        FOREIGN KEY(run_id) REFERENCES pipeline_runs(id)
      );

      CREATE TABLE IF NOT EXISTS agent_task_queue (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        node_id TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        started_at TEXT,
        completed_at TEXT,
        input_json TEXT NOT NULL,
        output_json TEXT NOT NULL,
        error_message TEXT
      );

      CREATE TABLE IF NOT EXISTS agent_task_artifacts (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        node_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        value_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS post_queue (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        platform TEXT NOT NULL,
        status TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        attempts INTEGER NOT NULL,
        approved_by TEXT,
        dispatched_at TEXT,
        last_error TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS media_jobs (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        node_id TEXT NOT NULL,
        provider TEXT NOT NULL,
        status TEXT NOT NULL,
        input_json TEXT NOT NULL,
        output_json TEXT NOT NULL,
        cost_usd REAL,
        approved_by_token TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS spend_ledger (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        scope TEXT NOT NULL,
        reference_id TEXT NOT NULL,
        provider TEXT NOT NULL,
        amount_usd REAL NOT NULL
      );

      CREATE TABLE IF NOT EXISTS source_registry (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        source_type TEXT NOT NULL,
        enabled INTEGER NOT NULL,
        config_json TEXT NOT NULL,
        last_success_at TEXT,
        last_error TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_pipeline_definitions_next_run
      ON pipeline_definitions(enabled, next_run_at);

      CREATE INDEX IF NOT EXISTS idx_pipeline_runs_started
      ON pipeline_runs(started_at DESC);
    `);
  }

  private ensureParentDir(targetPath: string): void {
    const parent = path.dirname(targetPath);
    mkdirSync(parent, { recursive: true });
  }
}
