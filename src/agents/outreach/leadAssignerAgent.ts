/**
 * Lead Assigner Agent — automatically assigns qualified leads to salespeople.
 *
 * Runs after the qualifier in the pipeline DAG. Matches leads to the nearest
 * available salesperson by postcode, with load balancing and deduplication.
 *
 * Guarantees:
 *   - No lead is assigned to multiple salespeople (UNIQUE index + transaction)
 *   - Leads go to the nearest salesperson by postcode
 *   - Idempotent — running twice on the same leads is safe
 *   - Unmatched leads go to an unassigned pool for admin manual assignment
 */

import { randomUUID } from "node:crypto";
import { AgentHandler } from "../../pipeline/agentRuntime.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface QualifiedLead {
  lead_id?: string;
  business_name: string;
  business_type?: string;
  address?: string;
  postcode?: string;
  phone?: string;
  email?: string;
  google_rating?: number;
  google_review_count?: number;
  qualification_score?: number;
  // Enriched fields from upstream pipeline agents
  has_website?: boolean;
  website_url?: string;
  description?: string;
  opening_hours?: string[];
  services?: string[];
  best_reviews?: Array<{ author?: string; rating?: number; text?: string }>;
  brand_colours?: string[];
  logo_filename?: string;
  gallery_filenames?: string[];
  trust_badges?: string[];
  avoid_topics?: string[];
  hero_headline?: string;
  cta_text?: string;
  pain_points?: string[];
  // Brand intelligence
  brand_tone?: string;
  brand_personality?: string;
  usps?: string[];
  // Demo site
  demo_site_html?: string;
  demo_site_domain?: string;
  demo_site_qa_score?: number;
  // Instagram
  instagram_handle?: string;
  instagram_followers?: number;
}

interface SalesCandidate {
  id: string;
  name: string;
  area_postcode: string | null;
  area_postcodes_json: string | null;
  max_active_leads: number;
  active_lead_count: number;
  last_active_at: string | null;
  user_status: string;
  commission_rate: number;
}

interface AssignmentResult {
  lead_id: string;
  business_name: string;
  assigned_to: string | null;
  salesperson_name: string | null;
  reason: string;
}

// ---------------------------------------------------------------------------
// Postcode utilities
// ---------------------------------------------------------------------------

/** Extract the outward code from a UK postcode (e.g. "M4 1HN" → "M4", "SW1A 2AA" → "SW1A") */
function extractOutwardCode(postcode: string | undefined | null): string | null {
  if (!postcode) return null;
  const clean = postcode.trim().toUpperCase();
  // UK postcode: outward code is everything before the space
  const spaceIdx = clean.indexOf(" ");
  if (spaceIdx > 0) return clean.slice(0, spaceIdx);
  // No space — try removing last 3 chars (inward code is always 3)
  if (clean.length >= 5) return clean.slice(0, -3).trim();
  return clean;
}

/** Extract the area code (letter prefix) from a postcode (e.g. "M4" → "M", "SW1A" → "SW") */
function extractAreaCode(outward: string): string {
  const match = outward.match(/^([A-Z]+)/);
  return match?.[1] ?? outward;
}

/** Score how close two postcodes are (higher = closer) */
function postcodeProximityScore(leadOutward: string | null, candidatePostcodes: string[]): number {
  if (!leadOutward || candidatePostcodes.length === 0) return 0;

  const leadArea = extractAreaCode(leadOutward);

  for (const cp of candidatePostcodes) {
    const cpOutward = extractOutwardCode(cp) ?? cp.toUpperCase();

    // Exact outward code match (e.g. "M4" === "M4")
    if (cpOutward === leadOutward) return 10;

    // Same area code (e.g. "M4" and "M3" both in "M")
    if (extractAreaCode(cpOutward) === leadArea) return 5;
  }

  return 0;
}

// ---------------------------------------------------------------------------
// Assignment logic
// ---------------------------------------------------------------------------

