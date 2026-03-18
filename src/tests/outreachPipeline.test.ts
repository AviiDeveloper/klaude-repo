import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SQLitePipelineStore } from "../pipeline/sqlitePipelineStore.js";
import { PipelineEngine } from "../pipeline/engine.js";
import { MultiAgentRuntime } from "../pipeline/agentRuntime.js";
import { registerOutreachAgents } from "../agents/outreach/index.js";

const tmpDir = mkdtempSync(join(tmpdir(), "outreach-test-"));
after(() => rmSync(tmpDir, { recursive: true, force: true }));

describe("outreach pipeline end-to-end", () => {
  it("registers outreach agents in the runtime", () => {
    const runtime = new MultiAgentRuntime();
    registerOutreachAgents(runtime);

    assert.ok(runtime.has("lead-scout-agent"), "lead-scout-agent registered");
    assert.ok(runtime.has("lead-profiler-agent"), "lead-profiler-agent registered");
    assert.ok(runtime.has("lead-qualifier-agent"), "lead-qualifier-agent registered");

    // Content agents still registered
    assert.ok(runtime.has("trend-scout-agent"), "default agents still present");

    const all = runtime.listRegistered();
    assert.ok(all.length >= 11, `Expected 11+ agents, got ${all.length}`);
  });

  it("executes the lead-scout-agent with mock data", async () => {
    const runtime = new MultiAgentRuntime();
    registerOutreachAgents(runtime);

    const result = await runtime.execute({
      run_id: randomUUID(),
      node_id: "scout",
      agent_id: "lead-scout-agent",
      config: {
        campaign_id: "test-campaign",
        vertical: "plumber",
        location: "Manchester",
        max_results: 5,
      },
      upstreamArtifacts: {},
    });

    assert.ok(result.summary.includes("plumber"), `Summary mentions vertical: ${result.summary}`);
    assert.ok(result.summary.includes("Manchester"), `Summary mentions location: ${result.summary}`);
    const leads = result.artifacts.leads as Array<Record<string, unknown>>;
    assert.ok(leads.length > 0, `Got ${leads.length} leads`);
    assert.ok(leads.length <= 5, `Respects max_results: ${leads.length}`);
    assert.equal(leads[0].business_type, "plumber");
    console.log(`  Scout produced ${leads.length} mock leads`);
  });

  it("executes the lead-profiler-agent with upstream leads", async () => {
    const runtime = new MultiAgentRuntime();
    registerOutreachAgents(runtime);

    const result = await runtime.execute({
      run_id: randomUUID(),
      node_id: "profile",
      agent_id: "lead-profiler-agent",
      config: {},
      upstreamArtifacts: {
        scout: {
          leads: [
            { business_name: "Test Plumber 1", website_url: null, has_website: 0 },
            { business_name: "Test Plumber 2", website_url: null, has_website: 0 },
          ],
        },
      },
    });

    const profiles = result.artifacts.profiles as Array<Record<string, unknown>>;
    assert.equal(profiles.length, 2, `Profiled ${profiles.length} leads`);
    assert.equal(profiles[0].website_quality_score, 0, "No-website lead gets score 0");

    const painPoints = JSON.parse(profiles[0].pain_points_json as string) as string[];
    assert.ok(painPoints.length > 0, `Pain points identified: ${painPoints.length}`);
    assert.ok(painPoints[0].includes("No website"), `First pain point: ${painPoints[0]}`);
    console.log(`  Profiler found ${result.artifacts.high_opportunity_count} high-opportunity leads`);
  });

  it("executes the lead-qualifier-agent with scoring", async () => {
    const runtime = new MultiAgentRuntime();
    registerOutreachAgents(runtime);

    const result = await runtime.execute({
      run_id: randomUUID(),
      node_id: "qualify",
      agent_id: "lead-qualifier-agent",
      config: {},
      upstreamArtifacts: {
        profile: {
          profiles: [
            {
              business_name: "Great Lead",
              has_website: 0,
              google_review_count: 50,
              google_rating: 4.5,
              has_social_links: 1,
              phone: "01onal234567",
              pain_points_json: JSON.stringify(["No website", "Missing SEO", "No online booking"]),
            },
            {
              business_name: "Poor Lead",
              has_website: 1,
              website_quality_score: 85,
              google_review_count: 2,
              google_rating: 3.0,
            },
          ],
        },
      },
    });

    const qualified = result.artifacts.qualified as Array<Record<string, unknown>>;
    const rejected = result.artifacts.rejected as Array<Record<string, unknown>>;

    assert.ok(qualified.length >= 1, `Qualified: ${qualified.length}`);
    assert.equal(qualified[0].business_name, "Great Lead", "Best lead ranked first");
    assert.ok((qualified[0].qualification_score as number) >= 60, `Score: ${qualified[0].qualification_score}`);
    console.log(`  Qualifier: ${qualified.length} qualified, ${rejected.length} rejected`);
    console.log(`  Top lead: "${qualified[0].business_name}" (score: ${qualified[0].qualification_score})`);
    if (rejected.length > 0) {
      console.log(`  Rejected: "${rejected[0].business_name}" — ${rejected[0].rejection_reason}`);
    }
  });

  it("runs the full lead-generation-v1 pipeline DAG", async () => {
    const dbPath = join(tmpDir, `pipeline-${randomUUID()}.db`);
    const store = new SQLitePipelineStore(dbPath);
    const runtime = new MultiAgentRuntime();
    registerOutreachAgents(runtime);
    const engine = new PipelineEngine(store, runtime);

    // Create the pipeline definition
    engine.createLeadGenerationDefinition();

    const def = store.getDefinition("lead-generation-v1");
    assert.ok(def, "Pipeline definition created");
    assert.equal(def!.nodes.length, 4, "4 nodes in DAG (scout → profile → brand-analyse → qualify)");
    assert.equal(def!.nodes[0].agent_id, "lead-scout-agent");
    assert.equal(def!.nodes[1].agent_id, "lead-profiler-agent");
    assert.equal(def!.nodes[2].agent_id, "brand-analyser-agent");
    assert.equal(def!.nodes[3].agent_id, "lead-qualifier-agent");

    // Execute the full pipeline
    const run = await engine.startRun({
      definitionId: "lead-generation-v1",
      trigger: "manual",
    });

    assert.equal(run.status, "completed", `Pipeline status: ${run.status}`);

    // Check all nodes completed
    const nodes = store.listNodeRuns(run.id);
    assert.equal(nodes.length, 4, "4 node runs (scout, profile, brand-analyse, qualify)");
    for (const node of nodes) {
      assert.equal(node.status, "completed", `Node ${node.node_id}: ${node.status}`);
    }

    // Check artifacts were passed downstream
    const artifacts = store.listArtifacts(run.id);
    assert.ok(artifacts.length >= 3, `${artifacts.length} artifacts produced`);

    // The final qualify node should have produced qualified leads
    const qualifyArtifact = artifacts.find((a) => a.node_id === "qualify");
    assert.ok(qualifyArtifact, "Qualify node produced artifacts");
    const qualifyOutput = qualifyArtifact!.value_json as {
      qualified: Array<{ business_name: string; qualification_score: number }>;
      qualified_count: number;
    };
    assert.ok(qualifyOutput.qualified_count > 0, `Qualified ${qualifyOutput.qualified_count} leads`);

    console.log(`\n  Pipeline completed successfully!`);
    console.log(`  Nodes: ${nodes.map((n) => `${n.node_id}:${n.status}`).join(" → ")}`);
    console.log(`  Artifacts: ${artifacts.length} total`);
    console.log(`  Qualified leads: ${qualifyOutput.qualified_count}`);
    console.log(`  Top lead: "${qualifyOutput.qualified[0]?.business_name}" (score: ${qualifyOutput.qualified[0]?.qualification_score})`);
  });
});

