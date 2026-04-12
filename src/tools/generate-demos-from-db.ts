/**
 * Generate demo sites from existing pipeline data in the database.
 *
 * Uses scout/profile/brand data already in SQLite (from the latest run)
 * and feeds it through brief → compose → qa to produce HTML demos.
 *
 * Usage:
 *   npx tsx src/tools/generate-demos-from-db.ts [--count 5] [--run-id <id>] [--serve]
 *
 * Options:
 *   --count N     Number of leads to generate demos for (default: 5)
 *   --run-id ID   Use a specific pipeline run (default: latest)
 *   --serve       Start a local server to view the generated sites after
 */

import { existsSync, mkdirSync, writeFileSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { createServer } from "node:http";
import Database from "better-sqlite3"; // eslint-disable-line
import { briefGeneratorAgent } from "../agents/outreach/briefGenerator.js";
import { siteComposerAgent } from "../agents/outreach/siteComposerAgent.js";
import { siteQaAgent } from "../agents/outreach/siteQaAgent.js";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DB_PATH = process.env.DB_PATH ?? "data/mvp.sqlite";
const PROJECTS_BASE = process.env.PROJECTS_PATH ?? join(homedir(), "projects");
const GENERATED_DIR = join(PROJECTS_BASE, ".generated-sites");

function getArg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  return idx >= 0 ? process.argv[idx + 1] : undefined;
}

const COUNT = Number(getArg("count") ?? 5);
const RUN_ID = getArg("run-id");
const SERVE = process.argv.includes("--serve");

// ---------------------------------------------------------------------------
// Load data from SQLite
// ---------------------------------------------------------------------------

interface ArtifactRow {
  node_id: string;
  value_json: string;
}

function loadRunData(db: Database.Database, runId: string) {
  const rows = db.prepare(
    `SELECT node_id, value_json FROM agent_task_artifacts
     WHERE run_id = ? AND kind = 'agent.output'
     AND node_id IN ('scout', 'profile', 'brand-analyse', 'brand-intelligence', 'qualify')`,
  ).all(runId) as ArtifactRow[];

  const data: Record<string, any> = {};
  for (const row of rows) {
    data[row.node_id] = JSON.parse(row.value_json);
  }
  return data;
}

function findLatestRunId(db: Database.Database): string {
  const row = db.prepare(
    `SELECT DISTINCT run_id FROM agent_task_artifacts
     WHERE node_id = 'scout' AND kind = 'agent.output'
     ORDER BY created_at DESC LIMIT 1`,
  ).get() as { run_id: string } | undefined;
  if (!row) throw new Error("No scout artifacts found in database");
  return row.run_id;
}

// ---------------------------------------------------------------------------
// Pick top N qualified leads with brand data
// ---------------------------------------------------------------------------

interface LeadSelection {
  lead_id: string;
  business_name: string;
  business_type: string;
  website_url: string;
  phone: string;
  address: string;
  qualification_score: number;
  profile: Record<string, any>;
  brandAnalysis: Record<string, any>;
  brandIntelligence: Record<string, any>;
}

function selectLeads(data: Record<string, any>, count: number): LeadSelection[] {
  const qualified = (data.qualify?.qualified ?? []) as any[];
  const profiles = (data.profile?.profiles ?? []) as any[];
  const analyses = (data["brand-analyse"]?.analyses ?? []) as any[];
  const intelligence = (data["brand-intelligence"]?.intelligence ?? []) as any[];

  const profileMap = new Map(profiles.map((p: any) => [p.lead_id, p]));
  const analysisMap = new Map(analyses.map((a: any) => [a.lead_id, a]));
  const intelMap = new Map(intelligence.map((i: any) => [i.lead_id, i]));

  // Sort qualified by score descending, pick ones that have profile + brand data
  const candidates = qualified
    .filter((q: any) => profileMap.has(q.lead_id) && analysisMap.has(q.lead_id))
    .sort((a: any, b: any) => (b.qualification_score ?? 0) - (a.qualification_score ?? 0))
    .slice(0, count);

  return candidates.map((q: any) => ({
    lead_id: q.lead_id,
    business_name: q.business_name,
    business_type: q.business_type ?? q.vertical_category ?? "general",
    website_url: q.website_url ?? "",
    phone: q.phone ?? "",
    address: q.address ?? "",
    qualification_score: q.qualification_score,
    profile: profileMap.get(q.lead_id) ?? {},
    brandAnalysis: analysisMap.get(q.lead_id) ?? {},
    brandIntelligence: intelMap.get(q.lead_id) ?? {},
  }));
}

