/**
 * Memory System — public API.
 *
 * Wires together: store, indexer, router, compressor, and MSA monitor.
 * This is the single entry point for the memory subsystem.
 */

import { SQLiteMemoryStore } from "./sqliteMemoryStore.js";
import { MemoryIndexer } from "./memoryIndexer.js";
import { MemoryRouter } from "./memoryRouter.js";
import { MemoryCompressor } from "./memoryCompressor.js";
import { MSAWeightMonitor } from "./msaWeightMonitor.js";
import type { MemoryQuery, MemoryResult } from "./types.js";
import type { ExecutionTraceRecord } from "../trace/types.js";

export interface MemorySystemConfig {
  dbPath: string;
  telegramBotToken?: string;
  telegramChatId?: string;
}

export class MemorySystem {
  readonly store: SQLiteMemoryStore;
  readonly indexer: MemoryIndexer;
  readonly router: MemoryRouter;
  readonly compressor: MemoryCompressor;
  readonly msaMonitor: MSAWeightMonitor;

  constructor(config: MemorySystemConfig) {
    this.store = new SQLiteMemoryStore({ dbPath: config.dbPath });
    this.indexer = new MemoryIndexer(this.store);
    this.router = new MemoryRouter(this.store);
    this.compressor = new MemoryCompressor(this.store);
    this.msaMonitor = new MSAWeightMonitor(
      this.store,
      config.telegramBotToken,
      config.telegramChatId,
    );
  }

  // ─── Query ───

  query(params: MemoryQuery): MemoryResult[] {
    return this.router.query(params);
  }

  // ─── Index ───

  indexTrace(trace: ExecutionTraceRecord, workspaceId?: string): string {
    try {
      return this.indexer.indexTrace(trace, workspaceId);
    } catch (err) {
      console.error("[Memory] Failed to index trace:", err);
      return "";
    }
  }

  indexDecision(params: Parameters<MemoryIndexer["indexDecision"]>[0]): string {
    try {
      return this.indexer.indexDecision(params);
    } catch (err) {
      console.error("[Memory] Failed to index decision:", err);
      return "";
    }
  }

  indexEvalRun(params: Parameters<MemoryIndexer["indexEvalRun"]>[0]): string {
    try {
      return this.indexer.indexEvalRun(params);
    } catch (err) {
      console.error("[Memory] Failed to index eval:", err);
      return "";
    }
  }

  indexJournalEntry(params: Parameters<MemoryIndexer["indexJournalEntry"]>[0]): string {
    try {
      return this.indexer.indexJournalEntry(params);
    } catch (err) {
      console.error("[Memory] Failed to index journal:", err);
      return "";
    }
  }

  // ─── Maintenance ───

  runCompression(): { compressed: number; archived: number } {
    return this.compressor.runCompression();
  }

  async checkMSAWeights(): Promise<boolean> {
    return this.msaMonitor.check();
  }

  getStats() {
    return this.store.getStats();
  }
}

// Re-export types
export type { MemoryQuery, MemoryResult, MemoryDocument, MemoryTags } from "./types.js";
export { tokenize, extractRoutingKeys } from "./scorer.js";
