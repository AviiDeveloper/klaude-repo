/**
 * Brand Analyser Agent
 *
 * Runs after the profiler. Takes scraped assets + profile data and produces
 * a consolidated brand analysis: colours, fonts, description, services,
 * categorised photo inventory.
 */

import { AgentHandler } from "../../pipeline/agentRuntime.js";
import {
  getManifest,
  extractDominantColours,
  listAssets,
  type AssetMetadata,
  type AssetCategory,
} from "../../lib/assetStore.js";
import type { ProfileResult } from "./leadProfilerAgent.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BrandColours {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
  palette_source: "scraped_css" | "logo_dominant" | "vertical_default";
}

export interface BrandFonts {
  heading: string;
  body: string;
  source: "scraped" | "default";
}

export interface PhotoInventoryItem {
  path: string;
  filename: string;
  category: AssetCategory;
  usable_for: Array<"hero" | "gallery" | "logo" | "background" | "team">;
  width?: number;
  height?: number;
  size_bytes?: number;
}

export interface BrandAnalysis {
  lead_id: string;
  colours: BrandColours;
  fonts: BrandFonts;
  description: string;
  services: string[];
  photo_inventory: PhotoInventoryItem[];
  logo_path?: string;
  has_sufficient_assets: boolean;
  menu_items?: Array<{ name: string; price?: string; description?: string }>;
}

// ---------------------------------------------------------------------------
// Vertical defaults (fallback)
// ---------------------------------------------------------------------------

const VERTICAL_COLOUR_DEFAULTS: Record<string, Omit<BrandColours, "palette_source">> = {
  trades:       { primary: "#2563eb", secondary: "#1e40af", accent: "#f59e0b", background: "#ffffff", text: "#1f2937" },
  food:         { primary: "#dc2626", secondary: "#b91c1c", accent: "#f59e0b", background: "#ffffff", text: "#1f2937" },
  health:       { primary: "#7c3aed", secondary: "#6d28d9", accent: "#a78bfa", background: "#ffffff", text: "#1f2937" },
  professional: { primary: "#0f766e", secondary: "#115e59", accent: "#2dd4bf", background: "#ffffff", text: "#1f2937" },
  retail:       { primary: "#ea580c", secondary: "#c2410c", accent: "#fb923c", background: "#ffffff", text: "#1f2937" },
  general:      { primary: "#2563eb", secondary: "#1e40af", accent: "#f59e0b", background: "#ffffff", text: "#1f2937" },
};

const VERTICAL_FONT_DEFAULTS: Record<string, Omit<BrandFonts, "source">> = {
  trades:       { heading: "Inter, sans-serif", body: "Inter, sans-serif" },
  food:         { heading: "Playfair Display, serif", body: "Inter, sans-serif" },
  health:       { heading: "Inter, sans-serif", body: "Inter, sans-serif" },
  professional: { heading: "Inter, sans-serif", body: "Inter, sans-serif" },
  retail:       { heading: "Inter, sans-serif", body: "Inter, sans-serif" },
  general:      { heading: "Inter, sans-serif", body: "Inter, sans-serif" },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function detectVertical(businessType?: string, businessName?: string): string {
  const combined = `${businessType ?? ""} ${businessName ?? ""}`.toLowerCase();
  if (/plumb|electri|build|roof|paint|garden|handyman|joiner|carpenter|fenc/.test(combined)) return "trades";
  if (/restaurant|cafe|coffee|pizza|burger|food|kitchen|bistro|grill|takeaway|bakery|pub|bar/.test(combined)) return "food";
  if (/dentist|doctor|clinic|salon|beauty|spa|barber|physio|chiro|therapy|health/.test(combined)) return "health";
  if (/account|solicit|law|consult|architect|estate agent|financial/.test(combined)) return "professional";
  if (/shop|store|retail|boutique|florist|jewel/.test(combined)) return "retail";
  return "general";
}

function categoriseAsset(asset: AssetMetadata): PhotoInventoryItem {
  const usableFor: PhotoInventoryItem["usable_for"] = [];

  switch (asset.category) {
    case "logo":
    case "favicon":
      usableFor.push("logo");
      break;
    case "hero":
      usableFor.push("hero", "background");
      break;
    case "screenshot":
      // Screenshots are reference only, not directly usable in site
      break;
    case "social":
    case "gallery":
    case "product":
      usableFor.push("gallery");
      // Large social images can be hero candidates
      if (asset.width && asset.width >= 800) usableFor.push("hero");
      break;
    case "team":
      usableFor.push("gallery", "team");
      break;
    case "location":
      usableFor.push("gallery", "background");
      break;
    case "menu":
      // Menu images/PDFs not directly placed in gallery
      break;
  }

  return {
    path: asset.filename,
    filename: asset.filename,
    category: asset.category,
    usable_for: usableFor,
    width: asset.width,
    height: asset.height,
    size_bytes: asset.size_bytes,
  };
}

function deduplicateServices(services: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const s of services) {
    const normalised = s.toLowerCase().trim().replace(/[^a-z0-9 ]/g, "");
    if (!normalised || normalised.length < 3) continue;
    if (seen.has(normalised)) continue;
    seen.add(normalised);
    result.push(s.trim());
  }

  return result.slice(0, 12);
}

