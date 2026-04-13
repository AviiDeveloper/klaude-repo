/**
 * Design Intelligence — reads industry-specific UI/UX rules from CSV databases
 * and generates design context for the AI composer.
 *
 * Based on the UI/UX Pro Max skill data (161 industry rules, 67 styles,
 * 161 colour palettes, 34 landing page patterns).
 *
 * This replaces generic "make it look good" prompts with specific,
 * industry-matched design vocabulary and anti-patterns.
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface IndustryDesignContext {
  /** Industry category matched */
  category: string;
  /** Recommended page pattern (e.g., "Hero-Centric + Social Proof") */
  pattern: string;
  /** Style priority (e.g., "Soft UI Evolution + Neumorphism") */
  stylePriority: string;
  /** Colour mood description */
  colourMood: string;
  /** Typography mood */
  typographyMood: string;
  /** Key CSS effects to use */
  keyEffects: string;
  /** Things to AVOID (anti-patterns) */
  antiPatterns: string;
  /** Landing page section order */
  landingPattern?: string;
  /** Conversion tips */
  conversionTips?: string;
  /** Recommended effects */
  recommendedEffects?: string;
}

// ---------------------------------------------------------------------------
// CSV data paths
// ---------------------------------------------------------------------------

// Resolve relative to this file's compiled location
// In dev: src/agents/outreach/ → data is at src/agents/outreach/design-intelligence/
// We use process.cwd() + known path since import.meta isn't available in CJS
const DATA_DIR = join(process.cwd(), "src", "agents", "outreach", "design-intelligence");

// ---------------------------------------------------------------------------
// CSV parser (simple — no library needed for these well-formed CSVs)
// ---------------------------------------------------------------------------

function parseCSV(filepath: string): Array<Record<string, string>> {
  if (!existsSync(filepath)) return [];

  const content = readFileSync(filepath, "utf-8");
  const lines = content.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];

  // Parse header — handle quoted fields
  const headers = parseCSVLine(lines[0]);
  const rows: Array<Record<string, string>> = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j].trim()] = (values[j] ?? "").trim();
    }
    rows.push(row);
  }

  return rows;
}

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

// ---------------------------------------------------------------------------
// Industry matching
// ---------------------------------------------------------------------------

/** Map business types to UI reasoning categories */
const BUSINESS_TO_CATEGORY: Record<string, string[]> = {
  barber: ["Barber", "Beauty/Spa/Wellness"],
  salon: ["Hair Salon", "Beauty/Spa/Wellness"],
  spa: ["Beauty/Spa/Wellness"],
  beauty: ["Beauty/Spa/Wellness"],
  restaurant: ["Restaurant/Food Service"],
  cafe: ["Bakery/Cafe", "Restaurant/Food Service"],
  bakery: ["Bakery/Cafe"],
  takeaway: ["Food Delivery", "Restaurant/Food Service"],
  pub: ["Restaurant/Food Service"],
  bar: ["Restaurant/Food Service"],
  plumber: ["Home Services"],
  electrician: ["Home Services"],
  builder: ["Home Services"],
  roofer: ["Home Services"],
  painter: ["Home Services"],
  cleaner: ["Cleaning Service", "Home Services"],
  gardener: ["Landscaping/Garden"],
  landscaper: ["Landscaping/Garden"],
  florist: ["Florist/Plant Shop"],
  dentist: ["Dental/Medical Clinic"],
  physio: ["Dental/Medical Clinic", "Beauty/Spa/Wellness"],
  gym: ["Fitness/Gym"],
  fitness: ["Fitness/Gym"],
  yoga: ["Beauty/Spa/Wellness", "Fitness/Gym"],
  tattoo: ["Barber"],  // similar aesthetic
  pet: ["Pet Tech"],
  vet: ["Pet Tech", "Dental/Medical Clinic"],
  accountant: ["Professional Services"],
  lawyer: ["Professional Services"],
  shop: ["E-Commerce", "Retail"],
};

// ---------------------------------------------------------------------------
// Landing page pattern matching
// ---------------------------------------------------------------------------

const BUSINESS_TO_LANDING: Record<string, string> = {
  barber: "Hero + Testimonials + CTA",
  salon: "Hero + Testimonials + CTA",
  restaurant: "Hero + Features + CTA",
  cafe: "Minimal Single Column",
  bakery: "Hero + Features + CTA",
  takeaway: "Hero + Features + CTA",
  plumber: "Funnel (3-Step Conversion)",
  electrician: "Funnel (3-Step Conversion)",
  builder: "Funnel (3-Step Conversion)",
  dentist: "Hero + Testimonials + CTA",
  gym: "Hero + Features + CTA",
  florist: "Hero + Features + CTA",
  spa: "Hero + Testimonials + CTA",
};

