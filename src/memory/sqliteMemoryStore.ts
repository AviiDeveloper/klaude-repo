/**
 * SQLite-backed memory store with FTS5 full-text search.
 *
 * Implements the MSA-inspired tiered storage pattern:
 * - Hot tier: routing keys + tags in indexed columns (always fast to query)
 * - Cold tier: full_content in TEXT blobs (loaded only for top-k results)
 *
 * The FTS5 virtual table provides BM25 ranking natively in SQLite's C engine,
 * which is faster than doing BM25 in JavaScript.
 */

import { mkdirSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import type {
  MemoryDocument,
  MemoryRetrievalLog,
  MemorySourceType,
  MemoryTags,
  MemoryTier,
} from "./types.js";

interface MemoryDocRow {
  id: string;
  workspace_id: string;
  agent_id: string | null;
  source_type: string;
  source_id: string | null;
  routing_keys_json: string;
  tags_json: string;
  tier: string;
  compressed_content: string | null;
  full_content: string | null;
  access_count: number;
  last_accessed_at: string | null;
  relevance_decay: number;
  created_at: string;
  updated_at: string;
}

export interface MemoryStoreOptions {
  dbPath: string;
}

export class SQLiteMemoryStore {
  private readonly db: Database.Database;

  constructor(options: MemoryStoreOptions) {
    const parent = path.dirname(options.dbPath);
    mkdirSync(parent, { recursive: true });
    this.db = new Database(options.dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.createSchema();
  }

  // ─── Write ───

  insert(doc: Omit<MemoryDocument, "access_count" | "last_accessed_at" | "updated_at">): void {
    const now = new Date().toISOString();

    this.db
      .prepare(
        `INSERT INTO memory_documents (
          id, workspace_id, agent_id, source_type, source_id,
          routing_keys_json, tags_json, tier, compressed_content, full_content,
          access_count, last_accessed_at, relevance_decay, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, ?, ?, ?)`,
      )
      .run(
        doc.id,
        doc.workspace_id,
        doc.agent_id || null,
        doc.source_type,
        doc.source_id || null,
        JSON.stringify(doc.routing_keys),
        JSON.stringify(doc.tags),
        doc.tier,
        doc.compressed_content,
        doc.full_content || null,
        doc.relevance_decay,
        doc.created_at,
        now,
      );

    // Insert into FTS5 index
    this.db
      .prepare("INSERT INTO memory_fts (rowid, routing_text, compressed_text) VALUES ((SELECT rowid FROM memory_documents WHERE id = ?), ?, ?)")
      .run(doc.id, doc.routing_keys.join(" "), doc.compressed_content);

    // Update IDF table
    this.updateIdf(doc.routing_keys);
  }

  // ─── Read: Three-Stage Query Pipeline ───

  /**
   * Stage 1: Tag pre-filter. Returns candidate doc IDs matching tag criteria.
   * Caps at maxCandidates to keep BM25 scoring fast.
   */
  tagPreFilter(params: {
    workspace_id: string;
    agent_id?: string;
    source_type?: MemorySourceType;
    task_type?: string;
    outcome?: string;
    tiers?: MemoryTier[];
    maxCandidates?: number;
  }): Array<{ id: string; routing_keys: string[]; relevance_decay: number }> {
    const conditions: string[] = ["workspace_id = ?"];
    const args: unknown[] = [params.workspace_id];

    if (params.agent_id) {
      conditions.push("agent_id = ?");
      args.push(params.agent_id);
    }
    if (params.source_type) {
      conditions.push("source_type = ?");
      args.push(params.source_type);
    }
    if (params.task_type) {
      conditions.push("json_extract(tags_json, '$.task_type') = ?");
      args.push(params.task_type);
    }
    if (params.outcome) {
      conditions.push("json_extract(tags_json, '$.outcome') = ?");
      args.push(params.outcome);
    }
    if (params.tiers && params.tiers.length > 0) {
      const placeholders = params.tiers.map(() => "?").join(", ");
      conditions.push(`tier IN (${placeholders})`);
      args.push(...params.tiers);
    }

    const limit = params.maxCandidates || 200;
    args.push(limit);

    const rows = this.db
      .prepare(
        `SELECT id, routing_keys_json, relevance_decay
         FROM memory_documents
         WHERE ${conditions.join(" AND ")}
         ORDER BY created_at DESC
         LIMIT ?`,
      )
      .all(...args) as Array<{ id: string; routing_keys_json: string; relevance_decay: number }>;

    return rows.map((row) => ({
      id: row.id,
      routing_keys: JSON.parse(row.routing_keys_json) as string[],
      relevance_decay: row.relevance_decay,
    }));
  }

  /**
   * Stage 2 alternative: Use FTS5's built-in BM25 ranking.
   * This runs inside SQLite's C engine — faster than JS BM25.
   */
  ftsSearch(params: {
    query: string;
    workspace_id: string;
    agent_id?: string;
    tiers?: MemoryTier[];
    topK?: number;
  }): Array<{ id: string; score: number }> {
    const topK = params.topK || 5;
    const conditions: string[] = ["d.workspace_id = ?"];
    const args: unknown[] = [params.workspace_id];

    if (params.agent_id) {
      conditions.push("d.agent_id = ?");
      args.push(params.agent_id);
    }
    if (params.tiers && params.tiers.length > 0) {
      const placeholders = params.tiers.map(() => "?").join(", ");
      conditions.push(`d.tier IN (${placeholders})`);
      args.push(...params.tiers);
    }

    // FTS5 match query — bm25() returns negative scores (lower = better match)
    const rows = this.db
      .prepare(
        `SELECT d.id, (-1 * bm25(memory_fts, 1.0, 0.5)) * d.relevance_decay AS score
         FROM memory_fts f
         JOIN memory_documents d ON d.rowid = f.rowid
         WHERE memory_fts MATCH ?
         AND ${conditions.join(" AND ")}
         ORDER BY score DESC
         LIMIT ?`,
      )
      .all(params.query, ...args, topK) as Array<{ id: string; score: number }>;

    return rows;
  }

  /**
   * Stage 3: Load full content for selected document IDs.
   * Also increments access_count and updates last_accessed_at.
   */
  loadDocuments(ids: string[]): MemoryDocument[] {
    if (ids.length === 0) return [];

    const now = new Date().toISOString();
    const placeholders = ids.map(() => "?").join(", ");

    // Update access stats
    this.db
      .prepare(
        `UPDATE memory_documents
         SET access_count = access_count + 1, last_accessed_at = ?
         WHERE id IN (${placeholders})`,
      )
      .run(now, ...ids);

    const rows = this.db
      .prepare(`SELECT * FROM memory_documents WHERE id IN (${placeholders})`)
      .all(...ids) as MemoryDocRow[];

    return rows.map(this.rowToDocument);
  }

  // ─── Compression ───

  updateTier(id: string, tier: MemoryTier, compressedContent?: string): void {
    if (tier === "archived") {
      this.db
        .prepare(
          "UPDATE memory_documents SET tier = ?, full_content = NULL, updated_at = ? WHERE id = ?",
        )
        .run(tier, new Date().toISOString(), id);
    } else if (tier === "compressed" && compressedContent) {
      this.db
        .prepare(
          "UPDATE memory_documents SET tier = ?, compressed_content = ?, full_content = NULL, updated_at = ? WHERE id = ?",
        )
        .run(tier, compressedContent, new Date().toISOString(), id);
    } else {
      this.db
        .prepare("UPDATE memory_documents SET tier = ?, updated_at = ? WHERE id = ?")
        .run(tier, new Date().toISOString(), id);
    }
  }

  getDocumentsForCompression(params: {
    olderThan: string;
    currentTier: MemoryTier;
  }): MemoryDocument[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM memory_documents
         WHERE tier = ? AND created_at < ?
         ORDER BY created_at ASC
         LIMIT 100`,
      )
      .all(params.currentTier, params.olderThan) as MemoryDocRow[];

    return rows.map(this.rowToDocument);
  }

  // ─── IDF / Stats ───

  getIdf(term: string): number {
    const row = this.db
      .prepare("SELECT doc_frequency FROM memory_idf WHERE term = ?")
      .get(term) as { doc_frequency: number } | undefined;
    return row?.doc_frequency || 0;
  }

  getTotalDocCount(): number {
    const row = this.db
      .prepare("SELECT COUNT(*) as count FROM memory_documents")
      .get() as { count: number };
    return row.count;
  }

  getAvgRoutingKeyLength(): number {
    const row = this.db
      .prepare(
        "SELECT AVG(json_array_length(routing_keys_json)) as avg_len FROM memory_documents",
      )
      .get() as { avg_len: number | null };
    return row.avg_len || 10;
  }

  getStats(): {
    total_documents: number;
    by_tier: Record<MemoryTier, number>;
    by_source: Record<string, number>;
    idf_terms: number;
    total_retrievals: number;
  } {
    const total = this.getTotalDocCount();

    const tierRows = this.db
      .prepare("SELECT tier, COUNT(*) as count FROM memory_documents GROUP BY tier")
      .all() as Array<{ tier: string; count: number }>;
    const by_tier = { detailed: 0, compressed: 0, archived: 0 } as Record<MemoryTier, number>;
    for (const row of tierRows) {
      by_tier[row.tier as MemoryTier] = row.count;
    }

    const sourceRows = this.db
      .prepare("SELECT source_type, COUNT(*) as count FROM memory_documents GROUP BY source_type")
      .all() as Array<{ source_type: string; count: number }>;
    const by_source: Record<string, number> = {};
    for (const row of sourceRows) {
      by_source[row.source_type] = row.count;
    }

    const idfCount = (
      this.db.prepare("SELECT COUNT(*) as count FROM memory_idf").get() as { count: number }
    ).count;

    const retrievalCount = (
      this.db.prepare("SELECT COUNT(*) as count FROM memory_retrievals").get() as { count: number }
    ).count;

    return {
      total_documents: total,
      by_tier,
      by_source,
      idf_terms: idfCount,
      total_retrievals: retrievalCount,
    };
  }

  // ─── Retrieval Logging ───

  logRetrieval(log: MemoryRetrievalLog): void {
    this.db
      .prepare(
        `INSERT INTO memory_retrievals (
          id, query_text, query_tags_json, workspace_id, agent_id,
          retrieved_doc_ids_json, scores_json, hop_number, latency_ms, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        log.id,
        log.query_text,
        log.query_tags ? JSON.stringify(log.query_tags) : null,
        log.workspace_id,
        log.agent_id || null,
        JSON.stringify(log.retrieved_doc_ids),
        JSON.stringify(log.scores),
        log.hop_number,
        log.latency_ms,
        log.created_at,
      );
  }

  // ─── Monitor State (for MSA weight watcher) ───

  getMonitorState(key: string): string | null {
    const row = this.db
      .prepare("SELECT state_json FROM monitor_state WHERE key = ?")
      .get(key) as { state_json: string } | undefined;
    return row?.state_json || null;
  }

  setMonitorState(key: string, stateJson: string): void {
    this.db
      .prepare(
        `INSERT INTO monitor_state (key, state_json, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET state_json = excluded.state_json, updated_at = excluded.updated_at`,
      )
      .run(key, stateJson, new Date().toISOString());
  }

  // ─── Private ───

  private updateIdf(terms: string[]): void {
    const unique = [...new Set(terms)];
    const now = new Date().toISOString();
    const upsert = this.db.prepare(
      `INSERT INTO memory_idf (term, doc_frequency, updated_at)
       VALUES (?, 1, ?)
       ON CONFLICT(term) DO UPDATE SET doc_frequency = doc_frequency + 1, updated_at = excluded.updated_at`,
    );

    const tx = this.db.transaction(() => {
      for (const term of unique) {
        upsert.run(term, now);
      }
    });
    tx();
  }

  private rowToDocument(row: MemoryDocRow): MemoryDocument {
    return {
      id: row.id,
      workspace_id: row.workspace_id,
      agent_id: row.agent_id || undefined,
      source_type: row.source_type as MemorySourceType,
      source_id: row.source_id || undefined,
      routing_keys: JSON.parse(row.routing_keys_json),
      tags: JSON.parse(row.tags_json) as MemoryTags,
      tier: row.tier as MemoryTier,
      compressed_content: row.compressed_content || "",
      full_content: row.full_content || undefined,
      access_count: row.access_count,
      last_accessed_at: row.last_accessed_at || undefined,
      relevance_decay: row.relevance_decay,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  private createSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memory_documents (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        agent_id TEXT,
        source_type TEXT NOT NULL,
        source_id TEXT,
        routing_keys_json TEXT NOT NULL,
        tags_json TEXT NOT NULL,
        tier TEXT NOT NULL DEFAULT 'detailed',
        compressed_content TEXT,
        full_content TEXT,
        access_count INTEGER NOT NULL DEFAULT 0,
        last_accessed_at TEXT,
        relevance_decay REAL NOT NULL DEFAULT 1.0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_memory_docs_workspace
      ON memory_documents(workspace_id, tier, created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_memory_docs_agent
      ON memory_documents(agent_id, created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_memory_docs_source
      ON memory_documents(source_type, source_id);

      CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts
      USING fts5(routing_text, compressed_text, content='');

      CREATE TABLE IF NOT EXISTS memory_idf (
        term TEXT PRIMARY KEY,
        doc_frequency INTEGER NOT NULL DEFAULT 1,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS memory_retrievals (
        id TEXT PRIMARY KEY,
        query_text TEXT NOT NULL,
        query_tags_json TEXT,
        workspace_id TEXT NOT NULL,
        agent_id TEXT,
        retrieved_doc_ids_json TEXT NOT NULL,
        scores_json TEXT NOT NULL,
        hop_number INTEGER NOT NULL DEFAULT 1,
        latency_ms INTEGER,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_memory_retrievals_workspace
      ON memory_retrievals(workspace_id, created_at DESC);

      CREATE TABLE IF NOT EXISTS monitor_state (
        key TEXT PRIMARY KEY,
        state_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
  }
}