function synthesiseDescription(
  profile: ProfileResult,
  vertical: string,
): string {
  if (profile.business_description_raw && profile.business_description_raw.length > 20) {
    return profile.business_description_raw;
  }

  // Generate from available data
  const parts: string[] = [];
  parts.push(`${profile.business_name} is a local ${vertical} business`);

  if (profile.address) parts.push(`based in ${profile.address}`);

  const rating = profile.google_rating;
  const reviews = profile.google_review_count;
  if (rating && reviews && reviews > 3) {
    parts.push(`with a ${rating}-star Google rating from ${reviews} reviews`);
  }

  return parts.join(" ") + ".";
}

// ---------------------------------------------------------------------------
// Agent Handler
// ---------------------------------------------------------------------------

export const brandAnalyserAgent: AgentHandler = async (input) => {
  const upstream = input.upstreamArtifacts as Record<string, { profiles?: ProfileResult[] }>;
  const profiles: ProfileResult[] = [];

  for (const nodeOutput of Object.values(upstream)) {
    if (nodeOutput?.profiles) profiles.push(...nodeOutput.profiles);
  }

  if (profiles.length === 0) {
    return {
      summary: "No profiles to analyse.",
      artifacts: { analyses: [], profiles },
    };
  }

  const analyses: BrandAnalysis[] = [];

  for (const profile of profiles) {
    const leadId = profile.lead_id ?? `lead-${Date.now()}`;
    const vertical = detectVertical(profile.business_type, profile.business_name);

    // --- Colours ---
    let colours: BrandColours;

    // First try: CSS colours from profiler
    const scrapedColours = safeJsonParse<Record<string, string>>(profile.brand_colours_json, {});
    if (scrapedColours.primary && scrapedColours.source !== "default") {
      colours = {
        primary: scrapedColours.primary,
        secondary: scrapedColours.secondary ?? scrapedColours.primary,
        accent: scrapedColours.accent ?? scrapedColours.primary,
        background: scrapedColours.background ?? "#ffffff",
        text: scrapedColours.text ?? "#1f2937",
        palette_source: "scraped_css",
      };
    } else {
      // Second try: dominant colours from logo
      const logoDominant = await extractDominantColours(leadId, "logo.png");
      if (logoDominant) {
        colours = {
          primary: logoDominant.primary,
          secondary: logoDominant.secondary,
          accent: logoDominant.accent,
          background: "#ffffff",
          text: "#1f2937",
          palette_source: "logo_dominant",
        };
      } else {
        // Fallback: vertical defaults
        const defaults = VERTICAL_COLOUR_DEFAULTS[vertical] ?? VERTICAL_COLOUR_DEFAULTS.general;
        colours = { ...defaults, palette_source: "vertical_default" };
      }
    }

    // --- Fonts ---
    const scrapedFonts = safeJsonParse<string[]>(profile.brand_fonts_json, []);
    let fonts: BrandFonts;
    if (scrapedFonts.length > 0) {
      fonts = {
        heading: scrapedFonts[0],
        body: scrapedFonts.length > 1 ? scrapedFonts[1] : scrapedFonts[0],
        source: "scraped",
      };
    } else {
      const defaults = VERTICAL_FONT_DEFAULTS[vertical] ?? VERTICAL_FONT_DEFAULTS.general;
      fonts = { ...defaults, source: "default" };
    }

    // --- Photo inventory ---
    const assets = listAssets(leadId);
    const photoInventory = assets.map(categoriseAsset);

    // --- Services ---
    const extractedServices = safeJsonParse<string[]>(profile.services_extracted_json, []);
    const services = deduplicateServices(extractedServices);

    // --- Description ---
    const description = synthesiseDescription(profile, vertical);

    // --- Menu ---
    const menuItems = profile.menu_items_json
      ? safeJsonParse<Array<{ name: string; price?: string }>>(profile.menu_items_json, [])
      : undefined;

    // --- Sufficient assets check ---
    const hasLogo = photoInventory.some((p) => p.usable_for.includes("logo"));
    const hasUsablePhotos = photoInventory.filter((p) => p.usable_for.length > 0).length;
    const hasSufficientAssets = hasLogo || hasUsablePhotos >= 2;

    analyses.push({
      lead_id: leadId,
      colours,
      fonts,
      description,
      services,
      photo_inventory: photoInventory,
      logo_path: profile.logo_path,
      has_sufficient_assets: hasSufficientAssets,
      menu_items: menuItems,
    });
  }

  const withAssets = analyses.filter((a) => a.has_sufficient_assets).length;
  const withLogo = analyses.filter((a) => a.logo_path).length;
  const cssColours = analyses.filter((a) => a.colours.palette_source === "scraped_css").length;
  const logoColours = analyses.filter((a) => a.colours.palette_source === "logo_dominant").length;

  return {
    summary: `Analysed ${analyses.length} brands. ${withLogo} logos found. ${withAssets} have sufficient assets. Colours: ${cssColours} from CSS, ${logoColours} from logo, ${analyses.length - cssColours - logoColours} defaults.`,
    artifacts: {
      analyses,
      profiles, // pass through for downstream
      analysis_count: analyses.length,
      sufficient_assets_count: withAssets,
    },
  };
};

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function safeJsonParse<T>(json: string | undefined, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}
