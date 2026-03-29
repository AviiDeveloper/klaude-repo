/**
 * DemoRecorder — orchestrates demo record capture.
 *
 * Extracts design_elements from siteComposerAgent output, persists
 * the full record, optionally captures a screenshot, and logs a
 * decision via the DecisionLogger.
 */

import { randomUUID } from "node:crypto";
import { DecisionLogger } from "../decisions/decisionLogger.js";
import { DemoRecordStore } from "./demoRecordStore.js";
import { captureDemo } from "./screenshotCapture.js";
import { DemoRecord, DesignElements, PitchOutcomeInput, RecordDemoInput } from "./types.js";

export class DemoRecorder {
  constructor(
    private readonly store: DemoRecordStore,
    private readonly decisionLogger?: DecisionLogger,
  ) {}

  /**
   * Record a newly generated demo. Returns the demo_id.
   */
  async recordDemo(input: RecordDemoInput): Promise<string> {
    const demoId = randomUUID();
    const now = new Date().toISOString();

    const record: DemoRecord = {
      demo_id: demoId,
      business_id: input.leadId,
      generated_at: now,
      model_version: input.modelVersion,
      scrape_quality_score: input.scrapeQualityScore,
      design_elements: input.designElements,
      quality_score: null,
      quality_passed: null,
      demo_url: input.demoUrl ?? null,
      screenshot_url: null,
      salesperson_id: null,
      pitched_at: null,
      pitch_outcome: null,
      rejection_reason: null,
      salesperson_close_rate_at_time: null,
      outcome_logged_at: null,
    };

    this.store.insert(record);

    if (this.decisionLogger) {
      await this.decisionLogger.log({
        agent_id: "demo-recorder",
        decision_type: "demo_generated",
        description: `Demo recorded for business ${input.leadId}`,
        rationale: `Model: ${input.modelVersion}, scrape quality: ${input.scrapeQualityScore}`,
        input_data: {
          lead_id: input.leadId,
          model_version: input.modelVersion,
          colour_source: input.designElements.colour_source,
          hero_style: input.designElements.hero_style,
          sections_count: input.designElements.sections_count,
        },
        expected_outcome: "qa_passed",
        expected_metric: { quality_score: 0.7 },
      });
    }

    return demoId;
  }

  /**
   * Capture a screenshot of the demo HTML and attach to the record.
   * Returns the screenshot path or null if capture failed.
   */
  async captureAndAttachScreenshot(
    demoId: string,
    html: string,
    leadId: string,
  ): Promise<string | null> {
    const result = await captureDemo(html, leadId, demoId);
    if (!result) return null;

    this.store.updateScreenshot(demoId, result.path);
    return result.path;
  }

  /**
   * Record QA results for a demo.
   */
  recordQaResult(demoId: string, score: number, passed: boolean): void {
    this.store.updateQuality(demoId, score, passed);
  }

  /**
   * Record a pitch outcome for a demo.
   */
  async recordPitchOutcome(demoId: string, input: PitchOutcomeInput): Promise<void> {
    this.store.updatePitchOutcome(demoId, input);

    if (this.decisionLogger) {
      await this.decisionLogger.log({
        agent_id: "demo-recorder",
        decision_type: "pitch_outcome_recorded",
        description: `Pitch outcome: ${input.outcome} for demo ${demoId}`,
        rationale: `Salesperson ${input.salespersonId} (close rate: ${input.salespersonCloseRateAtTime})`,
        input_data: {
          demo_id: demoId,
          outcome: input.outcome,
          salesperson_id: input.salespersonId,
          close_rate_at_time: input.salespersonCloseRateAtTime,
          rejection_reason: input.rejectionReason,
        },
        expected_outcome: input.outcome,
      });
    }
  }

  /**
   * Get a demo record by ID.
   */
  get(demoId: string): DemoRecord | undefined {
    return this.store.get(demoId);
  }

  /**
   * Get all demos for a business.
   */
  getByBusiness(businessId: string): DemoRecord[] {
    return this.store.getByBusiness(businessId);
  }

