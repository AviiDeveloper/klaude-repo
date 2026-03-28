import { describe, test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { SQLiteMemoryStore } from "../memory/sqliteMemoryStore.js";
import { MemoryIndexer } from "../memory/memoryIndexer.js";
import { MemoryRouter } from "../memory/memoryRouter.js";
import { MemoryCompressor } from "../memory/memoryCompressor.js";
import { BM25Scorer, tokenize, extractRoutingKeys } from "../memory/scorer.js";
import type { ExecutionTraceRecord } from "../trace/types.js";

function makeTempDb(): { store: SQLiteMemoryStore; dir: string } {
  const dir = mkdtempSync(path.join(tmpdir(), "memory-test-"));
  const store = new SQLiteMemoryStore({ dbPath: path.join(dir, "test.db") });
  return { store, dir };
}

// ─── Tokenizer ───

describe("tokenize", () => {
  test("removes stop words and lowercases", () => {
    const tokens = tokenize("The quick brown fox jumps over the lazy dog");
    assert.ok(!tokens.includes("the"));
    assert.ok(!tokens.includes("over"));
    assert.ok(tokens.includes("quick"));
    assert.ok(tokens.includes("brown"));
    assert.ok(tokens.includes("fox"));
  });

  test("removes single-char tokens", () => {
    const tokens = tokenize("a I x go");
    assert.ok(!tokens.includes("a"));
    assert.ok(!tokens.includes("i"));
    assert.ok(tokens.includes("go"));
  });
});

// ─── BM25 Scorer ───

describe("BM25Scorer", () => {
  test("scores documents with matching terms higher", () => {
    const scorer = new BM25Scorer(
      () => 1, // IDF: 1 doc contains each term
      () => 10, // 10 total docs
      () => 10, // avg 10 routing keys per doc
    );

    const results = scorer.score(["deploy", "pipeline"], [
      { doc_id: "d1", routing_keys: ["deploy", "pipeline", "staging", "build"], relevance_decay: 1.0 },
      { doc_id: "d2", routing_keys: ["test", "unit", "mock", "assert"], relevance_decay: 1.0 },
      { doc_id: "d3", routing_keys: ["deploy", "docker", "container"], relevance_decay: 1.0 },
    ]);

    assert.equal(results[0].doc_id, "d1"); // Both terms match
    assert.equal(results[1].doc_id, "d3"); // One term matches
    assert.equal(results[2].doc_id, "d2"); // No terms match
    assert.equal(results[2].score, 0);
  });

  test("applies relevance decay", () => {
    const scorer = new BM25Scorer(() => 1, () => 10, () => 10);

    const results = scorer.score(["deploy"], [
      { doc_id: "old", routing_keys: ["deploy"], relevance_decay: 0.5 },
      { doc_id: "new", routing_keys: ["deploy"], relevance_decay: 1.0 },
    ]);

    assert.equal(results[0].doc_id, "new");
    assert.ok(results[0].score > results[1].score);
  });
});

// ─── Routing Key Extraction ───

describe("extractRoutingKeys", () => {
  test("extracts top terms by TF-IDF", () => {
    const keys = extractRoutingKeys(
      "The deployment pipeline failed because the Docker container crashed during staging. The pipeline needs to be fixed.",
      () => 1,
      100,
      5,
    );

    assert.ok(keys.length <= 5);
    assert.ok(keys.includes("pipeline")); // Appears twice, high TF
  });
});

// ─── SQLiteMemoryStore ───

describe("SQLiteMemoryStore", () => {
  test("insert and load documents", () => {
    const { store, dir } = makeTempDb();
    try {
      store.insert({
        id: "doc-1",
        workspace_id: "ws-1",
        source_type: "trace",
        source_id: "task-1",
        routing_keys: ["deploy", "pipeline", "staging"],
        tags: { outcome: "success", concepts: ["deploy", "staging"] },
        tier: "detailed",
        compressed_content: "Deployment succeeded on staging.",
        full_content: "Full trace of deployment to staging environment...",
        relevance_decay: 1.0,
        created_at: new Date().toISOString(),
      });

      const docs = store.loadDocuments(["doc-1"]);
      assert.equal(docs.length, 1);
      assert.equal(docs[0].id, "doc-1");
      assert.equal(docs[0].source_type, "trace");
      assert.equal(docs[0].access_count, 1);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  test("FTS5 search returns ranked results", () => {
    const { store, dir } = makeTempDb();
    try {
      store.insert({
        id: "doc-1",
        workspace_id: "ws-1",
        source_type: "trace",
        routing_keys: ["deploy", "pipeline"],
        tags: { concepts: ["deploy"] },
        tier: "detailed",
        compressed_content: "Deploy pipeline executed successfully",
        relevance_decay: 1.0,
        created_at: new Date().toISOString(),
      });

      store.insert({
        id: "doc-2",
        workspace_id: "ws-1",
        source_type: "decision",
        routing_keys: ["test", "coverage"],
        tags: { concepts: ["test"] },
        tier: "detailed",
        compressed_content: "Test coverage report generated",
        relevance_decay: 1.0,
        created_at: new Date().toISOString(),
      });

      const results = store.ftsSearch({
        query: "deploy pipeline",
        workspace_id: "ws-1",
      });

      assert.ok(results.length >= 1);
      assert.equal(results[0].id, "doc-1");
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  test("tag pre-filter narrows candidates", () => {
    const { store, dir } = makeTempDb();
    try {
      store.insert({
        id: "doc-1",
        workspace_id: "ws-1",
        agent_id: "agent-code",
        source_type: "trace",
        routing_keys: ["code", "review"],
        tags: { agent_id: "agent-code", task_type: "code_review", outcome: "success", concepts: [] },
        tier: "detailed",
        compressed_content: "Code review completed",
        relevance_decay: 1.0,
        created_at: new Date().toISOString(),
      });

      store.insert({
        id: "doc-2",
        workspace_id: "ws-1",
        agent_id: "agent-ops",
        source_type: "trace",
        routing_keys: ["deploy", "ops"],
        tags: { agent_id: "agent-ops", task_type: "deployment", outcome: "fail", concepts: [] },
        tier: "detailed",
        compressed_content: "Deployment failed",
        relevance_decay: 1.0,
        created_at: new Date().toISOString(),
      });

      const filtered = store.tagPreFilter({
        workspace_id: "ws-1",
        agent_id: "agent-code",
      });

      assert.equal(filtered.length, 1);
      assert.equal(filtered[0].id, "doc-1");
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  test("stats returns correct counts", () => {
    const { store, dir } = makeTempDb();
    try {
      store.insert({
        id: "doc-1",
        workspace_id: "ws-1",
        source_type: "trace",
        routing_keys: ["test"],
        tags: { concepts: [] },
        tier: "detailed",
        compressed_content: "Test",
        relevance_decay: 1.0,
        created_at: new Date().toISOString(),
      });

      const stats = store.getStats();
      assert.equal(stats.total_documents, 1);
      assert.equal(stats.by_tier.detailed, 1);
      assert.equal(stats.by_source.trace, 1);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  test("monitor state get/set", () => {
    const { store, dir } = makeTempDb();
    try {
      assert.equal(store.getMonitorState("test_key"), null);
      store.setMonitorState("test_key", '{"count": 1}');
      assert.equal(store.getMonitorState("test_key"), '{"count": 1}');
      store.setMonitorState("test_key", '{"count": 2}');
      assert.equal(store.getMonitorState("test_key"), '{"count": 2}');
    } finally {
      rmSync(dir, { recursive: true });
    }
  });
});

// ─── MemoryIndexer ───

describe("MemoryIndexer", () => {
  test("indexes a trace and stores routing keys", () => {
    const { store, dir } = makeTempDb();
    try {
      const indexer = new MemoryIndexer(store);

      const trace: ExecutionTraceRecord = {
        task_id: "task-1",
        objective: "Deploy the staging pipeline",
        created_at: new Date().toISOString(),
        build_version: "1.0.0",
        changelog_change_id: "ch-1",
        final_state: "completed",
        timeline: [
          {
            timestamp: new Date().toISOString(),
            event_type: "agent.completed",
            component: "agent.ops",
            summary: "Pipeline deployment executed on staging",
            details: {},
          },
        ],
        approvals: [],
        side_effects: [],
        artifacts: [],
      };

      const docId = indexer.indexTrace(trace, "ws-1");
      assert.ok(docId.length > 0);

      const docs = store.loadDocuments([docId]);
      assert.equal(docs.length, 1);
      assert.equal(docs[0].source_type, "trace");
      assert.equal(docs[0].source_id, "task-1");
      assert.ok(docs[0].routing_keys.length > 0);
      assert.equal(docs[0].tags.outcome, "success");
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  test("indexes a decision log entry", () => {
    const { store, dir } = makeTempDb();
    try {
      const indexer = new MemoryIndexer(store);

      const docId = indexer.indexDecision({
        workspace_id: "ws-1",
        decision_id: "dec-1",
        agent_id: "agent-lead",
        decision_type: "delegation",
        summary: "Delegated code review to agent-dev based on specialization score",
        details: { agent_score: 85 },
        actor_type: "lead",
      });

      const docs = store.loadDocuments([docId]);
      assert.equal(docs[0].source_type, "decision");
      assert.equal(docs[0].tags.agent_id, "agent-lead");
      assert.equal(docs[0].tags.task_type, "delegation");
    } finally {
      rmSync(dir, { recursive: true });
    }
  });
});

// ─── MemoryRouter ───

describe("MemoryRouter", () => {
  test("single-hop query returns relevant documents", () => {
    const { store, dir } = makeTempDb();
    try {
      const indexer = new MemoryIndexer(store);
      const router = new MemoryRouter(store);

      // Index several documents
      indexer.indexDecision({
        workspace_id: "ws-1",
        decision_id: "dec-1",
        decision_type: "delegation",
        summary: "Delegated deployment task to ops agent for staging release",
      });

      indexer.indexDecision({
        workspace_id: "ws-1",
        decision_id: "dec-2",
        decision_type: "code_review",
        summary: "Code review completed with minor style issues found",
      });

      const results = router.query({
        query_text: "deployment staging release",
        workspace_id: "ws-1",
        top_k: 2,
      });

      assert.ok(results.length >= 1);
      // The deployment-related document should rank first
      assert.equal(results[0].document.source_id, "dec-1");
    } finally {
      rmSync(dir, { recursive: true });
    }
  });
});

// ─── MemoryCompressor ───

describe("MemoryCompressor", () => {
  test("compresses old detailed documents", () => {
    const { store, dir } = makeTempDb();
    try {
      const compressor = new MemoryCompressor(store, {
        detailedMaxAgeDays: 0, // Compress everything immediately for testing
        compressedMaxAgeDays: 30,
      });

      store.insert({
        id: "old-doc",
        workspace_id: "ws-1",
        source_type: "trace",
        routing_keys: ["test", "deploy"],
        tags: { concepts: ["test"] },
        tier: "detailed",
        compressed_content: "Deploy succeeded",
        full_content: "Full deployment trace with many details...",
        relevance_decay: 1.0,
        created_at: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
      });

      const result = compressor.runCompression();
      assert.equal(result.compressed, 1);

      // Verify full_content was dropped
      const docs = store.loadDocuments(["old-doc"]);
      assert.equal(docs[0].tier, "compressed");
      assert.equal(docs[0].full_content, undefined);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });
});

// ─── MemoryScorer Interface Contract ───

describe("MemoryScorer interface contract", () => {
  test("BM25Scorer returns sorted results with scores", () => {
    const scorer = new BM25Scorer(() => 2, () => 50, () => 15);

    const results = scorer.score(
      ["deploy", "staging"],
      [
        { doc_id: "a", routing_keys: ["deploy", "staging", "release"], relevance_decay: 1.0 },
        { doc_id: "b", routing_keys: ["unit", "test", "mock"], relevance_decay: 1.0 },
      ],
    );

    // Contract: results are sorted descending by score
    for (let i = 1; i < results.length; i++) {
      assert.ok(results[i - 1].score >= results[i].score, "Results must be sorted descending");
    }

    // Contract: all results have doc_id and score
    for (const r of results) {
      assert.ok(typeof r.doc_id === "string");
      assert.ok(typeof r.score === "number");
    }
  });
});