// ---------------------------------------------------------------------------
// Main function: get design context for a business type
// ---------------------------------------------------------------------------

let _uiReasoningCache: Array<Record<string, string>> | null = null;
let _landingCache: Array<Record<string, string>> | null = null;

function getUIReasoning(): Array<Record<string, string>> {
  if (!_uiReasoningCache) {
    _uiReasoningCache = parseCSV(join(DATA_DIR, "ui-reasoning.csv"));
  }
  return _uiReasoningCache;
}

function getLandingPatterns(): Array<Record<string, string>> {
  if (!_landingCache) {
    _landingCache = parseCSV(join(DATA_DIR, "landing.csv"));
  }
  return _landingCache;
}

export function getDesignContextForBusiness(businessType: string): IndustryDesignContext | null {
  const lower = businessType.toLowerCase();

  // Find matching category keywords
  const categoryKeywords = BUSINESS_TO_CATEGORY[lower];
  if (!categoryKeywords) {
    // Try partial matching
    for (const [key, cats] of Object.entries(BUSINESS_TO_CATEGORY)) {
      if (lower.includes(key)) {
        return findInCSV(cats, lower);
      }
    }
    return null;
  }

  return findInCSV(categoryKeywords, lower);
}

function findInCSV(
  categoryKeywords: string[],
  businessType: string,
): IndustryDesignContext | null {
  const reasoning = getUIReasoning();

  // Search for matching row
  for (const keyword of categoryKeywords) {
    const row = reasoning.find((r) =>
      r.UI_Category?.toLowerCase().includes(keyword.toLowerCase()),
    );
    if (row) {
      // Find matching landing page pattern
      const landingPatternName = BUSINESS_TO_LANDING[businessType] ?? "Hero + Features + CTA";
      const landingPatterns = getLandingPatterns();
      const landing = landingPatterns.find((l) =>
        l["Pattern Name"]?.includes(landingPatternName),
      );

      return {
        category: row.UI_Category ?? keyword,
        pattern: row.Recommended_Pattern ?? "Hero-Centric + Social Proof",
        stylePriority: row.Style_Priority ?? "",
        colourMood: row.Color_Mood ?? "",
        typographyMood: row.Typography_Mood ?? "",
        keyEffects: row.Key_Effects ?? "",
        antiPatterns: row.Anti_Patterns ?? "",
        landingPattern: landing?.["Section Order"] ?? undefined,
        conversionTips: landing?.["Conversion Optimization"] ?? undefined,
        recommendedEffects: landing?.["Recommended Effects"] ?? undefined,
      };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Format design context for inclusion in AI prompt
// ---------------------------------------------------------------------------

export function formatDesignContextForPrompt(ctx: IndustryDesignContext): string {
  const lines: string[] = [
    `=== DESIGN INTELLIGENCE (industry-specific UI/UX rules) ===`,
    `Industry: ${ctx.category}`,
    `Recommended pattern: ${ctx.pattern}`,
    `Style direction: ${ctx.stylePriority}`,
    `Colour mood: ${ctx.colourMood}`,
    `Typography mood: ${ctx.typographyMood}`,
    `Key effects: ${ctx.keyEffects}`,
    ``,
    `ANTI-PATTERNS — DO NOT DO THESE:`,
    `${ctx.antiPatterns}`,
  ];

  if (ctx.landingPattern) {
    lines.push(``, `Recommended section flow: ${ctx.landingPattern}`);
  }
  if (ctx.recommendedEffects) {
    lines.push(`CSS effects to use: ${ctx.recommendedEffects}`);
  }
  if (ctx.conversionTips) {
    lines.push(`Conversion optimisation: ${ctx.conversionTips}`);
  }

  lines.push(
    ``,
    `QUALITY STANDARDS:`,
    `- Touch targets: 44×44px minimum`,
    `- Text contrast: 4.5:1 ratio minimum`,
    `- Body text: 16px minimum on mobile`,
    `- Spacing rhythm: 4px/8px grid system`,
    `- Animation duration: 150-300ms for micro-interactions`,
    `- Use SVG icons (Lucide/Heroicons), never emoji as icons`,
    `- object-fit: cover on all photos, never stretch`,
    `- Alternating section backgrounds for visual rhythm`,
    `- Each section must feel distinct — vary layout, not just content`,
  );

  return lines.join("\n");
}
