/**
 * Memory Indexer — converts source data into MemoryDocuments.
 *
 * This is the "write path" — analogous to MSA's Stage 1 (Global Memory Encoding).
 * At index time we:
 * 1. Extract text content from the source
 * 2. Compute routing keys (top-20 TF-IDF terms)
 * 3. Build structured tags for coarse-grained filtering
 * 4. Generate compressed content (first + last sentence + key term sentences)
 * 5. Store the full document with routing keys
 */

import { randomUUID } from "node:crypto";
import type { ExecutionTraceRecord } from "../trace/types.js";
import type { MemoryDocument, MemoryOutcome, MemorySourceType, MemoryTags } from "./types.js";
import { extractRoutingKeys, tokenize } from "./scorer.js";
import type { SQLiteMemoryStore } from "./sqliteMemoryStore.js";

export class MemoryIndexer {
  constructor(private readonly store: SQLiteMemoryStore) {}

  /**
   * Index a finalized task trace into memory.
   */
  indexTrace(trace: ExecutionTraceRecord, workspaceId: string = "default"): string {
    const textParts = [
      `Task: ${trace.objective}`,
      `Final state: ${trace.final_state}`,
    ];

    for (const event of trace.timeline) {
      textParts.push(`[${event.event_type}] ${event.summary}`);
    }

    if (trace.side_effects.length > 0) {
      textParts.push(
        `Side effects: ${trace.side_effects.map((se) => se.description || se.type).join(", ")}`,
      );
    }

    const fullText = textParts.join("\n");
    const compressed = this.compressText(fullText);
    const outcome = this.mapFinalStateToOutcome(trace.final_state);

    const taskType = this.inferTaskType(trace.objective);
    const concepts = this.extractConcepts(fullText);

    const tags: MemoryTags = {
      task_type: taskType,
      outcome,
      concepts,
    };

    return this.indexDocument({
      workspace_id: workspaceId,
      source_type: "trace",
      source_id: trace.task_id,
      full_text: fullText,
      compressed,
      tags,
    });
  }

  /**
   * Index a decision log entry into memory.
   */
  indexDecision(params: {
    workspace_id: string;
    decision_id: string;
    agent_id?: string;
    decision_type: string;
    summary: string;
    details?: Record<string, unknown>;
    actor_type?: string;
  }): string {
    const textParts = [
      `Decision: ${params.decision_type}`,
      `Summary: ${params.summary}`,
    ];

    if (params.details) {
      textParts.push(`Details: ${JSON.stringify(params.details)}`);
    }
    if (params.actor_type) {
      textParts.push(`Actor: ${params.actor_type}`);
    }

    const fullText = textParts.join("\n");
    const compressed = this.compressText(fullText);

    const tags: MemoryTags = {
      agent_id: params.agent_id,
      task_type: params.decision_type,
      outcome: "unknown",
      concepts: this.extractConcepts(fullText),
    };

    return this.indexDocument({
      workspace_id: params.workspace_id,
      agent_id: params.agent_id,
      source_type: "decision",
      source_id: params.decision_id,
      full_text: fullText,
      compressed,
      tags,
    });
  }

  /**
   * Index an evaluation run into memory.
   */
  indexEvalRun(params: {
    workspace_id: string;
    eval_id: string;
    agent_id: string;
    task_type?: string;
    quality_score: number;
    status: string;
    fault_attribution?: string;
    reason_codes?: string[];
  }): string {
    const textParts = [
      `Evaluation of agent ${params.agent_id}`,
      `Quality score: ${params.quality_score}`,
      `Status: ${params.status}`,
    ];

    if (params.fault_attribution) {
      textParts.push(`Fault attribution: ${params.fault_attribution}`);
    }
    if (params.reason_codes && params.reason_codes.length > 0) {
      textParts.push(`Reason codes: ${params.reason_codes.join(", ")}`);
    }

    const fullText = textParts.join("\n");
    const compressed = this.compressText(fullText);
    const outcome: MemoryOutcome =
      params.status === "pass" ? "success" : params.status === "partial" ? "partial" : "fail";

    const tags: MemoryTags = {
      agent_id: params.agent_id,
      task_type: params.task_type || "evaluation",
      outcome,
      concepts: [
        ...(params.reason_codes || []),
        ...(params.fault_attribution ? [params.fault_attribution] : []),
      ],
    };

    return this.indexDocument({
      workspace_id: params.workspace_id,
      agent_id: params.agent_id,
      source_type: "eval",
      source_id: params.eval_id,
      full_text: fullText,
      compressed,
      tags,
    });
  }

