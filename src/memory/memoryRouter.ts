/**
 * Memory Router — three-stage query pipeline with Memory Interleave.
 *
 * Implements the MSA-inspired retrieval pattern:
 * Stage 1: Tag pre-filter (indexed SQLite columns, <1ms)
 * Stage 2: FTS5 BM25 scoring (SQLite C engine, <5ms)
 * Stage 3: Full content load for top-k results (<2ms)
 *
 * Memory Interleave enables multi-hop reasoning:
 * Hop 1: Query → top-k results → extract concept tags
 * Hop 2: Augmented query with discovered concepts → new results
 * This iterates until max_hops or no new relevant results found.
 */

import { randomUUID } from "node:crypto";
import type { MemoryQuery, MemoryResult, MemoryRetrievalLog } from "./types.js";
import { tokenize } from "./scorer.js";
import type { SQLiteMemoryStore } from "./sqliteMemoryStore.js";

export class MemoryRouter {
  constructor(private readonly store: SQLiteMemoryStore) {}

  /**
   * Execute a memory query through the three-stage pipeline.
   * If enable_interleave is true, performs multi-hop retrieval.
   */
  query(params: MemoryQuery): MemoryResult[] {
    const startTime = Date.now();
    const topK = params.top_k || 5;
    const maxHops = params.enable_interleave ? (params.max_hops || 2) : 1;

    const allResults: MemoryResult[] = [];
    const seenDocIds = new Set<string>();
    let currentQuery = params.query_text;

    for (let hop = 1; hop <= maxHops; hop++) {
      const hopTopK = hop === 1
        ? Math.ceil(topK * 0.6)  // First hop gets 60% of budget
        : Math.ceil(topK * 0.4); // Second hop gets 40%

      const hopResults = this.singleHopQuery({
        query_text: currentQuery,
        workspace_id: params.workspace_id,
        agent_id: params.agent_id,
        tag_filters: params.tag_filters,
        tier_filter: params.tier_filter,
        top_k: hopTopK,
        excludeIds: seenDocIds,
      });

      if (hopResults.length === 0) break;

      // Log retrieval
      const latencyMs = Date.now() - startTime;
      this.logRetrieval({
        query_text: currentQuery,
        query_tags: params.tag_filters,
        workspace_id: params.workspace_id,
        agent_id: params.agent_id,
        results: hopResults,
        hop_number: hop,
        latency_ms: latencyMs,
      });

      for (const result of hopResults) {
        seenDocIds.add(result.document.id);
        allResults.push({ ...result, hop_number: hop });
      }

      // Memory Interleave: extract concepts from results to augment next query
      if (hop < maxHops) {
        const discoveredConcepts = this.extractConceptsFromResults(hopResults);
        if (discoveredConcepts.length === 0) break;
        currentQuery = `${params.query_text} ${discoveredConcepts.join(" ")}`;
      }
    }

    return allResults;
  }

  // ─── Private ───

  private singleHopQuery(params: {
    query_text: string;
    workspace_id: string;
    agent_id?: string;
    tag_filters?: MemoryQuery["tag_filters"];
    tier_filter?: MemoryQuery["tier_filter"];
    top_k: number;
    excludeIds: Set<string>;
  }): MemoryResult[] {
    // Sanitize query for FTS5 — escape special characters
    const ftsQuery = this.sanitizeFtsQuery(params.query_text);
    if (!ftsQuery) return [];

    // Use FTS5 for scoring (runs in SQLite C engine)
    const scored = this.store.ftsSearch({
      query: ftsQuery,
      workspace_id: params.workspace_id,
      agent_id: params.agent_id,
      tiers: params.tier_filter,
      topK: params.top_k + params.excludeIds.size, // Over-fetch to account for exclusions
    });

    // Filter out already-seen documents
    const filtered = scored
      .filter((s) => !params.excludeIds.has(s.id))
      .slice(0, params.top_k);

    if (filtered.length === 0) return [];

    // Stage 3: Load full content for selected documents
    const docs = this.store.loadDocuments(filtered.map((f) => f.id));
    const scoreMap = new Map(filtered.map((f) => [f.id, f.score]));

    return docs.map((doc) => ({
      document: doc,
      score: scoreMap.get(doc.id) || 0,
      hop_number: 1,
    }));
  }

  private extractConceptsFromResults(results: MemoryResult[]): string[] {
    const concepts = new Set<string>();
    for (const result of results) {
      for (const concept of result.document.tags.concepts) {
        concepts.add(concept);
      }
      if (result.document.tags.agent_id) {
        concepts.add(result.document.tags.agent_id);
      }
    }
    return [...concepts].slice(0, 10);
  }

  private sanitizeFtsQuery(text: string): string {
    // FTS5 query: tokenize and join with OR for flexible matching
    const terms = tokenize(text);
    if (terms.length === 0) return "";
    // Escape each term and join with OR
    return terms
      .slice(0, 10) // Cap query terms to prevent slow queries
      .map((t) => `"${t}"`)
      .join(" OR ");
  }

  private logRetrieval(params: {
    query_text: string;
    query_tags?: MemoryQuery["tag_filters"];
    workspace_id: string;
    agent_id?: string;
    results: MemoryResult[];
    hop_number: number;
    latency_ms: number;
  }): void {
    const log: MemoryRetrievalLog = {
      id: randomUUID(),
      query_text: params.query_text,
      query_tags: params.query_tags,
      workspace_id: params.workspace_id,
      agent_id: params.agent_id,
      retrieved_doc_ids: params.results.map((r) => r.document.id),
      scores: params.results.map((r) => r.score),
      hop_number: params.hop_number,
      latency_ms: params.latency_ms,
      created_at: new Date().toISOString(),
    };

    try {
      this.store.logRetrieval(log);
    } catch {
      // Fire-and-forget — don't fail the query if logging fails
    }
  }
}
