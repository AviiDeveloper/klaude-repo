/**
 * Lead Profile Report Generator
 *
 * Generates a self-contained HTML report showing all gathered data per lead.
 * Images embedded as base64 so the file works standalone.
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import Database from "better-sqlite3";

const ASSETS_BASE = join(process.env.PROJECTS_PATH ?? join(homedir(), "projects"), ".assets");

// ---------------------------------------------------------------------------
// Types (mirrors pipeline artifact shapes)
// ---------------------------------------------------------------------------

interface Profile {
  lead_id?: string;
  business_name: string;
  business_type?: string;
  vertical_category?: string;
  phone?: string;
  email?: string;
  address?: string;
  has_website?: number;
  website_quality_score?: number;
  has_ssl?: number;
  is_mobile_friendly?: number;
  logo_path?: string;
  screenshot_path?: string;
  business_description_raw?: string;
  reviews_json?: string;
  opening_hours_json?: string;
  brand_colours_json?: string;
  brand_fonts_json?: string;
  brand_assets_json?: string;
  social_links_json?: string;
  instagram_json?: string;
  google_rating?: number | null;
  google_review_count?: number | null;
  google_photos_downloaded?: number;
  has_premises?: boolean;
  is_chain?: boolean;
  price_level?: number;
  maps_embed_url?: string;
  pain_points_json?: string;
  services_extracted_json?: string;
  menu_items_json?: string;
}

interface BrandAnalysis {
  lead_id: string;
  colours: Record<string, string>;
  fonts: Record<string, string>;
  description: string;
  services: string[];
  photo_inventory: Array<{ filename: string; category: string; usable_for: string[]; width?: number; height?: number; size_bytes?: number }>;
  logo_path?: string;
  has_sufficient_assets: boolean;
}

interface BrandIntelligence {
  lead_id: string;
  tone: string;
  personality: string;
  market_position: string;
  suggested_headline: string;
  suggested_tagline: string;
  suggested_about: string;
  unique_selling_points: string[];
  customer_sentiment: string;
  trust_signals: string[];
  refined_services: Array<{ name: string; description: string }>;
  differentiators: string[];
  voice_examples?: string[];
  common_praise?: string[];
}

interface QualifiedLead {
  lead_id?: string;
  business_name: string;
  qualification_score: number;
  qualification_reasons: string[];
  vertical_category?: string;
}

// ---------------------------------------------------------------------------
// Data loading
// ---------------------------------------------------------------------------

function loadArtifacts(dbPath: string, runId?: string): {
  profiles: Profile[];
  analyses: Map<string, BrandAnalysis>;
  intelligence: Map<string, BrandIntelligence>;
  qualified: Map<string, QualifiedLead>;
  runId: string;
} {
  const db = new Database(dbPath);

  // Find the run
  let targetRunId = runId;
  if (!targetRunId) {
    const row = db.prepare(
      "SELECT id FROM pipeline_runs WHERE status = 'completed' ORDER BY ended_at DESC LIMIT 1",
    ).get() as { id: string } | undefined;
    targetRunId = row?.id;
    if (!targetRunId) throw new Error("No completed pipeline runs found");
  }

  const arts = db.prepare(
    "SELECT node_id, value_json FROM agent_task_artifacts WHERE run_id = ? ORDER BY created_at ASC",
  ).all(targetRunId) as Array<{ node_id: string; value_json: string }>;

  const profiles: Profile[] = [];
  const analyses = new Map<string, BrandAnalysis>();
  const intelligence = new Map<string, BrandIntelligence>();
  const qualified = new Map<string, QualifiedLead>();

  for (const art of arts) {
    const v = JSON.parse(art.value_json);
    if (art.node_id === "profile") {
      profiles.push(...(v.profiles ?? []));
    } else if (art.node_id === "brand-analyse") {
      for (const a of v.analyses ?? []) analyses.set(a.lead_id, a);
    } else if (art.node_id === "brand-intelligence") {
      for (const i of v.intelligence ?? []) intelligence.set(i.lead_id, i);
    } else if (art.node_id === "qualify") {
      for (const q of v.qualified ?? []) qualified.set(q.lead_id ?? q.business_name, q);
    }
  }

  db.close();
  return { profiles, analyses, intelligence, qualified, runId: targetRunId };
}

// ---------------------------------------------------------------------------
// Image embedding
// ---------------------------------------------------------------------------

function embedImage(leadId: string, filename: string): string | null {
  const filePath = join(ASSETS_BASE, leadId, filename);
  if (!existsSync(filePath)) return null;
  try {
    const buf = readFileSync(filePath);
    if (buf.length < 100) return null;
    const ext = filename.split(".").pop()?.toLowerCase() ?? "jpg";
    const mime = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// HTML generation
// ---------------------------------------------------------------------------

function esc(s: string | undefined | null): string {
  return (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function renderColourSwatch(hex: string, label: string): string {
  if (!hex || hex === "undefined") return "";
  return `<div class="swatch"><div class="swatch-color" style="background:${esc(hex)}"></div><span>${esc(label)}: ${esc(hex)}</span></div>`;
}

function renderStars(rating: number): string {
  const full = Math.round(rating);
  return "★".repeat(full) + "☆".repeat(5 - full);
}

function renderLeadCard(
  profile: Profile,
  analysis: BrandAnalysis | undefined,
  intel: BrandIntelligence | undefined,
  qual: QualifiedLead | undefined,
): string {
  const leadId = profile.lead_id ?? "";
  const sections: string[] = [];

  // ── Header ──
  const scoreClass = (qual?.qualification_score ?? 0) >= 50 ? "score-high" : (qual?.qualification_score ?? 0) >= 30 ? "score-mid" : "score-low";
  sections.push(`
    <div class="card-header">
      <div>
        <h2>${esc(profile.business_name)}</h2>
        <span class="badge">${esc(profile.vertical_category ?? profile.business_type ?? "unknown")}</span>
        ${profile.is_chain ? '<span class="badge badge-warn">Chain</span>' : ""}
        ${profile.has_premises ? '<span class="badge badge-ok">Has Premises</span>' : ""}
        ${profile.price_level !== undefined ? `<span class="badge">Price: ${"£".repeat(profile.price_level)}</span>` : ""}
      </div>
      <div class="score ${scoreClass}">${qual?.qualification_score ?? "?"}</div>
    </div>
  `);

  // ── Contact + basics ──
  sections.push(`
    <div class="section">
      <h3>📍 Contact & Location</h3>
      <div class="grid-2">
        <div><strong>Phone:</strong> ${esc(profile.phone) || "<em>none</em>"}</div>
        <div><strong>Email:</strong> ${esc(profile.email) || "<em>none</em>"}</div>
        <div><strong>Address:</strong> ${esc(profile.address)}</div>
        <div><strong>Website:</strong> ${profile.has_website ? `<a href="${esc(profile.business_description_raw)}">${profile.website_quality_score}/100 quality</a>` : "<em>No website</em>"}</div>
        <div><strong>Google:</strong> ${renderStars(profile.google_rating ?? 0)} ${profile.google_rating ?? "?"}/5 (${profile.google_review_count ?? 0} reviews)</div>
        <div><strong>Map:</strong> ${profile.maps_embed_url ? "✅" : "❌"}</div>
      </div>
    </div>
  `);

  // ── Description ──
  if (profile.business_description_raw) {
    sections.push(`
      <div class="section">
        <h3>📝 Description</h3>
        <p class="description">${esc(profile.business_description_raw)}</p>
      </div>
    `);
  }

  // ── Photos ──
  const photos: Array<{ src: string; label: string }> = [];

  // Logo
  if (profile.logo_path) {
    const src = embedImage(leadId, profile.logo_path);
    if (src) photos.push({ src, label: "Logo" });
  }

  // Google photos
  const assets = analysis?.photo_inventory ?? [];
  for (const asset of assets) {
    if (asset.filename.startsWith("google_photo_") || asset.filename.startsWith("instagram_post_") || asset.filename.startsWith("hero_") || asset.filename.startsWith("gallery_")) {
      const src = embedImage(leadId, asset.filename);
      if (src) {
        const label = asset.filename.startsWith("instagram_") ? "IG" :
          asset.filename.startsWith("google_") ? "Google" :
          asset.filename.startsWith("hero_") ? "Hero" : "Gallery";
        photos.push({ src, label: `${label} (${asset.width ?? "?"}×${asset.height ?? "?"})` });
      }
    }
  }

  if (photos.length > 0) {
    sections.push(`
      <div class="section">
        <h3>📷 Photos (${photos.length})</h3>
        <div class="photo-grid">
          ${photos.map((p) => `<div class="photo"><img src="${p.src}" loading="lazy"><span>${esc(p.label)}</span></div>`).join("")}
        </div>
      </div>
    `);
  }

  // ── Instagram ──
  const ig = profile.instagram_json ? JSON.parse(profile.instagram_json) : null;
  if (ig) {
    const posts = ig.recent_posts ?? [];
    sections.push(`
      <div class="section">
        <h3>📸 Instagram @${esc(ig.username)}</h3>
        <div class="grid-2">
          <div><strong>Followers:</strong> ${(ig.followers ?? 0).toLocaleString()}</div>
          <div><strong>Posts:</strong> ${ig.posts_count ?? 0}</div>
          <div><strong>Business:</strong> ${ig.is_business ? "Yes" : "No"} ${ig.category ? `(${esc(ig.category)})` : ""}</div>
          <div><strong>Avg engagement:</strong> ${ig.avg_engagement?.avg_likes ?? 0} likes</div>
        </div>
        <p class="description"><strong>Bio:</strong> ${esc(ig.bio)}</p>
        ${ig.top_hashtags?.length ? `<p><strong>Top hashtags:</strong> ${ig.top_hashtags.map((t: {tag: string}) => `#${esc(t.tag)}`).join(" ")}</p>` : ""}
        ${posts.length > 0 ? `
          <div class="ig-posts">
            ${posts.slice(0, 6).map((p: { caption?: string; likes?: number; comments?: number }) => `
              <div class="ig-post">
                <p>${esc((p.caption ?? "").slice(0, 120))}${(p.caption ?? "").length > 120 ? "…" : ""}</p>
                <small>❤️ ${p.likes ?? 0} · 💬 ${p.comments ?? 0}</small>
              </div>
            `).join("")}
          </div>
        ` : ""}
      </div>
    `);
  }

  // ── Brand Analysis ──
  if (analysis) {
    const c = analysis.colours ?? {};
    sections.push(`
      <div class="section">
        <h3>🎨 Brand Analysis</h3>
        <div class="swatches">
          ${renderColourSwatch(c.primary, "Primary")}
          ${renderColourSwatch(c.secondary, "Secondary")}
          ${renderColourSwatch(c.accent, "Accent")}
          ${renderColourSwatch(c.background, "BG")}
          ${renderColourSwatch(c.text, "Text")}
        </div>
        <p><strong>Palette source:</strong> ${esc(c.palette_source)}</p>
        <p><strong>Fonts:</strong> ${esc(analysis.fonts?.heading)} / ${esc(analysis.fonts?.body)} (${esc(analysis.fonts?.source)})</p>
        <p><strong>Assets:</strong> ${analysis.photo_inventory?.length ?? 0} items | ${analysis.has_sufficient_assets ? "✅ Sufficient" : "⚠️ Insufficient"}</p>
        ${analysis.services?.length ? `<p><strong>Services:</strong> ${analysis.services.map((s) => esc(s)).join(", ")}</p>` : ""}
        ${(analysis as unknown as Record<string, unknown>).photo_palette ? (() => {
          const pp = (analysis as unknown as Record<string, unknown>).photo_palette as { colours: Array<{ hex: string; frequency: number; sources: string[] }>; photos_analysed: number; suggested: { primary: string; secondary: string; accent: string } };
          return `
            <div style="margin-top:12px">
              <strong>📸 Photo Colour Analysis (${pp.photos_analysed} photos):</strong>
              <div class="swatches" style="margin-top:6px">
                ${pp.colours.slice(0, 8).map((c) => `
                  <div class="swatch">
                    <div class="swatch-color" style="background:${esc(c.hex)};width:32px;height:32px"></div>
                    <span>${esc(c.hex)}<br><small>${(c.frequency * 100).toFixed(1)}% · ${c.sources.length} photos</small></span>
                  </div>
                `).join("")}
              </div>
              <p style="margin-top:6px"><strong>Suggested from photos:</strong></p>
              <div class="swatches">
                ${renderColourSwatch(pp.suggested.primary, "Primary")}
                ${renderColourSwatch(pp.suggested.secondary, "Secondary")}
                ${renderColourSwatch(pp.suggested.accent, "Accent")}
              </div>
            </div>
          `;
        })() : ""}
      </div>
    `);
  }

  // ── Brand Intelligence (AI) ──
  if (intel) {
    sections.push(`
      <div class="section ai-section">
        <h3>🧠 Brand Intelligence (AI)</h3>
        <div class="grid-2">
          <div><strong>Tone:</strong> ${esc(intel.tone)}</div>
          <div><strong>Personality:</strong> ${esc(intel.personality)}</div>
          <div><strong>Market position:</strong> <span class="badge">${esc(intel.market_position)}</span></div>
          <div><strong>Sentiment:</strong> ${esc(intel.customer_sentiment)}</div>
        </div>
        <div class="ai-copy">
          <p><strong>Headline:</strong> "${esc(intel.suggested_headline)}"</p>
          <p><strong>Tagline:</strong> "${esc(intel.suggested_tagline)}"</p>
          <p><strong>About:</strong> "${esc(intel.suggested_about)}"</p>
        </div>
        <div class="grid-2">
          <div>
            <strong>USPs:</strong>
            <ul>${intel.unique_selling_points.map((u) => `<li>${esc(u)}</li>`).join("")}</ul>
          </div>
          <div>
            <strong>Trust Signals:</strong>
            <ul>${intel.trust_signals.map((t) => `<li>🏅 ${esc(t)}</li>`).join("")}</ul>
          </div>
        </div>
        <div>
          <strong>Services:</strong>
          <ul>${intel.refined_services.map((s) => `<li><strong>${esc(s.name)}:</strong> ${esc(s.description)}</li>`).join("")}</ul>
        </div>
        ${intel.differentiators?.length ? `<p><strong>Differentiators:</strong> ${intel.differentiators.map((d) => esc(d)).join(" · ")}</p>` : ""}
      </div>
    `);
  }

  // ── Reviews ──
  const reviews = profile.reviews_json ? JSON.parse(profile.reviews_json) : [];
  if (reviews.length > 0) {
    sections.push(`
      <div class="section">
        <h3>⭐ Reviews (${reviews.length})</h3>
        ${reviews.slice(0, 5).map((r: { rating?: number; text?: string; author?: string }) => `
          <div class="review">
            <div class="review-rating">${renderStars(r.rating ?? 5)}</div>
            <p>${esc((r.text ?? "").slice(0, 250))}${(r.text ?? "").length > 250 ? "…" : ""}</p>
            ${r.author ? `<small>— ${esc(r.author)}</small>` : ""}
          </div>
        `).join("")}
      </div>
    `);
  }

  // ── Qualification ──
  if (qual) {
    sections.push(`
      <div class="section">
        <h3>📊 Qualification (Score: ${qual.qualification_score})</h3>
        <ul>${qual.qualification_reasons.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>
      </div>
    `);
  }

  // ── Opening Hours ──
  const hours = profile.opening_hours_json ? JSON.parse(profile.opening_hours_json) : [];
  if (hours.length > 0) {
    sections.push(`
      <div class="section">
        <h3>🕐 Opening Hours</h3>
        <ul class="hours">${hours.map((h: string) => `<li>${esc(h)}</li>`).join("")}</ul>
      </div>
    `);
  }

  return `<div class="lead-card">${sections.join("")}</div>`;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function generateLeadReport(runId?: string, dbPath = "data/mvp.sqlite"): string {
  const data = loadArtifacts(dbPath, runId);
  const cards = data.profiles.map((p) => {
    const leadId = p.lead_id ?? "";
    return renderLeadCard(
      p,
      data.analyses.get(leadId),
      data.intelligence.get(leadId),
      data.qualified.get(leadId) ?? data.qualified.get(p.business_name),
    );
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Lead Profile Report — ${esc(data.runId.slice(0, 8))}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; background: #0a0a0a; color: #e0e0e0; padding: 20px; }
  h1 { font-size: 1.8rem; margin-bottom: 8px; color: #fff; }
  .subtitle { color: #888; margin-bottom: 24px; }
  .lead-card { background: #151515; border: 1px solid #2a2a2a; border-radius: 12px; margin-bottom: 24px; overflow: hidden; }
  .card-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; background: #1a1a1a; border-bottom: 1px solid #2a2a2a; }
  .card-header h2 { font-size: 1.3rem; color: #fff; margin-bottom: 4px; }
  .score { font-size: 2rem; font-weight: 800; min-width: 60px; text-align: center; padding: 8px 12px; border-radius: 8px; }
  .score-high { background: #065f46; color: #34d399; }
  .score-mid { background: #78350f; color: #fbbf24; }
  .score-low { background: #7f1d1d; color: #f87171; }
  .badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 0.75rem; background: #2563eb22; color: #60a5fa; border: 1px solid #2563eb44; margin-right: 4px; }
  .badge-warn { background: #f59e0b22; color: #fbbf24; border-color: #f59e0b44; }
  .badge-ok { background: #10b98122; color: #34d399; border-color: #10b98144; }
  .section { padding: 16px 20px; border-top: 1px solid #1f1f1f; }
  .section h3 { font-size: 1rem; color: #aaa; margin-bottom: 10px; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 16px; }
  .description { color: #ccc; line-height: 1.5; font-style: italic; }
  .photo-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 8px; }
  .photo { position: relative; border-radius: 6px; overflow: hidden; background: #1a1a1a; }
  .photo img { width: 100%; height: 120px; object-fit: cover; display: block; }
  .photo span { position: absolute; bottom: 0; left: 0; right: 0; font-size: 0.65rem; background: #000a; color: #aaa; padding: 2px 6px; }
  .swatches { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 8px; }
  .swatch { display: flex; align-items: center; gap: 6px; font-size: 0.8rem; }
  .swatch-color { width: 24px; height: 24px; border-radius: 4px; border: 1px solid #444; }
  .ai-section { background: #0f172a; }
  .ai-copy { background: #1e293b; padding: 12px; border-radius: 8px; margin: 10px 0; }
  .ai-copy p { margin-bottom: 6px; line-height: 1.5; }
  .review { padding: 8px 0; border-bottom: 1px solid #1f1f1f; }
  .review:last-child { border-bottom: none; }
  .review-rating { color: #fbbf24; margin-bottom: 4px; }
  .review p { color: #ccc; line-height: 1.4; }
  .review small { color: #888; }
  .hours { list-style: none; }
  .hours li { padding: 2px 0; font-size: 0.9rem; }
  .ig-posts { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px; }
  .ig-post { background: #1a1a2e; padding: 8px; border-radius: 6px; }
  .ig-post p { font-size: 0.85rem; line-height: 1.3; margin-bottom: 4px; }
  .ig-post small { color: #888; }
  ul { padding-left: 18px; }
  li { margin-bottom: 4px; line-height: 1.4; }
  a { color: #60a5fa; }
  strong { color: #ddd; }
  @media (max-width: 768px) { .grid-2 { grid-template-columns: 1fr; } .photo-grid { grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); } }
</style>
</head>
<body>
  <h1>Lead Profile Report</h1>
  <p class="subtitle">Run: ${esc(data.runId)} · ${data.profiles.length} leads profiled</p>
  ${cards.join("\n")}
</body>
</html>`;
}