  /**
   * Index a memory journal entry.
   */
  indexJournalEntry(params: {
    workspace_id: string;
    entry_id: string;
    entry_type: string;
    content: string;
    metadata?: Record<string, unknown>;
  }): string {
    const fullText = `[${params.entry_type}] ${params.content}`;
    const compressed = this.compressText(fullText);

    const tags: MemoryTags = {
      task_type: params.entry_type,
      outcome: "unknown",
      concepts: this.extractConcepts(fullText),
    };

    return this.indexDocument({
      workspace_id: params.workspace_id,
      source_type: "journal",
      source_id: params.entry_id,
      full_text: fullText,
      compressed,
      tags,
    });
  }

  // ─── Private ───

  private indexDocument(params: {
    workspace_id: string;
    agent_id?: string;
    source_type: MemorySourceType;
    source_id?: string;
    full_text: string;
    compressed: string;
    tags: MemoryTags;
  }): string {
    const id = randomUUID();
    const totalDocs = this.store.getTotalDocCount();
    const idfLookup = (term: string) => this.store.getIdf(term);
    const routingKeys = extractRoutingKeys(params.full_text, idfLookup, totalDocs);

    const doc: Omit<MemoryDocument, "access_count" | "last_accessed_at" | "updated_at"> = {
      id,
      workspace_id: params.workspace_id,
      agent_id: params.agent_id,
      source_type: params.source_type,
      source_id: params.source_id,
      routing_keys: routingKeys,
      tags: params.tags,
      tier: "detailed",
      compressed_content: params.compressed,
      full_content: params.full_text,
      relevance_decay: 1.0,
      created_at: new Date().toISOString(),
    };

    this.store.insert(doc);
    return id;
  }

  private compressText(text: string): string {
    const sentences = text.split(/[.\n]+/).filter((s) => s.trim().length > 5);
    if (sentences.length <= 3) return text;

    const first = sentences[0].trim();
    const last = sentences[sentences.length - 1].trim();

    // Keep sentences containing high-value terms
    const terms = tokenize(text);
    const termFreq = new Map<string, number>();
    for (const t of terms) {
      termFreq.set(t, (termFreq.get(t) || 0) + 1);
    }

    const topTerms = [...termFreq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([t]) => t);

    const middle = sentences
      .slice(1, -1)
      .filter((s) => topTerms.some((t) => s.toLowerCase().includes(t)))
      .slice(0, 3)
      .map((s) => s.trim());

    return [first, ...middle, last].join(". ");
  }

  private mapFinalStateToOutcome(state: string): MemoryOutcome {
    if (state === "completed" || state === "success") return "success";
    if (state === "failed" || state === "error") return "fail";
    if (state === "partial" || state === "blocked") return "partial";
    return "unknown";
  }

  private inferTaskType(objective: string): string {
    const lower = objective.toLowerCase();
    if (lower.includes("review") || lower.includes("code review")) return "code_review";
    if (lower.includes("deploy") || lower.includes("deployment")) return "deployment";
    if (lower.includes("test") || lower.includes("testing")) return "testing";
    if (lower.includes("fix") || lower.includes("bug")) return "bugfix";
    if (lower.includes("outreach") || lower.includes("scrape")) return "outreach";
    if (lower.includes("generate") || lower.includes("demo")) return "generation";
    if (lower.includes("delegat")) return "delegation";
    return "general";
  }

  private extractConcepts(text: string): string[] {
    const terms = tokenize(text);
    const freq = new Map<string, number>();
    for (const t of terms) {
      freq.set(t, (freq.get(t) || 0) + 1);
    }
    return [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([t]) => t);
  }
}
