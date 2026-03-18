/**
 * Preview Server — serves generated sites locally for visual testing.
 *
 * Usage:
 *   npx tsx src/tools/previewServer.ts --url https://example.com --name "My Business" --type restaurant
 *   npx tsx src/tools/previewServer.ts --port 4200  (serve existing generated sites)
 *
 * Opens at http://pi400.local:4200 (or localhost:4200)
 * Shows an index page listing all generated sites with links to view each one.
 */

import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { readFileSync, existsSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { leadProfilerAgent } from "../agents/outreach/leadProfilerAgent.js";
import { brandAnalyserAgent } from "../agents/outreach/brandAnalyser.js";
import { siteComposerAgent } from "../agents/outreach/siteComposerAgent.js";
import { siteQaAgent } from "../agents/outreach/siteQaAgent.js";
import { getLeadDir, listAssets, buildAssetUrl } from "../lib/assetStore.js";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const PROJECTS_BASE = process.env.PROJECTS_PATH ?? join(homedir(), "projects");
const GENERATED_DIR = join(PROJECTS_BASE, ".generated-sites");
const PORT = Number(process.argv.find((a, i) => process.argv[i - 1] === "--port") ?? 4200);

// ---------------------------------------------------------------------------
// Parse CLI args
// ---------------------------------------------------------------------------

function getArg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  return idx >= 0 ? process.argv[idx + 1] : undefined;
}

const inputUrl = getArg("url");
const inputName = getArg("name");
const inputType = getArg("type") ?? "general";
const inputPhone = getArg("phone") ?? "01onal 000 0000";
const inputAddress = getArg("address") ?? "";

// ---------------------------------------------------------------------------
// Pipeline runner
// ---------------------------------------------------------------------------

interface GeneratedSiteRecord {
  lead_id: string;
  business_name: string;
  domain: string;
  vertical: string;
  html: string;
  qa_score: number;
  qa_passed: boolean;
  brand_source: string;
  assets_count: number;
  generated_at: string;
}

