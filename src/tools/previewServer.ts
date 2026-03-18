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
  qa_issues: Array<{ severity: string; category: string; message: string }>;
  brand_source: string;
  brand_colours: Record<string, string> | null;
  brand_fonts: Record<string, string> | null;
  brand_description: string;
  brand_services: string[];
  assets_count: number;
  assets: Array<{ filename: string; category: string; size_bytes?: number; width?: number; height?: number }>;
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
    qa_issues: qa.issues ?? [],
    brand_source: site.brand_source ?? "unknown",
    brand_colours: analysis?.colours ?? null,
    brand_fonts: analysis?.fonts ?? null,
    brand_description: analysis?.description ?? "",
    brand_services: analysis?.services ?? [],
    assets_count: listAssets(leadId).length,
    assets: listAssets(leadId).map((a: any) => ({
      filename: a.filename,
      category: a.category,
      size_bytes: a.size_bytes,
      width: a.width,
      height: a.height,
    })),
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
        <td><a href="/detail/${s.domain}"><strong>${esc(s.business_name)}</strong></a></td>
        <td>${esc(s.vertical)}</td>
        <td>${s.brand_source}</td>
        <td>${s.assets_count} files</td>
        <td style="color: ${s.qa_passed ? "#16a34a" : "#dc2626"}">${s.qa_score}/100 ${s.qa_passed ? "✅" : "❌"}</td>
        <td>${new Date(s.generated_at).toLocaleString()}</td>
        <td><a href="/site/${s.domain}" target="_blank">View Site</a></td>
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
    <thead><tr><th>Business</th><th>Vertical</th><th>Brand Source</th><th>Assets</th><th>QA Score</th><th>Generated</th><th></th></tr></thead>
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

