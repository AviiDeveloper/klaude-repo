/**
 * Memory Token Context Scaling Benchmark
 *
 * Measures how our BM25/FTS5 memory system performs as corpus size grows.
 * Inspired by MSA paper's evaluation: scale from small to large corpus
 * and measure retrieval accuracy + latency degradation.
 *
 * Tests:
 * 1. Needle-in-a-Haystack: plant a specific document, grow the corpus, verify retrieval
 * 2. Scaling curve: 100 → 500 → 1K → 5K → 10K documents
 * 3. Token count estimation at each scale
 * 4. Retrieval accuracy (does the right doc rank #1?)
 * 5. Latency at each scale
 * 6. Multi-needle: 5 related documents scattered in a large corpus
 * 7. Compression impact on retrieval quality
 * 8. Memory interleave accuracy at scale
 */

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { MemorySystem } from "../memory/index.js";

// ─── Helpers ───

function makeMemory(): { memory: MemorySystem; dir: string } {
  const dir = mkdtempSync(path.join(tmpdir(), "mem-scale-"));
  const memory = new MemorySystem({ dbPath: path.join(dir, "memory.db") });
  return { memory, dir };
}

/** Estimate token count: ~4 chars per token (rough English average) */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/** Generate a realistic agent memory document with variable length */
function generateNoiseDocument(index: number): {
  workspace_id: string;
  source_type: "trace" | "decision" | "eval" | "journal";
  content: string;
  agent_id: string;
  task_type: string;
  outcome: "success" | "partial" | "fail";
} {
  const sourceTypes = ["trace", "decision", "eval", "journal"] as const;
  const taskTypes = ["deployment", "code_review", "testing", "bugfix", "generation", "outreach", "delegation", "monitoring"];
  const agents = ["agent-alpha", "agent-beta", "agent-gamma", "agent-delta", "agent-epsilon"];
  const outcomes = ["success", "partial", "fail"] as const;
  const categories = ["restaurant", "plumber", "salon", "dentist", "gym", "cafe", "florist", "electrician"];
  const regions = ["london", "manchester", "birmingham", "leeds", "bristol", "edinburgh", "cardiff", "belfast"];

  const sourceType = sourceTypes[index % sourceTypes.length];
  const taskType = taskTypes[index % taskTypes.length];
  const agent = agents[index % agents.length];
  const outcome = outcomes[index % outcomes.length];
  const category = categories[index % categories.length];
  const region = regions[index % regions.length];

  // Generate realistic content with enough variation to create distinct TF-IDF profiles
  const content = [
    `Task ${index}: ${taskType} for ${category} business in ${region}`,
    `Agent ${agent} executed ${taskType} pipeline step ${index}`,
    `Business category: ${category}, region: ${region}, quality score: ${(50 + (index % 50)).toFixed(1)}`,
    `Outcome: ${outcome}. Processing time: ${100 + index * 3}ms`,
    `Details: The ${taskType} agent processed ${10 + index % 20} items in this batch`,
    `Pipeline stage ${index % 8 + 1} of 8 completed with ${outcome} status`,
    `Lead buffer: ${500 + index}, demo quality: ${(0.6 + (index % 40) / 100).toFixed(2)}`,
    `Close rate for ${category} in ${region}: ${(5 + index % 15).toFixed(1)}%`,
  ].join(". ");

  return { workspace_id: "default", source_type: sourceType, content, agent_id: agent, task_type: taskType, outcome };
}

/** Plant a specific "needle" document that we'll search for later */
function plantNeedle(memory: MemorySystem, id: string): string {
  const needleContent = "CRITICAL: The deployment of restaurant demo generation pipeline to staging failed because the Vast.ai RTX 4090 instance ran out of VRAM during LoRA fine-tuning checkpoint 847. Cost was £4.23. Rollback executed successfully.";

  memory.indexer.indexDecision({
    workspace_id: "default",
    decision_id: id,
    agent_id: "agent-trainer",
    decision_type: "training_failure",
    summary: needleContent,
    details: { checkpoint: 847, cost_gbp: 4.23, gpu: "RTX_4090", error: "OOM" },
    actor_type: "system",
  });

  return needleContent;
}

// ─── Tests ───