async function runPipeline(url: string, name: string, type: string): Promise<GeneratedSiteRecord> {
  const leadId = `preview-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;

  console.log(`\n[Pipeline] Profiling ${name} (${url})...`);
  const t0 = Date.now();

  const profileResult = await leadProfilerAgent({
    run_id: "preview",
    node_id: "profile",
    agent_id: "lead-profiler-agent",
    config: {},
    upstreamArtifacts: {
      scout: {
        leads: [{
          lead_id: leadId,
          business_name: name,
          business_type: type,
          website_url: url,
          phone: inputPhone,
          address: inputAddress,
        }],
      },
    },
  });

  console.log(`[Pipeline] Profile done in ${((Date.now() - t0) / 1000).toFixed(1)}s — ${profileResult.summary}`);

  console.log(`[Pipeline] Analysing brand...`);
  const brandResult = await brandAnalyserAgent({
    run_id: "preview",
    node_id: "brand-analyse",
    agent_id: "brand-analyser-agent",
    config: {},
    upstreamArtifacts: { profile: profileResult.artifacts },
  });
  console.log(`[Pipeline] Brand: ${brandResult.summary}`);

  const analysis = (brandResult.artifacts as any).analyses?.[0];

  console.log(`[Pipeline] Composing site...`);
  const lead = {
    lead_id: leadId,
    business_name: name,
    business_type: type,
    phone: inputPhone,
    address: inputAddress,
  };

  const composeResult = await siteComposerAgent({
    run_id: "preview",
    node_id: "compose",
    agent_id: "site-composer-agent",
    config: {},
    upstreamArtifacts: {
      qualify: {
        qualified: [lead],
        analyses: analysis ? [analysis] : [],
      },
    },
  });
  console.log(`[Pipeline] Compose: ${composeResult.summary}`);

  console.log(`[Pipeline] Running QA...`);
  const qaResult = await siteQaAgent({
    run_id: "preview",
    node_id: "qa",
    agent_id: "site-qa-agent",
    config: {},
    upstreamArtifacts: { compose: composeResult.artifacts },
  });
  console.log(`[Pipeline] QA: ${qaResult.summary}`);

  const site = (composeResult.artifacts as any).sites[0] as Record<string, any>;
  const qa = (qaResult.artifacts as any).results[0] as Record<string, any>;

  // Save generated HTML to disk
  if (!existsSync(GENERATED_DIR)) mkdirSync(GENERATED_DIR, { recursive: true });

  const record: GeneratedSiteRecord = {
    lead_id: leadId,
    business_name: name,
    domain: site.domain,
    vertical: site.vertical,
    html: site.html_output,
    qa_score: qa.score,
    qa_passed: qa.passed,
    brand_source: site.brand_source ?? "unknown",
    assets_count: listAssets(leadId).length,
    generated_at: new Date().toISOString(),
  };

  writeFileSync(join(GENERATED_DIR, `${record.domain}.html`), record.html);
  writeFileSync(join(GENERATED_DIR, `${record.domain}.json`), JSON.stringify(record, null, 2));

  console.log(`[Pipeline] Saved to ${GENERATED_DIR}/${record.domain}.html\n`);
  return record;
}

// ---------------------------------------------------------------------------
// HTTP Server
// ---------------------------------------------------------------------------

function listGeneratedSites(): GeneratedSiteRecord[] {
  if (!existsSync(GENERATED_DIR)) return [];
  return readdirSync(GENERATED_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      try {
        return JSON.parse(readFileSync(join(GENERATED_DIR, f), "utf-8")) as GeneratedSiteRecord;
      } catch {
        return null;
      }
    })
    .filter(Boolean) as GeneratedSiteRecord[];
}

function renderIndex(sites: GeneratedSiteRecord[]): string {
  const rows = sites
    .sort((a, b) => b.generated_at.localeCompare(a.generated_at))
    .map((s) => `
      <tr>
        <td><a href="/site/${s.domain}" target="_blank"><strong>${esc(s.business_name)}</strong></a></td>
        <td>${esc(s.vertical)}</td>
        <td>${s.brand_source}</td>
        <td>${s.assets_count} files</td>
        <td style="color: ${s.qa_passed ? "#16a34a" : "#dc2626"}">${s.qa_score}/100 ${s.qa_passed ? "✅" : "❌"}</td>
        <td>${new Date(s.generated_at).toLocaleString()}</td>
      </tr>`).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Site Preview — Generated Sites</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f172a; color: #e2e8f0; padding: 32px; }
    h1 { font-size: 1.8rem; margin-bottom: 8px; }
    .subtitle { color: #94a3b8; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; background: #1e293b; border-radius: 8px; overflow: hidden; }
    th { background: #334155; padding: 12px 16px; text-align: left; font-weight: 600; font-size: 0.85rem; text-transform: uppercase; color: #94a3b8; }
    td { padding: 12px 16px; border-bottom: 1px solid #334155; }
    a { color: #60a5fa; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .empty { text-align: center; padding: 60px; color: #64748b; }
    .form { background: #1e293b; padding: 24px; border-radius: 8px; margin-bottom: 24px; }
    .form h2 { margin-bottom: 16px; font-size: 1.2rem; }
    .form input, .form select { padding: 8px 12px; border: 1px solid #475569; border-radius: 4px; background: #0f172a; color: #e2e8f0; margin-right: 8px; margin-bottom: 8px; }
    .form button { padding: 8px 20px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; }
    .form button:hover { background: #2563eb; }
    .status { margin-top: 12px; padding: 8px; border-radius: 4px; display: none; }
  </style>
</head>
<body>
  <h1>🌐 Site Preview Server</h1>
  <p class="subtitle">${sites.length} generated sites</p>

  <div class="form">
    <h2>Generate New Site</h2>
    <form id="genForm" onsubmit="return generateSite(event)">
      <input name="url" placeholder="https://business-website.com" required style="width: 300px;">
      <input name="name" placeholder="Business Name" required>
      <select name="type">
        <option value="general">General</option>
        <option value="plumber">Plumber</option>
        <option value="electrician">Electrician</option>
        <option value="restaurant">Restaurant</option>
        <option value="cafe">Cafe</option>
        <option value="salon">Salon</option>
        <option value="barber">Barber</option>
        <option value="dentist">Dentist</option>
        <option value="accountant">Accountant</option>
        <option value="shop">Shop</option>
      </select>
      <button type="submit">Generate & Preview</button>
    </form>
    <div id="status" class="status"></div>
  </div>

  ${sites.length > 0 ? `
  <table>
    <thead><tr><th>Business</th><th>Vertical</th><th>Brand Source</th><th>Assets</th><th>QA Score</th><th>Generated</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>` : `<div class="empty">No sites generated yet. Use the form above or run with --url flag.</div>`}

  <script>
  async function generateSite(e) {
    e.preventDefault();
    const form = e.target;
    const status = document.getElementById("status");
    const url = form.url.value;
    const name = form.name.value;
    const type = form.type.value;
    status.style.display = "block";
    status.style.background = "#1e40af";
    status.textContent = "⏳ Generating site... (this takes 30-60s for Playwright scraping)";
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, name, type }),
      });
      const data = await res.json();
      if (data.ok) {
        status.style.background = "#166534";
        status.innerHTML = '✅ Done! <a href="/site/' + data.domain + '" target="_blank" style="color:#fff;text-decoration:underline">View Site →</a> (QA: ' + data.qa_score + '/100)';
        setTimeout(() => location.reload(), 2000);
      } else {
        status.style.background = "#991b1b";
        status.textContent = "❌ Error: " + data.error;
      }
    } catch (err) {
      status.style.background = "#991b1b";
      status.textContent = "❌ Network error: " + err.message;
    }
  }
  </script>
</body>
</html>`;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function serveAsset(leadId: string, filename: string, res: ServerResponse): void {
  const assetPath = join(PROJECTS_BASE, ".assets", leadId, filename);
  if (!existsSync(assetPath)) {
    res.writeHead(404);
    res.end("Asset not found");
    return;
  }
  const ext = filename.split(".").pop()?.toLowerCase();
  const mimeMap: Record<string, string> = {
    png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
    gif: "image/gif", webp: "image/webp", svg: "image/svg+xml",
    pdf: "application/pdf", ico: "image/x-icon",
  };
  res.writeHead(200, { "Content-Type": mimeMap[ext ?? ""] ?? "application/octet-stream" });
  res.end(readFileSync(assetPath));
}

let generating = false;

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

  // Serve asset files
  if (url.pathname === "/api/files/download" && url.searchParams.get("raw") === "true") {
    const relPath = url.searchParams.get("relativePath") ?? "";
    const match = relPath.match(/^\.assets\/([^/]+)\/(.+)$/);
    if (match) {
      serveAsset(match[1], match[2], res);
      return;
    }
  }

  // API: generate site
  if (url.pathname === "/api/generate" && req.method === "POST") {
    if (generating) {
      res.writeHead(429, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "Already generating — wait for it to finish" }));
      return;
    }
    generating = true;
    let body = "";
    req.on("data", (c: Buffer) => (body += c));
    req.on("end", async () => {
      try {
        const { url: siteUrl, name, type } = JSON.parse(body);
        const record = await runPipeline(siteUrl, name, type);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, domain: record.domain, qa_score: record.qa_score }));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: String(err) }));
      } finally {
        generating = false;
      }
    });
    return;
  }

  // Serve generated site
  if (url.pathname.startsWith("/site/")) {
    const domain = url.pathname.slice(6);
    const htmlPath = join(GENERATED_DIR, `${domain}.html`);
    if (existsSync(htmlPath)) {
      // Rewrite asset URLs to be absolute for the preview server
      let html = readFileSync(htmlPath, "utf-8");
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
      return;
    }
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Site not found");
    return;
  }

  // Index page
  const sites = listGeneratedSites();
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(renderIndex(sites));
});

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  if (!existsSync(GENERATED_DIR)) mkdirSync(GENERATED_DIR, { recursive: true });

  // If --url provided, generate immediately
  if (inputUrl && inputName) {
    await runPipeline(inputUrl, inputName, inputType);
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`\n🌐 Preview server running at:`);
    console.log(`   http://localhost:${PORT}`);
    console.log(`   http://pi400.local:${PORT}  (from your Mac)`);
    console.log(`\n   Open in browser to view generated sites.`);
    console.log(`   Use the web form or --url flag to generate new ones.\n`);
  });
}

main().catch(console.error);
