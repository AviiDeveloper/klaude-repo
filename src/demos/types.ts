/**
 * Demo Record types — structured capture of every generated demo site.
 *
 * Each demo links to a business (lead) and captures the full design_elements
 * used to generate it. When a salesperson pitches and logs the outcome,
 * the pitch_outcome ties back to these design choices — creating the
 * training dataset for the self-learning system.
 *
 * Spec reference: full_production_context/project_context.md — demo_records schema
 */

export interface DesignElements {
  colour_palette: string[];
  colour_source: string;
  layout_type: string;
  typography_pair: string;
  hero_style: string;
  section_order: string[];
  sections_count: number;
  colour_temperature: "warm" | "cool" | "neutral";
  density: "minimal" | "medium" | "rich";
  has_logo: boolean;
  has_hero_image: boolean;
  has_gallery: boolean;
  has_reviews: boolean;
  has_map: boolean;
  has_menu: boolean;
}

export interface DemoRecord {
  demo_id: string;
  business_id: string;
  generated_at: string;
  model_version: string;
  scrape_quality_score: number;
  design_elements: DesignElements;
  quality_score: number | null;
  quality_passed: boolean | null;
  demo_url: string | null;
  screenshot_url: string | null;
  salesperson_id: string | null;
  pitched_at: string | null;
  pitch_outcome: string | null;
  rejection_reason: string | null;
  salesperson_close_rate_at_time: number | null;
  outcome_logged_at: string | null;
}

export interface RecordDemoInput {
  leadId: string;
  html: string;
  css: string;
  modelVersion: string;
  scrapeQualityScore: number;
  designElements: DesignElements;
  demoUrl?: string;
}

export interface PitchOutcomeInput {
  salespersonId: string;
  outcome: "closed" | "rejected" | "follow_up";
  rejectionReason?: string;
  salespersonCloseRateAtTime: number;
}

export interface DemoQuery {
  business_id?: string;
  quality_passed?: boolean;
  has_outcome?: boolean;
  pitched_no_outcome?: boolean;
  pending_qa?: boolean;
  model_version?: string;
  since?: string;
  limit?: number;
}
