#!/usr/bin/env npx tsx
/**
 * Live Pipeline Test — End-to-End
 *
 * Simulates: salesperson onboarding → pipeline runs → 8 leads appear in dashboard
 *
 * Usage:
 *   GOOGLE_PLACES_API_KEY=... OPENROUTER_API_KEY=... npx tsx scripts/test-live-pipeline.ts
 *
 * Optional:
 *   APIFY_API_TOKEN=...          Instagram scraping (skipped if missing)
 *   TEST_LOCATION="Manchester"   Default: Manchester
 *   TEST_POSTCODE="M1"           Default: M1
 *   TEST_VERTICALS="barber,cafe,restaurant,salon"
 *   MAX_PER_VERTICAL=2           Default: 2 (total = verticals × this)
 */

import { randomUUID } from "node:crypto";
import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { SQLitePipelineStore } from "../src/pipeline/sqlitePipelineStore.js";
import { SQLiteEventBus } from "../src/events/sqliteBus.js";
import { AgentCapabilityRegistry } from "../src/runtime/agent-registry.js";
import { registerOutreachAgentsWithRegistry } from "../src/agents/outreach/index.js";
import { UnifiedPipelineEngine } from "../src/runtime/pipeline-engine.js";
import { DecisionStore } from "../src/learning/decisionStore.js";
import { withLearning } from "../src/learning/learningAgent.js";
import { createCritic } from "../src/evaluation/critic-model.js";
import { EpisodicStore } from "../src/memory/episodic-store.js";

// ── Config ──

const location = process.env.TEST_LOCATION ?? "Manchester";
const postcode = process.env.TEST_POSTCODE ?? "M1";
const verticals = (process.env.TEST_VERTICALS ?? "barber,cafe,restaurant,salon").split(",");
const maxPerVertical = Number(process.env.MAX_PER_VERTICAL ?? "2");

// DB path — same database the sales dashboard reads
const scriptDir = path.dirname(new URL(import.meta.url).pathname);
const dbDir = path.resolve(scriptDir, "..", "apps", "mission-control");
mkdirSync(dbDir, { recursive: true });
const mcDbPath = path.join(dbDir, "mission-control.db");

// Pipeline store — separate from mission-control DB
const pipelineDir = path.resolve(scriptDir, "..", "data");
mkdirSync(pipelineDir, { recursive: true });
const pipelineDbPath = path.join(pipelineDir, "pipeline-test.sqlite");

// ── Preflight checks ──

console.log("\n========================================");
console.log("  SL-MAS Live Pipeline Test");
console.log("========================================\n");

const missingKeys: string[] = [];
if (!process.env.GOOGLE_PLACES_API_KEY) missingKeys.push("GOOGLE_PLACES_API_KEY");
if (!process.env.OPENROUTER_API_KEY && !process.env.OPENAI_API_KEY) missingKeys.push("OPENROUTER_API_KEY");

if (missingKeys.length > 0) {
  console.error(`Missing required env vars: ${missingKeys.join(", ")}`);
  console.error("\nUsage:");
  console.error("  GOOGLE_PLACES_API_KEY=... OPENROUTER_API_KEY=... npx tsx scripts/test-live-pipeline.ts\n");
  process.exit(1);
}

console.log(`Location:        ${location}`);
console.log(`Postcode:        ${postcode}`);
console.log(`Verticals:       ${verticals.join(", ")}`);
console.log(`Max/vertical:    ${maxPerVertical}`);
console.log(`Target leads:    ~${verticals.length * maxPerVertical}`);
console.log(`Pipeline DB:     ${pipelineDbPath}`);
console.log(`Mission Ctrl DB: ${mcDbPath}`);
console.log(`Google Places:   ${process.env.GOOGLE_PLACES_API_KEY ? "configured" : "MISSING"}`);
console.log(`OpenRouter:      ${process.env.OPENROUTER_API_KEY ? "configured" : "MISSING"}`);
console.log(`Apify:           ${process.env.APIFY_API_TOKEN ? "configured" : "skipped (optional)"}`);
console.log();

// ── Set DATABASE_PATH so lead assigner writes to mission-control.db ──
process.env.DATABASE_PATH = mcDbPath;

// ── Create test salesperson ──

console.log("--- Step 1: Creating test salesperson ---");
const salesDb = new Database(mcDbPath);
salesDb.pragma("journal_mode = WAL");
salesDb.pragma("foreign_keys = ON");