function scoreCandidate(
  candidate: SalesCandidate,
  leadOutward: string | null,
  _leadType: string | null,
): number {
  let score = 0;

  // Postcode proximity (0-10)
  const postcodes: string[] = [];
  if (candidate.area_postcode) postcodes.push(candidate.area_postcode);
  if (candidate.area_postcodes_json) {
    try {
      const parsed = JSON.parse(candidate.area_postcodes_json) as string[];
      postcodes.push(...parsed);
    } catch { /* ignore bad JSON */ }
  }
  score += postcodeProximityScore(leadOutward, postcodes);

  // Load balancing — fewer active leads = higher score (0-3)
  const capacityRatio = candidate.active_lead_count / Math.max(candidate.max_active_leads, 1);
  score += Math.round((1 - capacityRatio) * 3);

  // Activity recency — active workers get priority (0-2)
  if (candidate.last_active_at) {
    const hoursSinceActive = (Date.now() - new Date(candidate.last_active_at).getTime()) / (1000 * 60 * 60);
    if (hoursSinceActive < 24) score += 2;
    else if (hoursSinceActive < 72) score += 1;
  }

  return score;
}

// ---------------------------------------------------------------------------
// Agent Handler
// ---------------------------------------------------------------------------

export const leadAssignerAgent: AgentHandler = async (input) => {
  const upstream = input.upstreamArtifacts as Record<string, Record<string, unknown>>;

  // Collect qualified leads from upstream nodes
  // The assigner runs last in the pipeline so it has access to all upstream data
  const leads: QualifiedLead[] = [];
  for (const nodeOutput of Object.values(upstream)) {
    if (!nodeOutput || typeof nodeOutput !== "object") continue;
    // Skip internal fields
    if (nodeOutput._workingMemory || nodeOutput._strategyContext || nodeOutput._criticFeedback) continue;
    const arr = (nodeOutput.qualified ?? nodeOutput.leads ?? nodeOutput.profiles) as QualifiedLead[] | undefined;
    if (Array.isArray(arr)) leads.push(...arr);
  }

  // ── Enrich leads with data from upstream pipeline nodes ──
  // Upstream artifacts contain arrays keyed by node type:
  //   profiles: [{lead_id, services, opening_hours, ...}]
  //   analyses: [{lead_id, colours: {primary, ...}, fonts, ...}]
  //   intelligence: [{lead_id, tone, personality, usps, headline, ...}]
  //   sites: [{lead_id, html, ...}]
  //   results: [{lead_id, score, ...}]
  // Build lookup maps by lead_id, then merge into each lead.

  type AnyRecord = Record<string, unknown>;
  const profileMap = new Map<string, AnyRecord>();
  const brandMap = new Map<string, AnyRecord>();
  const intelMap = new Map<string, AnyRecord>();
  const siteMap = new Map<string, AnyRecord>();
  const qaMap = new Map<string, AnyRecord>();

  for (const nodeData of Object.values(upstream)) {
    if (!nodeData || typeof nodeData !== "object") continue;
    // Profiler: profiles array
    const profiles = (nodeData as AnyRecord).profiles as AnyRecord[] | undefined;
    if (Array.isArray(profiles)) {
      for (const p of profiles) {
        const id = (p.lead_id ?? p.business_name) as string;
        if (id) profileMap.set(id, p);
      }
    }
    // Brand analyser: analyses array
    const analyses = (nodeData as AnyRecord).analyses as AnyRecord[] | undefined;
    if (Array.isArray(analyses)) {
      for (const a of analyses) {
        const id = (a.lead_id ?? a.business_name) as string;
        if (id) brandMap.set(id, a);
      }
    }
    // Brand intelligence: intelligence array
    const intelligence = (nodeData as AnyRecord).intelligence as AnyRecord[] | undefined;
    if (Array.isArray(intelligence)) {
      for (const i of intelligence) {
        const id = (i.lead_id ?? i.business_name) as string;
        if (id) intelMap.set(id, i);
      }
    }
    // Site composer: sites array
    const sites = (nodeData as AnyRecord).sites as AnyRecord[] | undefined;
    if (Array.isArray(sites)) {
      for (const s of sites) {
        const id = (s.lead_id ?? s.business_name) as string;
        if (id) siteMap.set(id, s);
      }
    }
    // QA: results array
    const results = (nodeData as AnyRecord).results as AnyRecord[] | undefined;
    if (Array.isArray(results)) {
      for (const r of results) {
        const id = (r.lead_id ?? r.business_name) as string;
        if (id) qaMap.set(id, r);
      }
    }
  }

  for (const lead of leads) {
    const id = lead.lead_id ?? lead.business_name;

    // Merge profiler data — profiler uses _json suffix for serialised arrays
    const profile = profileMap.get(id);
    if (profile) {
      const parseJsonField = (val: unknown): unknown[] | undefined => {
        if (Array.isArray(val)) return val;
        if (typeof val === "string") { try { return JSON.parse(val); } catch { return undefined; } }
        return undefined;
      };
      if (!lead.opening_hours) lead.opening_hours = parseJsonField(profile.opening_hours_json ?? profile.opening_hours) as string[] | undefined;
      if (!lead.services) lead.services = parseJsonField(profile.services_extracted_json ?? profile.services) as string[] | undefined;
      if (!lead.best_reviews) lead.best_reviews = parseJsonField(profile.reviews_json ?? profile.best_reviews) as Array<{ author?: string; rating?: number; text?: string }> | undefined;
      if (!lead.pain_points) lead.pain_points = parseJsonField(profile.pain_points_json ?? profile.pain_points) as string[] | undefined;
      if (!lead.trust_badges) lead.trust_badges = parseJsonField(profile.trust_badges) as string[] | undefined;
      if (!lead.avoid_topics) lead.avoid_topics = parseJsonField(profile.avoid_topics) as string[] | undefined;
      if (!lead.has_website && profile.has_website !== undefined) lead.has_website = !!profile.has_website;
      if (!lead.description && profile.business_description_raw) lead.description = profile.business_description_raw as string;
      if (!lead.description && profile.description) lead.description = profile.description as string;
      // Social data
      const socials = parseJsonField(profile.social_profiles_json ?? profile.social_links_json) as Array<string | { handle?: string; followers?: number; platform?: string }> | undefined;
      if (socials) {
        for (const s of socials) {
          if (typeof s === "object" && s !== null) {
            if (!lead.instagram_handle && s.handle) lead.instagram_handle = s.handle;
            if (!lead.instagram_followers && s.followers) lead.instagram_followers = s.followers;
          } else if (typeof s === "string" && s.includes("instagram.com")) {
            const match = s.match(/instagram\.com\/([^/?]+)/);
            if (match && !lead.instagram_handle) lead.instagram_handle = match[1];
          }
        }
      }
    }

    // Merge brand analyser data
    const brand = brandMap.get(id);
    if (brand) {
      const colours = brand.colours as AnyRecord | undefined;
      if (colours && !lead.brand_colours) {
        lead.brand_colours = [
          colours.primary as string,
          colours.secondary as string,
          colours.accent as string,
        ].filter(Boolean);
      }
    }

    // Merge brand intelligence data
    const intel = intelMap.get(id);
    if (intel) {
      if (!lead.brand_tone && intel.tone) lead.brand_tone = intel.tone as string;
      if (!lead.brand_personality && intel.personality) lead.brand_personality = intel.personality as string;
      if (!lead.usps && intel.usps) lead.usps = intel.usps as string[];
      if (!lead.hero_headline && intel.headline) lead.hero_headline = intel.headline as string;
      if (!lead.cta_text && intel.cta) lead.cta_text = intel.cta as string;
    }

    // Merge site composer data
    const site = siteMap.get(id);
    if (site) {
      if (!lead.demo_site_html && site.html) lead.demo_site_html = site.html as string;
      if (!lead.demo_site_domain && site.domain) lead.demo_site_domain = site.domain as string;
    }

    // Merge QA data
    const qa = qaMap.get(id);
    if (qa) {
      if (!lead.demo_site_qa_score && qa.score !== undefined) lead.demo_site_qa_score = qa.score as number;
    }
  }

  if (leads.length === 0) {
    return {
      summary: "No leads to assign.",
      artifacts: { assignments: [], unassigned: [] },
    };
  }

  // We need access to the shared SQLite DB
  // Import dynamically to avoid circular deps with the sales-dashboard app
  let db: ReturnType<typeof import("better-sqlite3")>;
  try {
    const Database = (await import("better-sqlite3")).default;
    const path = await import("node:path");
    const os = await import("node:os");
    const dbPath = process.env.DATABASE_PATH
      ?? path.join(os.homedir(), "klaude-repo", "apps", "mission-control", "mission-control.db");
    db = new Database(dbPath) as any;
    (db as any).pragma("journal_mode = WAL");
    (db as any).pragma("foreign_keys = ON");
  } catch (err) {
    return {
      summary: `Assignment failed — could not open database: ${err}`,
      artifacts: { assignments: [], unassigned: leads.map((l) => l.lead_id ?? l.business_name) },
    };
  }

  const results: AssignmentResult[] = [];
  const unassigned: string[] = [];
  let assignedCount = 0;
  let skippedCount = 0;

  const now = new Date().toISOString();

  for (const lead of leads) {
    const leadId = lead.lead_id ?? `lead-${lead.business_name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    const leadOutward = extractOutwardCode(lead.postcode ?? lead.address);

    // 1. Check if already assigned (idempotent)
    const existing = (db as any).prepare(
      "SELECT id, user_id FROM lead_assignments WHERE lead_id = ? AND status NOT IN ('rejected')"
    ).get(leadId) as { id: string; user_id: string } | undefined;

    if (existing) {
      skippedCount++;
      results.push({
        lead_id: leadId,
        business_name: lead.business_name,
        assigned_to: existing.user_id,
        salesperson_name: null,
        reason: "Already assigned",
      });
      continue;
    }

    // 2. Find eligible salespeople
    const candidates = (db as any).prepare(`
      SELECT
        su.id, su.name, su.area_postcode, su.area_postcodes_json,
        COALESCE(su.max_active_leads, 20) as max_active_leads,
        su.last_active_at, su.commission_rate,
        COALESCE(su.user_status, 'available') as user_status,
        (SELECT COUNT(*) FROM lead_assignments la
         WHERE la.user_id = su.id AND la.status IN ('new', 'visited', 'pitched')
        ) as active_lead_count
      FROM sales_users su
      WHERE su.active = 1
        AND COALESCE(su.user_status, 'available') = 'available'
    `).all() as SalesCandidate[];

    // Filter to those under capacity
    const eligible = candidates.filter((c) => c.active_lead_count < c.max_active_leads);

    if (eligible.length === 0) {
      unassigned.push(leadId);
      results.push({
        lead_id: leadId,
        business_name: lead.business_name,
        assigned_to: null,
        salesperson_name: null,
        reason: "No eligible salespeople available",
      });
      continue;
    }

    // 3. Score and rank candidates
    const scored = eligible
      .map((c) => ({ candidate: c, score: scoreCandidate(c, leadOutward, lead.business_type ?? null) }))
      .sort((a, b) => b.score - a.score);

    const best = scored[0];

    // Only assign if there's some area relevance (score > 0) or no area data at all
    if (best.score === 0 && leadOutward) {
      // No area match at all — send to unassigned pool
      unassigned.push(leadId);
      results.push({
        lead_id: leadId,
        business_name: lead.business_name,
        assigned_to: null,
        salesperson_name: null,
        reason: `No salesperson covers area ${leadOutward}`,
      });
      continue;
    }

    // 4. Assign (atomic transaction)
    try {
      const assignId = randomUUID();
      const activityId = randomUUID();

      const notesJson = JSON.stringify({
        // Core business info
        business_name: lead.business_name,
        business_type: lead.business_type,
        postcode: lead.postcode ?? extractOutwardCode(lead.address),
        phone: lead.phone,
        email: lead.email,
        address: lead.address,
        has_website: lead.has_website,
        website_url: lead.website_url,
        description: lead.description,
        // Google data
        google_rating: lead.google_rating,
        google_review_count: lead.google_review_count,
        best_reviews: lead.best_reviews,
        // Business details
        opening_hours: lead.opening_hours,
        services: lead.services,
        pain_points: lead.pain_points,
        // Brand data
        brand_colours: lead.brand_colours,
        logo_filename: lead.logo_filename,
        gallery_filenames: lead.gallery_filenames,
        // Brand intelligence
        brand_tone: lead.brand_tone,
        brand_personality: lead.brand_personality,
        usps: lead.usps,
        hero_headline: lead.hero_headline,
        cta_text: lead.cta_text,
        // Pitch helpers
        trust_badges: lead.trust_badges,
        avoid_topics: lead.avoid_topics,
        // Demo site
        demo_site_html: lead.demo_site_html,
        demo_site_domain: lead.demo_site_domain,
        demo_site_qa_score: lead.demo_site_qa_score,
        // Social
        instagram_handle: lead.instagram_handle,
        instagram_followers: lead.instagram_followers,
        // Qualification
        qualification_score: lead.qualification_score,
      });

      (db as any).transaction(() => {
        // Double-check uniqueness inside transaction
        const doubleCheck = (db as any).prepare(
          "SELECT id FROM lead_assignments WHERE lead_id = ? AND status NOT IN ('rejected')"
        ).get(leadId);
        if (doubleCheck) throw new Error("ALREADY_ASSIGNED");

        (db as any).prepare(`
          INSERT INTO lead_assignments (id, lead_id, user_id, status, assigned_at, notes, created_at, updated_at)
          VALUES (?, ?, ?, 'new', ?, ?, ?, ?)
        `).run(assignId, leadId, best.candidate.id, now, notesJson, now, now);

        (db as any).prepare(`
          INSERT INTO sales_activity_log (id, user_id, lead_id, assignment_id, action, notes, created_at)
          VALUES (?, ?, ?, ?, 'auto_assigned', ?, ?)
        `).run(activityId, best.candidate.id, leadId, assignId,
          `Auto-assigned to ${best.candidate.name} (score: ${best.score}, area: ${leadOutward ?? "unknown"})`, now);
      })();

      assignedCount++;
      results.push({
        lead_id: leadId,
        business_name: lead.business_name,
        assigned_to: best.candidate.id,
        salesperson_name: best.candidate.name,
        reason: `Assigned (score: ${best.score})`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === "ALREADY_ASSIGNED") {
        skippedCount++;
        results.push({
          lead_id: leadId,
          business_name: lead.business_name,
          assigned_to: null,
          salesperson_name: null,
          reason: "Race condition — already assigned by another process",
        });
      } else {
        unassigned.push(leadId);
        results.push({
          lead_id: leadId,
          business_name: lead.business_name,
          assigned_to: null,
          salesperson_name: null,
          reason: `Assignment failed: ${msg}`,
        });
      }
    }
  }

  (db as any).close();

  return {
    summary: `Processed ${leads.length} leads: ${assignedCount} assigned, ${skippedCount} already assigned, ${unassigned.length} unassigned.`,
    artifacts: {
      assignments: results,
      unassigned,
      assigned_count: assignedCount,
      skipped_count: skippedCount,
      unassigned_count: unassigned.length,
    },
  };
};