describe("site generation pipeline", () => {
  it("site-composer-agent generates landing pages from lead data", async () => {
    const runtime = new MultiAgentRuntime();
    registerOutreachAgents(runtime);

    const result = await runtime.execute({
      run_id: randomUUID(),
      node_id: "compose",
      agent_id: "site-composer-agent",
      config: {},
      upstreamArtifacts: {
        qualify: {
          qualified: [
            {
              lead_id: "lead-1",
              business_name: "Smith & Sons Plumbing",
              business_type: "plumber",
              phone: "0161 234 5678",
              address: "10 High Street, Manchester",
              google_rating: 4.8,
              google_review_count: 67,
            },
            {
              lead_id: "lead-2",
              business_name: "The Garden Bistro",
              business_type: "restaurant",
              phone: "0161 987 6543",
              address: "42 Oak Lane, Manchester",
            },
          ],
        },
      },
    });

    const sites = result.artifacts.sites as Array<Record<string, unknown>>;
    assert.equal(sites.length, 2, `Generated ${sites.length} sites`);

    // Check plumber site
    const plumberSite = sites.find((s) => s.lead_id === "lead-1")!;
    assert.ok(plumberSite, "Plumber site generated");
    assert.ok((plumberSite.html_output as string).includes("Smith & Sons Plumbing"), "HTML contains business name");
    assert.ok((plumberSite.html_output as string).includes("0161 234 5678"), "HTML contains phone number");
    assert.ok((plumberSite.html_output as string).includes("viewport"), "HTML has viewport meta");
    assert.equal(plumberSite.vertical, "trades", "Resolved to trades vertical");

    // Check restaurant site
    const restaurantSite = sites.find((s) => s.lead_id === "lead-2")!;
    assert.ok(restaurantSite, "Restaurant site generated");
    assert.equal(restaurantSite.vertical, "food", "Resolved to food vertical");

    console.log(`  Composer generated ${sites.length} sites:`);
    for (const site of sites) {
      console.log(`    - ${site.site_name} (${site.vertical}, ${(site.html_output as string).length} chars)`);
    }
  });

  it("site-qa-agent validates generated sites", async () => {
    const runtime = new MultiAgentRuntime();
    registerOutreachAgents(runtime);

    // First generate a site
    const composerResult = await runtime.execute({
      run_id: randomUUID(),
      node_id: "compose",
      agent_id: "site-composer-agent",
      config: {},
      upstreamArtifacts: {
        upstream: {
          qualified: [{
            lead_id: "lead-1",
            business_name: "Quick Fix Electricians",
            business_type: "electrician",
            phone: "0161 555 1234",
          }],
        },
      },
    });

    // Then QA it
    const qaResult = await runtime.execute({
      run_id: randomUUID(),
      node_id: "qa",
      agent_id: "site-qa-agent",
      config: {},
      upstreamArtifacts: { compose: composerResult.artifacts },
    });

    const results = qaResult.artifacts.results as Array<Record<string, unknown>>;
    assert.equal(results.length, 1, "QA'd 1 site");
    assert.ok(results[0].passed, `Site should pass QA (score: ${results[0].score})`);
    assert.ok((results[0].score as number) >= 80, `Score should be high: ${results[0].score}`);
    assert.equal(results[0].error_count, 0, "No errors");

    console.log(`  QA result: ${results[0].passed ? "PASS" : "FAIL"} (score: ${results[0].score}, warnings: ${results[0].warning_count})`);
  });

  it("runs the full site-generation-v1 pipeline DAG", async () => {
    const dbPath = join(tmpDir, `site-pipeline-${randomUUID()}.db`);
    const store = new SQLitePipelineStore(dbPath);
    const runtime = new MultiAgentRuntime();
    registerOutreachAgents(runtime);
    const engine = new PipelineEngine(store, runtime);

    engine.createSiteGenerationDefinition();

    // Simulate: inject qualified leads as the starting input by overriding the compose node config
    // In production, the compose node receives leads from a prior pipeline run or API call
    const def = store.getDefinition("site-generation-v1")!;
    def.nodes[0].config = {
      _upstream_inject: {
        qualified: [{
          lead_id: "test-lead",
          business_name: "Manchester Plumbers Ltd",
          business_type: "plumber",
          phone: "0161 000 1234",
          google_rating: 4.5,
          google_review_count: 30,
        }],
      },
    };
    store.upsertDefinition(def);

    const run = await engine.startRun({
      definitionId: "site-generation-v1",
      trigger: "manual",
    });

    assert.equal(run.status, "completed", `Pipeline: ${run.status}`);

    const nodes = store.listNodeRuns(run.id);
    assert.equal(nodes.length, 2);
    for (const node of nodes) {
      assert.equal(node.status, "completed", `Node ${node.node_id}: ${node.status}`);
    }

    const artifacts = store.listArtifacts(run.id);
    const qaArtifact = artifacts.find((a) => a.node_id === "qa");
    assert.ok(qaArtifact, "QA artifact produced");

    console.log(`\n  Site pipeline completed!`);
    console.log(`  Nodes: ${nodes.map((n) => `${n.node_id}:${n.status}`).join(" → ")}`);
  });
});