// Create schema (same as sales-dashboard)
salesDb.exec(`
  CREATE TABLE IF NOT EXISTS sales_users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    pin_hash TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    area_postcode TEXT,
    commission_rate REAL DEFAULT 0.10,
    active INTEGER DEFAULT 1,
    api_token TEXT,
    push_token TEXT,
    device_type TEXT CHECK (device_type IN ('web', 'ios', 'android')),
    last_active_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS lead_assignments (
    id TEXT PRIMARY KEY,
    lead_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    assigned_at TEXT DEFAULT (datetime('now')),
    status TEXT DEFAULT 'new' CHECK (status IN ('new', 'visited', 'pitched', 'sold', 'rejected')),
    visited_at TEXT,
    pitched_at TEXT,
    sold_at TEXT,
    rejected_at TEXT,
    rejection_reason TEXT,
    notes TEXT,
    commission_amount REAL,
    location_lat REAL,
    location_lng REAL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sales_activity_log (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    lead_id TEXT,
    assignment_id TEXT,
    action TEXT NOT NULL,
    notes TEXT,
    location_lat REAL,
    location_lng REAL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_lead_assignments_user_status ON lead_assignments(user_id, status);
  CREATE INDEX IF NOT EXISTS idx_lead_assignments_lead ON lead_assignments(lead_id);
`);

// Add extra columns if missing
const safeAlter = (sql: string) => { try { salesDb.exec(sql); } catch { /* column exists */ } };
safeAlter("ALTER TABLE sales_users ADD COLUMN area_postcodes_json TEXT");
safeAlter("ALTER TABLE sales_users ADD COLUMN max_active_leads INTEGER DEFAULT 20");
safeAlter("ALTER TABLE sales_users ADD COLUMN user_status TEXT DEFAULT 'available'");

const testUserId = "test-sp-" + randomUUID().slice(0, 8);
const testPin = "1234";
const pinHash = createHash("sha256").update(testPin).digest("hex");

// Check if test user already exists
const existingUser = salesDb.prepare("SELECT id, name FROM sales_users WHERE area_postcode = ? AND active = 1 LIMIT 1").get(postcode) as { id: string; name: string } | undefined;

let userId: string;
let userName: string;

if (existingUser) {
  userId = existingUser.id;
  userName = existingUser.name;
  console.log(`  Using existing salesperson: ${userName} (${userId})`);
} else {
  userId = testUserId;
  userName = `Test SP (${location})`;
  salesDb.prepare(`
    INSERT INTO sales_users (id, name, pin_hash, area_postcode, area_postcodes_json, commission_rate, active, user_status, max_active_leads)
    VALUES (?, ?, ?, ?, ?, 0.10, 1, 'available', 20)
  `).run(userId, userName, pinHash, postcode, JSON.stringify([postcode]));
  console.log(`  Created: ${userName} (PIN: ${testPin}, area: ${postcode})`);
}

salesDb.close();
console.log();

// ── Set up pipeline ──

console.log("--- Step 2: Initialising pipeline engine ---");
const startTime = Date.now();

const pipelineStore = new SQLitePipelineStore(pipelineDbPath);
const bus = new SQLiteEventBus(pipelineDbPath);
const decisionStore = new DecisionStore(pipelineDbPath);
const episodicStore = new EpisodicStore(pipelineDbPath);
const criticModel = createCritic();

// Register agents with capability metadata + learning wrapper
const registry = new AgentCapabilityRegistry();
registerOutreachAgentsWithRegistry(registry);
for (const agentId of registry.listRegistered()) {
  const cap = registry.getCapability(agentId)!;
  const original = registry.getHandler(agentId)!;
  registry.register(cap, withLearning(agentId, original, decisionStore));
}

console.log(`  Agents: ${registry.listRegistered().join(", ")}`);

// Create engine
const engine = new UnifiedPipelineEngine(
  pipelineStore, registry, bus, undefined, undefined, undefined,
  undefined, undefined, criticModel, episodicStore,
);

// Register pipeline definition with test config
pipelineStore.upsertDefinition({
  id: "live-test-pipeline",
  name: `Live Test — ${location}`,
  enabled: true,
  schedule_rrule: "",
  max_retries: 1,
  nodes: [
    { id: "scout", agent_id: "lead-scout-agent", depends_on: [], config: {
      verticals,
      location,
      max_results_per_vertical: maxPerVertical,
    } },
    { id: "profile", agent_id: "lead-profiler-agent", depends_on: ["scout"] },
    { id: "brand-analyse", agent_id: "brand-analyser-agent", depends_on: ["profile"] },
    { id: "brand-intelligence", agent_id: "brand-intelligence-agent", depends_on: ["brand-analyse"] },
    { id: "qualify", agent_id: "lead-qualifier-agent", depends_on: ["brand-intelligence"] },
    { id: "brief", agent_id: "brief-generator-agent", depends_on: ["qualify"] },
    { id: "compose", agent_id: "site-composer-agent", depends_on: ["brief"] },
    { id: "qa", agent_id: "site-qa-agent", depends_on: ["compose"] },
    { id: "assign", agent_id: "lead-assigner-agent", depends_on: [
      "profile", "brand-analyse", "brand-intelligence", "qualify", "brief", "compose", "qa",
    ] },
  ],
  config: {},
});