// ---------------------------------------------------------------------------
// Generate demo for a single lead
// ---------------------------------------------------------------------------

async function generateDemo(lead: LeadSelection, idx: number, total: number) {
  const tag = `[${idx + 1}/${total}]`;
  console.log(`\n${tag} ${lead.business_name} (score: ${lead.qualification_score})`);
  console.log(`    type: ${lead.business_type} | site: ${lead.website_url || "none"}`);

  // Brief
  console.log(`${tag} Generating brief...`);
  const t0 = Date.now();
  const briefResult = await briefGeneratorAgent({
    run_id: "demo-gen",
    node_id: "brief",
    agent_id: "brief-generator-agent",
    config: {},
    upstreamArtifacts: {
      qualify: {
        qualified: [lead],
      },
      "brand-intelligence": {
        profiles: [{ ...lead, ...lead.profile }],
        analyses: [lead.brandAnalysis],
        intelligence: [lead.brandIntelligence],
      },
    },
  });
  const briefData = briefResult.artifacts as any;
  const generatedBrief = briefData?.briefs?.[0];
  if (generatedBrief) {
    console.log(`${tag} Brief: headline="${generatedBrief.heroHeadline}" tone=${generatedBrief.brandTone ?? "none"} position=${generatedBrief.marketPosition ?? "none"}`);
  }
  console.log(`${tag} Brief done (${((Date.now() - t0) / 1000).toFixed(1)}s) — ${briefResult.summary}`);

  // Compose
  console.log(`${tag} Composing site...`);
  const t1 = Date.now();
  const composeResult = await siteComposerAgent({
    run_id: "demo-gen",
    node_id: "compose",
    agent_id: "site-composer-agent",
    config: {},
    upstreamArtifacts: {
      brief: {
        ...briefResult.artifacts,
        qualified: [lead],
        analyses: [lead.brandAnalysis],
      },
    },
  });
  console.log(`${tag} Compose done (${((Date.now() - t1) / 1000).toFixed(1)}s) — ${composeResult.summary}`);

  // QA
  console.log(`${tag} Running QA...`);
  const qaResult = await siteQaAgent({
    run_id: "demo-gen",
    node_id: "qa",
    agent_id: "site-qa-agent",
    config: {},
    upstreamArtifacts: { compose: composeResult.artifacts },
  });
  console.log(`${tag} QA done — ${qaResult.summary}`);

  const site = (composeResult.artifacts as any).sites?.[0];
  const qa = (qaResult.artifacts as any).results?.[0];

  if (!site?.html_output) {
    console.log(`${tag} WARNING: No HTML generated for ${lead.business_name}`);
    return null;
  }

  // Save
  if (!existsSync(GENERATED_DIR)) mkdirSync(GENERATED_DIR, { recursive: true });
  const slug = lead.business_name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "");
  writeFileSync(join(GENERATED_DIR, `${slug}.html`), site.html_output);
  writeFileSync(
    join(GENERATED_DIR, `${slug}.json`),
    JSON.stringify(
      {
        lead_id: lead.lead_id,
        business_name: lead.business_name,
        business_type: lead.business_type,
        qualification_score: lead.qualification_score,
        qa_score: qa?.score ?? null,
        qa_passed: qa?.passed ?? null,
        qa_issues: qa?.issues ?? [],
        brand_colours: lead.brandAnalysis.colours ?? null,
        brand_fonts: lead.brandAnalysis.fonts ?? null,
        sections: site.sections_count,
        hero_variant: site.hero_variant,
        font_pairing: site.font_pairing,
        generated_at: new Date().toISOString(),
      },
      null,
      2,
    ),
  );

  const htmlKB = (site.html_output.length / 1024).toFixed(1);
  console.log(`${tag} Saved: ${GENERATED_DIR}/${slug}.html (${htmlKB}KB) | QA: ${qa?.passed ? "PASS" : "FAIL"} (${qa?.score ?? "?"})`);
  return slug;
}

// ---------------------------------------------------------------------------
// Simple server to view results
// ---------------------------------------------------------------------------