  /**
   * List demos pending QA.
   */
  listPendingQa(limit?: number): DemoRecord[] {
    return this.store.query({ pending_qa: true, limit });
  }

  /**
   * List demos that have been pitched but have no outcome yet.
   * (pitched_at is set but pitch_outcome is null)
   */
  listPendingOutcomes(limit?: number): DemoRecord[] {
    return this.store.query({ has_outcome: false, limit });
  }
}

/**
 * Extract DesignElements from siteComposerAgent output metadata.
 * Maps the rich metadata fields the composer already produces
 * into the structured format needed for training.
 */
export function extractDesignElements(
  siteData: Record<string, unknown>,
): DesignElements {
  const colourPalette: string[] = [];
  // Try to extract from config_json which contains all template vars
  if (typeof siteData.config_json === "string") {
    try {
      const config = JSON.parse(siteData.config_json) as Record<string, string>;
      if (config.primary_color) colourPalette.push(config.primary_color);
      if (config.accent_color) colourPalette.push(config.accent_color);
    } catch { /* ignore */ }
  }

  const sectionsCount = typeof siteData.sections_count === "number"
    ? siteData.sections_count
    : 3;

  const heroStyle = typeof siteData.hero_variant === "string"
    ? siteData.hero_variant
    : "gradient";

  const fontPair = typeof siteData.font_pairing === "string"
    ? siteData.font_pairing
    : "system / system";

  const componentStyle = typeof siteData.component_style === "string"
    ? siteData.component_style
    : "clean";

  const colourSource = typeof siteData.brand_source === "string"
    ? siteData.brand_source
    : "vertical_default";

  // Derive colour temperature from primary colour hue
  const colourTemp = deriveColourTemperature(colourPalette[0]);

  // Derive density from sections count
  const density = sectionsCount <= 4 ? "minimal" : sectionsCount <= 7 ? "medium" : "rich";

  // Build section order from boolean flags
  const sectionOrder: string[] = ["hero", "services"];
  if (siteData.has_gallery) sectionOrder.push("gallery");
  if (siteData.has_reviews) sectionOrder.push("reviews");
  if (siteData.has_hours) sectionOrder.push("hours");
  if (siteData.has_map) sectionOrder.push("map");
  if (siteData.has_menu) sectionOrder.push("menu");
  sectionOrder.push("cta", "footer");

  return {
    colour_palette: colourPalette,
    colour_source: colourSource,
    layout_type: componentStyle,
    typography_pair: fontPair,
    hero_style: heroStyle,
    section_order: sectionOrder,
    sections_count: sectionsCount,
    colour_temperature: colourTemp,
    density,
    has_logo: !!siteData.has_logo,
    has_hero_image: !!siteData.has_hero_image,
    has_gallery: !!siteData.has_gallery,
    has_reviews: !!siteData.has_reviews,
    has_map: !!siteData.has_map,
    has_menu: !!siteData.has_menu,
  };
}

/**
 * Derive colour temperature from a hex colour.
 * Warm: red/orange/yellow hues (0-60, 300-360)
 * Cool: blue/green hues (120-270)
 * Neutral: grey or unsaturated
 */
function deriveColourTemperature(hex: string | undefined): "warm" | "cool" | "neutral" {
  if (!hex) return "neutral";
  const match = hex.replace("#", "").match(/^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!match) return "neutral";

  const r = parseInt(match[1], 16) / 255;
  const g = parseInt(match[2], 16) / 255;
  const b = parseInt(match[3], 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  // Low saturation = neutral
  if (delta < 0.1) return "neutral";

  let hue = 0;
  if (delta > 0) {
    if (max === r) hue = ((g - b) / delta) % 6;
    else if (max === g) hue = (b - r) / delta + 2;
    else hue = (r - g) / delta + 4;
    hue = Math.round(hue * 60);
    if (hue < 0) hue += 360;
  }

  // Warm: reds, oranges, yellows (330-60)
  if (hue >= 330 || hue <= 60) return "warm";
  // Cool: blues, greens, purples (120-270)
  if (hue >= 120 && hue <= 270) return "cool";
  // Transitional
  return "neutral";
}