console.log(`  Pipeline defined: live-test-pipeline (9 nodes)`);
console.log();

// ── Subscribe to events for live progress ──

const nodeTimings = new Map<string, number>();

bus.subscribe("pipeline.run.started", () => {
  console.log("--- Step 3: Pipeline running ---");
});

bus.subscribe("pipeline.node.started", (event) => {
  const payload = event.payload as { node_id: string; agent_id: string };
  nodeTimings.set(payload.node_id, Date.now());
  console.log(`  [${elapsed()}] Starting: ${payload.node_id} (${payload.agent_id})`);
});

bus.subscribe("pipeline.node.completed", (event) => {
  const payload = event.payload as { node_id: string; agent_id: string; cost_usd?: number };
  const started = nodeTimings.get(payload.node_id) ?? Date.now();
  const duration = ((Date.now() - started) / 1000).toFixed(1);
  const cost = payload.cost_usd ? ` ($${payload.cost_usd.toFixed(4)})` : "";
  console.log(`  [${elapsed()}] Completed: ${payload.node_id} in ${duration}s${cost}`);
});

bus.subscribe("pipeline.node.failed", (event) => {
  const payload = event.payload as { node_id: string; error: string };
  console.log(`  [${elapsed()}] FAILED: ${payload.node_id} — ${payload.error.slice(0, 100)}`);
});

bus.subscribe("reflection.iteration", (event) => {
  const payload = event.payload as { node_id: string; score: number; accepted: boolean; iteration: number };
  console.log(`  [${elapsed()}]   Critic: ${payload.node_id} iteration ${payload.iteration} → score ${payload.score.toFixed(2)} ${payload.accepted ? "(accepted)" : "(retrying)"}`);
});

function elapsed(): string {
  return `${((Date.now() - startTime) / 1000).toFixed(0)}s`;
}

// ── Run the pipeline ──

console.log("--- Step 3: Running pipeline ---");
console.log(`  Target: ~${verticals.length * maxPerVertical} leads for ${location}\n`);

async function runPipeline() {
try {
  const run = await engine.startRun({
    definitionId: "live-test-pipeline",
    trigger: "manual",
    correlationId: `test-${Date.now()}`,
  });

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log();
  console.log("========================================");
  console.log(`  Pipeline ${run.status.toUpperCase()}`);
  console.log(`  Total time: ${totalTime}s`);
  console.log("========================================");

  // ── Report results ──

  const nodes = pipelineStore.listNodeRuns(run.id);
  console.log("\nNode results:");
  for (const node of nodes) {
    const icon = node.status === "completed" ? "pass" : node.status === "failed" ? "FAIL" : node.status;
    console.log(`  ${icon} ${node.node_id} (${node.attempts} attempt${node.attempts !== 1 ? "s" : ""})`);
  }

  // Check what landed in mission-control DB
  const checkDb = new Database(mcDbPath);
  const assignments = checkDb.prepare(
    "SELECT la.id, la.lead_id, la.status, la.notes FROM lead_assignments la WHERE la.user_id = ?"
  ).all(userId) as Array<{ id: string; lead_id: string; status: string; notes: string }>;

  console.log(`\nLeads assigned to ${userName}: ${assignments.length}`);
  for (const a of assignments) {
    try {
      const notes = JSON.parse(a.notes ?? "{}") as Record<string, unknown>;
      const name = notes.business_name ?? a.lead_id;
      const type = notes.business_type ?? "unknown";
      const hasDemo = notes.demo_site_html ? "demo" : "no demo";
      const qa = notes.demo_site_qa_score ? `QA: ${notes.demo_site_qa_score}` : "";
      console.log(`  - ${name} (${type}) [${hasDemo}] ${qa}`);
    } catch {
      console.log(`  - ${a.lead_id} (status: ${a.status})`);
    }
  }

  // Episode check
  const episode = episodicStore.getByRunId(run.id);
  if (episode) {
    console.log(`\nEpisode recorded: ${episode.id}`);
    console.log(`  Critic scores: ${episode.critic_scores.length}`);
    console.log(`  Reflection iterations: ${episode.reflection_iterations}`);
    console.log(`  Cost: $${episode.total_cost_usd.toFixed(4)}`);
  }

  checkDb.close();

  console.log("\n--- Next steps ---");
  console.log(`1. cd apps/sales-dashboard && npm run dev:safe`);
  console.log(`2. Open http://127.0.0.1:4300`);
  console.log(`3. Login: name="${userName}" pin="${testPin}"`);
  console.log(`4. You should see ${assignments.length} real leads\n`);

} catch (error) {
  console.error("\nPipeline failed:", error);
  process.exit(1);
} finally {
  pipelineStore.close();
  bus.close();
  decisionStore.close();
  episodicStore.close();
}
}

runPipeline().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