function startServer(port: number) {
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${port}`);

    if (url.pathname === "/" || url.pathname === "/index.html") {
      const files = existsSync(GENERATED_DIR)
        ? readdirSync(GENERATED_DIR).filter((f) => f.endsWith(".html")).sort()
        : [];
      const rows = files.map((f) => {
        const slug = f.replace(".html", "");
        const jsonPath = join(GENERATED_DIR, `${slug}.json`);
        let meta: any = {};
        if (existsSync(jsonPath)) {
          try { meta = JSON.parse(readFileSync(jsonPath, "utf-8")); } catch {}
        }
        const qaLabel = meta.qa_passed === true ? "PASS" : meta.qa_passed === false ? "FAIL" : "?";
        const qaColor = meta.qa_passed ? "#3fb950" : "#f85149";
        return `<tr>
          <td><a href="/site/${slug}" target="_blank" style="color:#58a6ff">${meta.business_name ?? slug}</a></td>
          <td>${meta.business_type ?? ""}</td>
          <td>${meta.qualification_score ?? ""}</td>
          <td style="color:${qaColor};font-weight:bold">${qaLabel} (${meta.qa_score ?? "?"})</td>
          <td>${meta.generated_at ? new Date(meta.generated_at).toLocaleString() : ""}</td>
        </tr>`;
      });
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`<!DOCTYPE html><html><head><title>Demo Sites</title>
        <style>body{background:#0d1117;color:#c9d1d9;font-family:monospace;padding:20px}
        table{border-collapse:collapse;width:100%}th,td{padding:8px 12px;border:1px solid #30363d;text-align:left}
        th{background:#161b22;color:#8b949e;font-size:11px;text-transform:uppercase}
        a{text-decoration:none}a:hover{text-decoration:underline}
        h1{font-size:18px;color:#f0f6fc}</style></head>
        <body><h1>Generated Demo Sites (${files.length})</h1>
        <table><tr><th>Business</th><th>Type</th><th>Score</th><th>QA</th><th>Generated</th></tr>
        ${rows.join("")}</table></body></html>`);
      return;
    }

    if (url.pathname.startsWith("/site/")) {
      const slug = url.pathname.slice(6);
      const htmlPath = join(GENERATED_DIR, `${slug}.html`);
      if (existsSync(htmlPath)) {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(readFileSync(htmlPath, "utf-8"));
        return;
      }
    }

    res.writeHead(404);
    res.end("Not found");
  });

  server.listen(port, "0.0.0.0", () => {
    console.log(`\nDemo viewer: http://localhost:${port}`);
    console.log(`             http://100.93.24.14:${port} (via Tailscale)`);
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("=== Demo Generation from Existing Pipeline Data ===\n");

  if (!existsSync(DB_PATH)) {
    console.error(`Database not found: ${DB_PATH}`);
    process.exit(1);
  }

  const db = new Database(DB_PATH, { readonly: true });
  const runId = RUN_ID ?? findLatestRunId(db);
  console.log(`Using run: ${runId}`);

  const data = loadRunData(db, runId);
  db.close();

  const keys = Object.keys(data);
  console.log(`Loaded artifacts: ${keys.join(", ")}`);

  if (!data.qualify) {
    console.error("No qualify data found — pipeline may not have completed.");
    process.exit(1);
  }

  const leads = selectLeads(data, COUNT);
  console.log(`Selected ${leads.length} leads for demo generation:\n`);
  for (const l of leads) {
    console.log(`  - ${l.business_name} (${l.business_type}, score: ${l.qualification_score})`);
  }

  const generated: string[] = [];
  for (let i = 0; i < leads.length; i++) {
    try {
      const slug = await generateDemo(leads[i], i, leads.length);
      if (slug) generated.push(slug);
    } catch (err) {
      console.error(`\nERROR generating demo for ${leads[i].business_name}:`, err);
    }
  }

  console.log(`\n=== Done: ${generated.length}/${leads.length} demos generated ===`);
  console.log(`Output: ${GENERATED_DIR}\n`);

  if (generated.length > 0) {
    console.log("Generated sites:");
    for (const slug of generated) {
      console.log(`  ${GENERATED_DIR}/${slug}.html`);
    }
  }

  if (SERVE && generated.length > 0) {
    startServer(4200);
  } else if (generated.length > 0) {
    console.log(`\nTo view: npx tsx src/tools/generate-demos-from-db.ts --serve`);
    console.log(`Or open the HTML files directly in your browser.`);
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