function renderDetail(s: GeneratedSiteRecord): string {
  const assetUrl = (filename: string) =>
    `/api/files/download?relativePath=.assets/${encodeURIComponent(s.lead_id)}/${encodeURIComponent(filename)}&raw=true`;

  // Group assets by category
  const screenshots = s.assets.filter((a) => a.category === "screenshot");
  const logos = s.assets.filter((a) => a.category === "logo" || a.category === "favicon");
  const socialAssets = s.assets.filter((a) => a.category === "social");
  const heroAssets = s.assets.filter((a) => a.category === "hero");
  const galleryAssets = s.assets.filter((a) => a.category === "gallery" || a.category === "product");
  const otherAssets = s.assets.filter((a) =>
    !["screenshot", "logo", "favicon", "social", "hero", "gallery", "product"].includes(a.category),
  );

  const renderAssetGrid = (assets: typeof s.assets, label: string) => {
    if (assets.length === 0) return "";
    return `
      <h3>${label}</h3>
      <div class="asset-grid">
        ${assets.map((a) => `
          <div class="asset-card">
            <img src="${assetUrl(a.filename)}" alt="${esc(a.filename)}" loading="lazy">
            <div class="asset-meta">
              <span class="asset-name">${esc(a.filename)}</span>
              <span class="asset-size">${a.size_bytes ? `${(a.size_bytes / 1024).toFixed(0)}KB` : ""}${a.width ? ` ${a.width}x${a.height}` : ""}</span>
            </div>
          </div>
        `).join("")}
      </div>`;
  };

  const colourSwatches = s.brand_colours
    ? Object.entries(s.brand_colours)
        .filter(([k, v]) => v && k !== "palette_source")
        .map(([k, v]) => `<div class="swatch"><div class="swatch-color" style="background:${v}"></div><span>${k}: ${v}</span></div>`)
        .join("")
    : '<span style="color:#64748b">No brand colours extracted</span>';

  const qaIssues = (s.qa_issues ?? [])
    .map((i) => `<div class="qa-issue qa-${i.severity}">[${i.severity}/${i.category}] ${esc(i.message)}</div>`)
    .join("") || '<div style="color:#16a34a">No issues found</div>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(s.business_name)} — Detail View</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f172a; color: #e2e8f0; }
    .top-bar { background: #1e293b; padding: 12px 32px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #334155; }
    .top-bar a { color: #60a5fa; text-decoration: none; }
    .top-bar h1 { font-size: 1.3rem; }
    .content { padding: 24px 32px; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }
    .panel { background: #1e293b; border-radius: 8px; padding: 20px; }
    .panel h2 { font-size: 1.1rem; margin-bottom: 16px; color: #94a3b8; text-transform: uppercase; font-size: 0.8rem; letter-spacing: 0.05em; }
    .panel h3 { font-size: 0.95rem; margin: 16px 0 8px; color: #cbd5e1; }
    .asset-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
    .asset-card { background: #0f172a; border-radius: 6px; overflow: hidden; }
    .asset-card img { width: 100%; height: 160px; object-fit: cover; display: block; cursor: pointer; transition: transform 0.2s; }
    .asset-card img:hover { transform: scale(1.02); }
    .asset-meta { padding: 8px; font-size: 0.8rem; }
    .asset-name { display: block; color: #cbd5e1; font-weight: 500; }
    .asset-size { color: #64748b; }
    .swatch { display: inline-flex; align-items: center; gap: 8px; margin: 4px 8px 4px 0; padding: 4px 12px 4px 4px; background: #0f172a; border-radius: 4px; font-size: 0.85rem; }
    .swatch-color { width: 28px; height: 28px; border-radius: 4px; border: 1px solid #475569; }
    .font-sample { font-size: 1.1rem; padding: 8px 12px; background: #0f172a; border-radius: 4px; margin: 4px 0; }
    .services-list { display: flex; flex-wrap: wrap; gap: 6px; }
    .service-tag { background: #334155; padding: 4px 10px; border-radius: 12px; font-size: 0.8rem; }
    .qa-issue { padding: 6px 10px; margin: 4px 0; border-radius: 4px; font-size: 0.85rem; font-family: monospace; }
    .qa-error { background: #450a0a; color: #fca5a5; }
    .qa-warning { background: #451a03; color: #fcd34d; }
    .qa-info { background: #0c2d48; color: #93c5fd; }
    .stat { display: inline-block; margin-right: 20px; margin-bottom: 8px; }
    .stat-value { font-size: 1.5rem; font-weight: 700; }
    .stat-label { font-size: 0.75rem; color: #64748b; text-transform: uppercase; }
    .iframe-wrap { border-radius: 8px; overflow: hidden; border: 2px solid #334155; }
    .iframe-wrap iframe { width: 100%; height: 700px; border: none; background: #fff; }
    .desc-text { color: #94a3b8; font-size: 0.9rem; line-height: 1.5; max-height: 80px; overflow: hidden; }
    .full-width { grid-column: 1 / -1; }
    @media (max-width: 900px) { .grid-2 { grid-template-columns: 1fr; } }

    /* Lightbox */
    .lightbox { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.9); z-index: 1000; justify-content: center; align-items: center; cursor: pointer; }
    .lightbox.active { display: flex; }
    .lightbox img { max-width: 95vw; max-height: 95vh; object-fit: contain; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="top-bar">
    <h1>${esc(s.business_name)}</h1>
    <div>
      <a href="/">← Back to Index</a> &nbsp; | &nbsp;
      <a href="/site/${s.domain}" target="_blank">View Generated Site →</a>
    </div>
  </div>

  <div class="content">
    <!-- Stats row -->
    <div class="panel" style="margin-bottom: 24px;">
      <div class="stat"><div class="stat-value" style="color: ${s.qa_passed ? "#16a34a" : "#dc2626"}">${s.qa_score}/100</div><div class="stat-label">QA Score</div></div>
      <div class="stat"><div class="stat-value">${s.assets_count}</div><div class="stat-label">Assets Scraped</div></div>
      <div class="stat"><div class="stat-value">${s.brand_source}</div><div class="stat-label">Colour Source</div></div>
      <div class="stat"><div class="stat-value">${esc(s.vertical)}</div><div class="stat-label">Vertical</div></div>
      <div class="stat"><div class="stat-value">${(s.html.length / 1024).toFixed(1)}KB</div><div class="stat-label">HTML Size</div></div>
    </div>

    <div class="grid-2">
      <!-- Reference screenshots -->
      <div class="panel">
        <h2>Reference Screenshots</h2>
        ${renderAssetGrid(screenshots, "Website & Social Screenshots")}
        ${screenshots.length === 0 ? '<p style="color:#64748b">No screenshots captured</p>' : ""}
      </div>

      <!-- Generated site preview -->
      <div class="panel">
        <h2>Generated Site Preview</h2>
        <div class="iframe-wrap">
          <iframe src="/site/${s.domain}" title="Generated site preview"></iframe>
        </div>
      </div>

      <!-- Brand analysis -->
      <div class="panel">
        <h2>Brand Analysis</h2>
        <h3>Colours</h3>
        <div>${colourSwatches}</div>
        <h3>Fonts</h3>
        ${s.brand_fonts ? `
          <div class="font-sample" style="font-family: ${s.brand_fonts.heading || 'inherit'}">Heading: ${esc(s.brand_fonts.heading || "default")} (${s.brand_fonts.source || "default"})</div>
          <div class="font-sample" style="font-family: ${s.brand_fonts.body || 'inherit'}">Body: ${esc(s.brand_fonts.body || "default")}</div>
        ` : '<p style="color:#64748b">No fonts detected</p>'}
        <h3>Description</h3>
        <p class="desc-text">${esc(s.brand_description || "No description extracted")}</p>
        <h3>Services</h3>
        <div class="services-list">
          ${s.brand_services.length > 0 ? s.brand_services.map((sv) => `<span class="service-tag">${esc(sv)}</span>`).join("") : '<span style="color:#64748b">None extracted</span>'}
        </div>
      </div>

      <!-- QA Results -->
      <div class="panel">
        <h2>QA Results</h2>
        ${qaIssues}
      </div>

      <!-- All scraped assets -->
      <div class="panel full-width">
        <h2>All Scraped Assets</h2>
        ${renderAssetGrid(logos, "Logos & Favicons")}
        ${renderAssetGrid(heroAssets, "Hero Images")}
        ${renderAssetGrid(socialAssets, "Social Media")}
        ${renderAssetGrid(galleryAssets, "Gallery / Product")}
        ${renderAssetGrid(otherAssets, "Other")}
        ${s.assets.length === 0 ? '<p style="color:#64748b">No assets were scraped</p>' : ""}
      </div>
    </div>
  </div>

  <!-- Lightbox for clicking images -->
  <div class="lightbox" id="lightbox" onclick="this.classList.remove('active')">
    <img id="lightbox-img" src="" alt="Preview">
  </div>
  <script>
    document.querySelectorAll('.asset-card img').forEach(img => {
      img.addEventListener('click', () => {
        document.getElementById('lightbox-img').src = img.src;
        document.getElementById('lightbox').classList.add('active');
      });
    });
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

  // Favicon — ignore
  if (url.pathname === "/favicon.ico") {
    res.writeHead(204);
    res.end();
    return;
  }

  // Serve asset files
  if (url.pathname === "/api/files/download") {
    const relPath = url.searchParams.get("relativePath") ?? "";
    const match = relPath.match(/^\.assets\/([^/]+)\/(.+)$/);
    if (match) {
      serveAsset(match[1], match[2], res);
      return;
    }
    res.writeHead(404);
    res.end("Asset not found");
    return;
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

  // Detail page (reference screenshots + brand analysis + generated site)
  if (url.pathname.startsWith("/detail/")) {
    const domain = url.pathname.slice(8);
    const jsonPath = join(GENERATED_DIR, `${domain}.json`);
    if (existsSync(jsonPath)) {
      try {
        const raw = JSON.parse(readFileSync(jsonPath, "utf-8"));
        // Backfill missing fields for old records
        const record: GeneratedSiteRecord = {
          lead_id: raw.lead_id ?? "",
          business_name: raw.business_name ?? "Unknown",
          domain: raw.domain ?? domain,
          vertical: raw.vertical ?? "general",
          html: raw.html ?? "",
          qa_score: raw.qa_score ?? 0,
          qa_passed: raw.qa_passed ?? false,
          qa_issues: raw.qa_issues ?? [],
          brand_source: raw.brand_source ?? "unknown",
          brand_colours: raw.brand_colours ?? null,
          brand_fonts: raw.brand_fonts ?? null,
          brand_description: raw.brand_description ?? "",
          brand_services: raw.brand_services ?? [],
          assets_count: raw.assets_count ?? 0,
          assets: raw.assets ?? (raw.lead_id ? listAssets(raw.lead_id).map((a: any) => ({
            filename: a.filename, category: a.category, size_bytes: a.size_bytes, width: a.width, height: a.height,
          })) : []),
          generated_at: raw.generated_at ?? "",
        };
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(renderDetail(record));
        return;
      } catch { /* fall through */ }
    }
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Site not found");
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