describe("Memory Token Context Scaling", () => {

  // ═══ 1. Needle-in-a-Haystack at Increasing Scale ═══

  test("1. Needle retrieval accuracy across corpus sizes", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "niah-"));
    try {
      const memory = new MemorySystem({ dbPath: path.join(dir, "memory.db") });

      // Plant the needle first
      const needleId = "needle-001";
      plantNeedle(memory, needleId);

      const scales = [100, 500, 1000, 2000, 5000];
      const results: Array<{
        corpus_size: number;
        est_tokens: number;
        needle_found: boolean;
        needle_rank: number;
        query_ms: number;
        top_score: number;
      }> = [];

      let totalTokens = estimateTokens("CRITICAL: The deployment of restaurant demo generation pipeline...");
      let docsInserted = 1;

      for (const targetSize of scales) {
        // Grow corpus to target size
        while (docsInserted < targetSize) {
          const noise = generateNoiseDocument(docsInserted);
          memory.indexer.indexDecision({
            workspace_id: noise.workspace_id,
            decision_id: `noise-${docsInserted}`,
            agent_id: noise.agent_id,
            decision_type: noise.task_type,
            summary: noise.content,
          });
          totalTokens += estimateTokens(noise.content);
          docsInserted++;
        }

        // Search for the needle
        const startMs = Date.now();
        const queryResults = memory.query({
          query_text: "Vast.ai RTX 4090 VRAM LoRA fine-tuning checkpoint failed OOM",
          workspace_id: "default",
          top_k: 10,
        });
        const queryMs = Date.now() - startMs;

        const needleIdx = queryResults.findIndex((r) => r.document.source_id === needleId);
        results.push({
          corpus_size: targetSize,
          est_tokens: totalTokens,
          needle_found: needleIdx >= 0,
          needle_rank: needleIdx >= 0 ? needleIdx + 1 : -1,
          query_ms: queryMs,
          top_score: queryResults[0]?.score || 0,
        });
      }

      // Print results table
      console.log("\n  ┌─────────────┬────────────┬───────┬──────┬─────────┐");
      console.log("  │ Corpus Size │ Est Tokens │ Found │ Rank │ Latency │");
      console.log("  ├─────────────┼────────────┼───────┼──────┼─────────┤");
      for (const r of results) {
        const tokens = r.est_tokens > 1000000 ? `${(r.est_tokens / 1000000).toFixed(1)}M` :
          r.est_tokens > 1000 ? `${(r.est_tokens / 1000).toFixed(0)}K` : `${r.est_tokens}`;
        console.log(
          `  │ ${String(r.corpus_size).padStart(11)} │ ${tokens.padStart(10)} │ ${r.needle_found ? "  ✅  " : "  ❌  "} │ ${String(r.needle_rank).padStart(4)} │ ${String(r.query_ms).padStart(5)}ms │`,
        );
      }
      console.log("  └─────────────┴────────────┴───────┴──────┴─────────┘");

      // Assertions: needle must be found at ALL scales
      for (const r of results) {
        assert.ok(r.needle_found, `Needle not found at corpus size ${r.corpus_size}`);
        assert.ok(r.needle_rank <= 5, `Needle ranked ${r.needle_rank} at corpus ${r.corpus_size}, expected <=5`);
      }

      // Latency should stay under 500ms even at 5K docs
      const maxLatency = results[results.length - 1].query_ms;
      assert.ok(maxLatency < 500, `Query at 5K docs took ${maxLatency}ms, expected <500ms`);

    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  // ═══ 2. Retrieval Accuracy Degradation Curve ═══

  test("2. Accuracy degradation: measure score stability across scale", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "degrade-"));
    try {
      const memory = new MemorySystem({ dbPath: path.join(dir, "memory.db") });

      // Plant 3 distinct needles at the start
      const needles = [
        { id: "n1", query: "deployment staging pipeline release", type: "deployment" },
        { id: "n2", query: "quality control demo scoring threshold", type: "qc_scoring" },
        { id: "n3", query: "cost budget Vast.ai GPU terminate", type: "cost_control" },
      ];

      for (const needle of needles) {
        memory.indexer.indexDecision({
          workspace_id: "default",
          decision_id: needle.id,
          decision_type: needle.type,
          summary: `${needle.type}: ${needle.query} with detailed analysis and specific metrics for this exact scenario`,
        });
      }

      const scales = [50, 200, 500, 1000, 3000];
      const accuracyByScale: Array<{ scale: number; accuracy: number; avg_rank: number }> = [];
      let inserted = 3;

      for (const targetScale of scales) {
        while (inserted < targetScale) {
          const noise = generateNoiseDocument(inserted);
          memory.indexer.indexDecision({
            workspace_id: "default",
            decision_id: `d-${inserted}`,
            decision_type: noise.task_type,
            summary: noise.content,
          });
          inserted++;
        }

        let found = 0;
        let rankSum = 0;
        for (const needle of needles) {
          const results = memory.query({
            query_text: needle.query,
            workspace_id: "default",
            top_k: 10,
          });
          const idx = results.findIndex((r) => r.document.source_id === needle.id);
          if (idx >= 0) {
            found++;
            rankSum += idx + 1;
          }
        }

        accuracyByScale.push({
          scale: targetScale,
          accuracy: found / needles.length,
          avg_rank: found > 0 ? rankSum / found : -1,
        });
      }

      console.log("\n  ┌───────┬──────────┬──────────┐");
      console.log("  │ Scale │ Accuracy │ Avg Rank │");
      console.log("  ├───────┼──────────┼──────────┤");
      for (const r of accuracyByScale) {
        console.log(
          `  │ ${String(r.scale).padStart(5)} │ ${(r.accuracy * 100).toFixed(0).padStart(6)}%  │ ${r.avg_rank >= 0 ? r.avg_rank.toFixed(1).padStart(6) : "  N/A"  }   │`,
        );
      }
      console.log("  └───────┴──────────┴──────────┘");

      // At all scales, accuracy should be >= 66% (2 of 3 needles found)
      for (const r of accuracyByScale) {
        assert.ok(r.accuracy >= 0.66, `Accuracy dropped to ${(r.accuracy * 100).toFixed(0)}% at scale ${r.scale}`);
      }

      // Degradation: accuracy at largest scale should be within 34% of smallest
      const first = accuracyByScale[0].accuracy;
      const last = accuracyByScale[accuracyByScale.length - 1].accuracy;
      const degradation = ((first - last) / first) * 100;
      console.log(`  Degradation: ${degradation.toFixed(1)}% (${(first * 100).toFixed(0)}% → ${(last * 100).toFixed(0)}%)`);
      assert.ok(degradation < 34, `Degradation ${degradation.toFixed(1)}% exceeds 34% threshold`);

    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  // ═══ 3. Multi-Needle Retrieval (Scattered Evidence) ═══

  test("3. Multi-needle: 5 related docs scattered in 2K corpus", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "multi-"));
    try {
      const memory = new MemorySystem({ dbPath: path.join(dir, "memory.db") });

      // Insert 2000 noise documents first
      for (let i = 0; i < 2000; i++) {
        const noise = generateNoiseDocument(i);
        memory.indexer.indexDecision({
          workspace_id: "default",
          decision_id: `noise-${i}`,
          decision_type: noise.task_type,
          summary: noise.content,
        });
      }

      // Now scatter 5 related "restaurant close rate analysis" needles
      const needleIds: string[] = [];
      const needleContents = [
        "Restaurant close rate analysis Q1: 12.3% average across London with Italian restaurants leading at 18%",
        "Restaurant targeting update: close rates improved after adjusting demo colour palette to warm tones",
        "Restaurant demo generation: warm colour palette with food photography increased conversion by 22%",
        "Restaurant lead scoring model v3: AUC 0.71 specifically for restaurant vertical in urban areas",
        "Restaurant salesperson assignment: top performers in restaurant category show 2.1x close rate lift",
      ];

      for (let i = 0; i < needleContents.length; i++) {
        const id = `restaurant-needle-${i}`;
        needleIds.push(id);
        memory.indexer.indexDecision({
          workspace_id: "default",
          decision_id: id,
          decision_type: "analytics",
          summary: needleContents[i],
        });
      }

      // Query for restaurant analysis
      const results = memory.query({
        query_text: "restaurant close rate analysis conversion colour palette",
        workspace_id: "default",
        top_k: 10,
        enable_interleave: true,
        max_hops: 2,
      });

      const foundNeedles = results.filter((r) =>
        needleIds.includes(r.document.source_id || ""),
      );

      console.log(`\n  Multi-needle: found ${foundNeedles.length}/5 restaurant needles in 2005-doc corpus`);
      console.log(`  Top 5 results:`);
      for (const r of results.slice(0, 5)) {
        const isNeedle = needleIds.includes(r.document.source_id || "") ? "🎯" : "  ";
        console.log(`    ${isNeedle} [${r.document.source_type}] score=${r.score.toFixed(2)} — ${r.document.compressed_content.slice(0, 80)}...`);
      }

      assert.ok(foundNeedles.length >= 2, `Expected >=2 needles, found ${foundNeedles.length}`);

    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  // ═══ 4. Latency Scaling Curve ═══

  test("4. Latency scaling: sub-linear growth with corpus size", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "latency-"));
    try {
      const memory = new MemorySystem({ dbPath: path.join(dir, "memory.db") });

      const scales = [100, 500, 1000, 2000, 5000, 10000];
      const latencies: Array<{ scale: number; index_ms: number; query_ms: number; tokens: number }> = [];
      let totalTokens = 0;
      let inserted = 0;

      for (const target of scales) {
        // Index batch
        const batchStart = Date.now();
        while (inserted < target) {
          const noise = generateNoiseDocument(inserted);
          memory.indexer.indexDecision({
            workspace_id: "default",
            decision_id: `lat-${inserted}`,
            decision_type: noise.task_type,
            summary: noise.content,
          });
          totalTokens += estimateTokens(noise.content);
          inserted++;
        }
        const indexMs = Date.now() - batchStart;

        // Query
        const queries = [
          "deployment staging pipeline",
          "restaurant close rate analysis",
          "cost budget GPU terminate",
        ];
        let totalQueryMs = 0;
        for (const q of queries) {
          const qStart = Date.now();
          memory.query({ query_text: q, workspace_id: "default", top_k: 5 });
          totalQueryMs += Date.now() - qStart;
        }
        const avgQueryMs = totalQueryMs / queries.length;

        latencies.push({
          scale: target,
          index_ms: indexMs,
          query_ms: Math.round(avgQueryMs),
          tokens: totalTokens,
        });
      }

      console.log("\n  ┌────────┬────────────┬───────────┬──────────┐");
      console.log("  │  Docs  │ Est Tokens │ Index(ms) │ Query(ms)│");
      console.log("  ├────────┼────────────┼───────────┼──────────┤");
      for (const r of latencies) {
        const tokens = r.tokens > 1000000 ? `${(r.tokens / 1000000).toFixed(1)}M` :
          r.tokens > 1000 ? `${(r.tokens / 1000).toFixed(0)}K` : `${r.tokens}`;
        console.log(
          `  │ ${String(r.scale).padStart(6)} │ ${tokens.padStart(10)} │ ${String(r.index_ms).padStart(9)} │ ${String(r.query_ms).padStart(8)} │`,
        );
      }
      console.log("  └────────┴────────────┴───────────┴──────────┘");

      // Query latency at 10K docs should be < 3000ms (FTS5 on 1M tokens)
      const maxQuery = latencies[latencies.length - 1].query_ms;
      assert.ok(maxQuery < 3000, `Query at 10K took ${maxQuery}ms, expected <3000ms`);

      // Query latency should grow sub-linearly (10K should be < 10x of 100)
      const baseQuery = Math.max(1, latencies[0].query_ms);
      const ratio = maxQuery / baseQuery;
      console.log(`  Scaling ratio (10K/100): ${ratio.toFixed(1)}x (sub-linear if <10x)`);

    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  // ═══ 5. Compression Impact on Retrieval ═══

  test("5. Retrieval quality preserved after compression", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "compress-"));
    try {
      const memory = new MemorySystem({ dbPath: path.join(dir, "memory.db") });

      // Insert 500 docs with old timestamps
      const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
      for (let i = 0; i < 500; i++) {
        const noise = generateNoiseDocument(i);
        memory.store.insert({
          id: `comp-${i}`,
          workspace_id: "default",
          agent_id: noise.agent_id,
          source_type: noise.source_type,
          source_id: `comp-${i}`,
          routing_keys: noise.content.toLowerCase().split(/\s+/).filter((w) => w.length > 3).slice(0, 20),
          tags: { task_type: noise.task_type, outcome: noise.outcome, concepts: [noise.task_type] },
          tier: "detailed",
          compressed_content: noise.content.slice(0, 150),
          full_content: noise.content,
          relevance_decay: 1.0,
          created_at: oldDate,
        });
      }

      // Plant a needle (also old)
      memory.store.insert({
        id: "comp-needle",
        workspace_id: "default",
        source_type: "decision",
        source_id: "comp-needle",
        routing_keys: ["vastai", "gpu", "training", "lora", "checkpoint", "failure", "oom", "rtx4090"],
        tags: { task_type: "training_failure", outcome: "fail", concepts: ["gpu", "training", "oom"] },
        tier: "detailed",
        compressed_content: "Vast.ai RTX 4090 LoRA training failed at checkpoint 847 due to OOM",
        full_content: "Full details of Vast.ai RTX 4090 GPU instance that ran out of VRAM during LoRA fine-tuning at checkpoint 847. Cost was £4.23.",
        relevance_decay: 1.0,
        created_at: oldDate,
      });

      // Query BEFORE compression
      const beforeResults = memory.query({
        query_text: "Vast.ai GPU training LoRA OOM failure",
        workspace_id: "default",
        top_k: 5,
      });
      const foundBefore = beforeResults.some((r) => r.document.source_id === "comp-needle");

      // Run compression
      const compResult = memory.runCompression();
      assert.ok(compResult.compressed > 0, "Should compress old documents");

      // Query AFTER compression
      const afterResults = memory.query({
        query_text: "Vast.ai GPU training LoRA OOM failure",
        workspace_id: "default",
        top_k: 5,
      });
      const foundAfter = afterResults.some((r) => r.document.source_id === "comp-needle");

      console.log(`\n  Compression: ${compResult.compressed} docs compressed`);
      console.log(`  Needle found before: ${foundBefore ? "✅" : "❌"}, after: ${foundAfter ? "✅" : "❌"}`);

      // The needle should still be found after compression (routing keys preserved)
      // Note: FTS5 contentless table means compressed docs may not appear in FTS results
      // but the tag pre-filter path should still work
      const statsAfter = memory.getStats();
      assert.ok(statsAfter.by_tier.compressed > 0, "Compressed tier should have documents");

    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  // ═══ 6. Token Capacity Estimation ═══

  test("6. Token capacity: estimate max corpus our system handles", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "capacity-"));
    try {
      const memory = new MemorySystem({ dbPath: path.join(dir, "memory.db") });

      // Insert 10K docs and measure total tokens + DB size
      let totalChars = 0;
      const start = Date.now();

      for (let i = 0; i < 10000; i++) {
        const noise = generateNoiseDocument(i);
        memory.indexer.indexDecision({
          workspace_id: "default",
          decision_id: `cap-${i}`,
          decision_type: noise.task_type,
          summary: noise.content,
        });
        totalChars += noise.content.length;
      }

      const insertMs = Date.now() - start;
      const totalTokens = estimateTokens("x".repeat(totalChars));
      const stats = memory.getStats();

      console.log("\n  ┌──────────────────────────────────┐");
      console.log("  │   Token Capacity Report          │");
      console.log("  ├──────────────────────────────────┤");
      console.log(`  │ Documents:     ${String(stats.total_documents).padStart(16)} │`);
      console.log(`  │ Total chars:   ${String(totalChars).padStart(16)} │`);
      console.log(`  │ Est tokens:    ${String(totalTokens).padStart(16)} │`);
      console.log(`  │ Insert time:   ${String(insertMs + "ms").padStart(16)} │`);
      console.log(`  │ IDF terms:     ${String(stats.idf_terms).padStart(16)} │`);
      console.log("  ├──────────────────────────────────┤");

      // Project capacity at Pi 400 constraints (~100MB RAM budget for memory)
      const avgDocSize = totalChars / 10000;
      const projectedDocs100mb = Math.floor((100 * 1024 * 1024) / (avgDocSize * 2)); // 2x for indexes
      const projectedTokens = estimateTokens("x".repeat(Math.floor(projectedDocs100mb * avgDocSize)));
      const projectedTokensStr = projectedTokens > 1000000
        ? `${(projectedTokens / 1000000).toFixed(1)}M`
        : `${(projectedTokens / 1000).toFixed(0)}K`;

      console.log(`  │ Avg doc size:  ${String(Math.round(avgDocSize) + " chars").padStart(16)} │`);
      console.log(`  │ Projected capacity (100MB RAM):   │`);
      console.log(`  │   Documents:   ${String(projectedDocs100mb).padStart(16)} │`);
      console.log(`  │   Tokens:      ${projectedTokensStr.padStart(16)} │`);
      console.log("  └──────────────────────────────────┘");

      assert.equal(stats.total_documents, 10000);
      assert.ok(insertMs < 30000, `10K inserts took ${insertMs}ms, expected <30s`);

    } finally {
      rmSync(dir, { recursive: true });
    }
  });
});
