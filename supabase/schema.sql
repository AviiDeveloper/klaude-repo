-- ============================================================
-- Supabase Schema — AI-Powered Salesperson Platform
-- Source of truth: full_production_context/
-- Run this in Supabase SQL Editor after creating your project
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── ENUMS ──────────────────────────────────────────────────

CREATE TYPE business_category AS ENUM (
  'restaurant', 'retail', 'trades', 'beauty', 'professional', 'other'
);

CREATE TYPE pitch_outcome_type AS ENUM (
  'closed', 'rejected', 'follow_up'
);

CREATE TYPE rejection_reason_type AS ENUM (
  'price', 'not_interested', 'has_website', 'wrong_person', 'timing', 'other'
);

CREATE TYPE colour_temperature AS ENUM ('warm', 'cool', 'neutral');
CREATE TYPE colour_saturation AS ENUM ('muted', 'medium', 'vibrant');
CREATE TYPE layout_type AS ENUM ('single-column', 'two-column', 'hero-centered', 'card-grid');
CREATE TYPE hero_style AS ENUM ('full-bleed-image', 'gradient', 'minimal', 'illustrated');
CREATE TYPE cta_style AS ENUM ('button', 'link', 'form');
CREATE TYPE cta_placement AS ENUM ('above-fold', 'mid-page', 'footer');
CREATE TYPE imagery_style AS ENUM ('photography', 'illustration', 'icon-only', 'none');
CREATE TYPE density_type AS ENUM ('minimal', 'medium', 'rich');
CREATE TYPE border_radius_type AS ENUM ('sharp', 'medium', 'rounded');
CREATE TYPE font_weight_type AS ENUM ('light', 'regular', 'medium', 'bold');
CREATE TYPE headline_tone AS ENUM ('formal', 'casual', 'urgent', 'friendly');

CREATE TYPE decision_type AS ENUM (
  'training_trigger', 'model_deploy', 'model_rollback',
  'gpu_terminate', 'scrape_pause', 'alert_sent',
  'lead_score_update', 'anomaly_flag'
);

CREATE TYPE agent_status AS ENUM ('running', 'idle', 'error', 'stopped');

CREATE TYPE message_priority AS ENUM ('normal', 'high', 'critical');

-- ── TABLE 1: business_profiles ─────────────────────────────

CREATE TABLE business_profiles (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name   text NOT NULL,
  category        business_category NOT NULL DEFAULT 'other',
  sub_category    text,
  city            text,
  region          text,
  postcode_prefix text,
  phone           text,
  email           text,
  website_url     text,
  instagram_url   text,
  facebook_url    text,
  google_place_id text,
  brand_colours   jsonb,          -- ["#hex", "#hex", ...]
  brand_assets    jsonb,          -- {logo_url, images: [...]}
  scrape_sources  jsonb,          -- ["instagram", "google", ...]
  raw_scrape_data jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_bp_category ON business_profiles (category);
CREATE INDEX idx_bp_city ON business_profiles (city);
CREATE INDEX idx_bp_created ON business_profiles (created_at);

-- ── TABLE 2: demo_records ──────────────────────────────────
-- One row per generated demo. Full design element vector for ML training.

CREATE TABLE demo_records (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id               uuid NOT NULL REFERENCES business_profiles(id),
  generated_at              timestamptz NOT NULL DEFAULT now(),
  model_version             text NOT NULL DEFAULT '1.0.0',
  generation_duration_ms    integer,
  scrape_quality_score      real CHECK (scrape_quality_score >= 0 AND scrape_quality_score <= 1),

  -- Design elements — the feature vector for ML training
  design_elements           jsonb NOT NULL DEFAULT '{}',
  -- Expected structure:
  -- {
  --   colour_palette: ["hex"...],
  --   primary_colour: "hex",
  --   colour_temperature: "warm|cool|neutral",
  --   colour_saturation: "muted|medium|vibrant",
  --   layout_type: "single-column|two-column|hero-centered|card-grid",
  --   hero_style: "full-bleed-image|gradient|minimal|illustrated",
  --   typography_pair: "Inter+Playfair",
  --   font_weight_primary: "light|regular|medium|bold",
  --   section_count: int,
  --   section_order: ["hero","services","about","contact"],
  --   cta_style: "button|link|form",
  --   cta_placement: "above-fold|mid-page|footer",
  --   imagery_style: "photography|illustration|icon-only|none",
  --   density: "minimal|medium|rich",
  --   border_radius: "sharp|medium|rounded",
  --   has_testimonials: bool,
  --   has_pricing: bool,
  --   has_map: bool
  -- }

  -- Copy elements
  copy_elements             jsonb NOT NULL DEFAULT '{}',
  -- Expected structure:
  -- {
  --   headline_word_count: int,
  --   headline_tone: "formal|casual|urgent|friendly",
  --   uses_business_name_in_hero: bool,
  --   uses_location_in_copy: bool
  -- }

  -- Demo output
  demo_html_url             text,          -- R2 storage URL
  screenshot_url            text,          -- R2 storage URL
  qc_score                  real,          -- 0-1, QC agent score
  qc_pass                   boolean,       -- true if qc_score >= 0.7

  created_at                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_dr_business ON demo_records (business_id);
CREATE INDEX idx_dr_model ON demo_records (model_version);
CREATE INDEX idx_dr_generated ON demo_records (generated_at);
CREATE INDEX idx_dr_qc ON demo_records (qc_pass);

-- ── TABLE 3: salesperson_metrics ───────────────────────────

CREATE TABLE salesperson_metrics (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           text NOT NULL UNIQUE,       -- links to auth system
  display_name      text,
  email             text,
  phone             text,
  city              text,
  region            text,
  stripe_connect_id text,                       -- for payouts
  total_pitches     integer NOT NULL DEFAULT 0,
  total_closes      integer NOT NULL DEFAULT 0,
  close_rate        real NOT NULL DEFAULT 0,    -- running close rate
  total_commission  real NOT NULL DEFAULT 0,    -- lifetime commission earned
  is_active         boolean NOT NULL DEFAULT true,
  activated_at      timestamptz,
  last_pitch_at     timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sm_active ON salesperson_metrics (is_active);
CREATE INDEX idx_sm_close_rate ON salesperson_metrics (close_rate);

-- ── TABLE 4: pitch_outcomes ────────────────────────────────

CREATE TABLE pitch_outcomes (
  id                                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  demo_id                           uuid NOT NULL REFERENCES demo_records(id),
  salesperson_id                    uuid NOT NULL REFERENCES salesperson_metrics(id),
  pitched_at                        timestamptz NOT NULL DEFAULT now(),
  salesperson_close_rate_at_time    real,       -- snapshot at pitch time
  salesperson_total_pitches_at_time integer,    -- snapshot at pitch time
  pitch_duration_minutes            integer,    -- from recording if available
  outcome                           pitch_outcome_type NOT NULL,
  rejection_reason                  rejection_reason_type,
  outcome_logged_at                 timestamptz NOT NULL DEFAULT now(),

  -- Derived fields (computed by data pipeline, not logged manually)
  salesperson_adjusted_outcome      real,       -- normalised 0-1
  days_to_outcome                   integer,    -- pitched_at minus demo generated_at
  is_valid_training_sample          boolean,    -- SP has 10+ pitches, scrape > 0.4

  -- Stripe confirmation (anti-poisoning gate)
  stripe_payment_confirmed          boolean DEFAULT false,
  stripe_payment_id                 text,

  created_at                        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_po_demo ON pitch_outcomes (demo_id);
CREATE INDEX idx_po_sp ON pitch_outcomes (salesperson_id);
CREATE INDEX idx_po_outcome ON pitch_outcomes (outcome);
CREATE INDEX idx_po_pitched ON pitch_outcomes (pitched_at);
CREATE INDEX idx_po_valid ON pitch_outcomes (is_valid_training_sample);

-- ── TABLE 5: model_versions ────────────────────────────────

CREATE TABLE model_versions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version         text NOT NULL UNIQUE,         -- semver e.g. "1.0.0"
  base_model      text NOT NULL,                -- e.g. "clip-vit-l-14"
  weights_path    text,                         -- DO volume path
  lora_config     jsonb,                        -- {r, alpha, target_modules, ...}
  training_run_id uuid,                         -- FK to training_runs
  auc_roc         real,
  close_rate_lift real,
  is_production   boolean NOT NULL DEFAULT false,
  is_staged       boolean NOT NULL DEFAULT false,
  deployed_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_mv_production ON model_versions (is_production);
CREATE INDEX idx_mv_version ON model_versions (version);

-- ── TABLE 6: training_runs ─────────────────────────────────

CREATE TABLE training_runs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_version_in    text,                     -- model version used as starting point
  model_version_out   text,                     -- model version produced
  vastai_instance_id  text,
  gpu_type            text DEFAULT 'RTX 4090',
  training_samples    integer,
  replay_samples      integer,                  -- experience replay count
  epochs              integer,
  learning_rate       real,
  duration_minutes    real,
  cost_gbp            real,
  final_loss          real,
  val_loss            real,
  auc_roc             real,
  close_rate_lift     real,
  p_value             real,
  status              text DEFAULT 'pending',   -- pending|running|completed|failed|cancelled
  failure_reason      text,
  wandb_run_url       text,
  started_at          timestamptz,
  completed_at        timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tr_status ON training_runs (status);
CREATE INDEX idx_tr_created ON training_runs (created_at);

-- ── TABLE 7: decision_log ──────────────────────────────────
-- Every orchestrator decision with expected vs actual outcome.

CREATE TABLE decision_log (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  made_at               timestamptz NOT NULL DEFAULT now(),
  agent_id              text NOT NULL,            -- AGENT-00 through AGENT-10
  decision_type         decision_type NOT NULL,
  description           text NOT NULL,
  rationale             text,
  input_data            jsonb,                    -- full data snapshot
  expected_outcome      text,
  expected_metric       jsonb,                    -- {metric, direction, magnitude, timeframe}
  actual_outcome        text,
  actual_metric         jsonb,
  outcome_measured_at   timestamptz,
  prediction_accuracy   real CHECK (prediction_accuracy >= 0 AND prediction_accuracy <= 1),
  requires_human_review boolean NOT NULL DEFAULT false,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_dl_agent ON decision_log (agent_id);
CREATE INDEX idx_dl_type ON decision_log (decision_type);
CREATE INDEX idx_dl_made ON decision_log (made_at);
CREATE INDEX idx_dl_review ON decision_log (requires_human_review) WHERE requires_human_review = true;

-- ── TABLE 8: agent_state ───────────────────────────────────

CREATE TABLE agent_state (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id      text NOT NULL UNIQUE,           -- AGENT-00 through AGENT-10
  agent_name    text NOT NULL,
  status        agent_status NOT NULL DEFAULT 'idle',
  last_heartbeat timestamptz,
  last_error    text,
  config        jsonb DEFAULT '{}',             -- agent-specific config
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ── TABLE 9: system_config ─────────────────────────────────

CREATE TABLE system_config (
  key         text PRIMARY KEY,
  value       jsonb NOT NULL,
  description text,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Seed default config
INSERT INTO system_config (key, value, description) VALUES
  ('qc_threshold', '0.7', 'Minimum QC score for demo to pass'),
  ('training_trigger_count', '100', 'New outcomes required to trigger training'),
  ('ab_test_duration_days', '14', 'Minimum A/B test duration'),
  ('deployment_lift_threshold', '0.005', 'Minimum close rate lift for deployment (0.5%)'),
  ('deployment_p_value', '0.05', 'Maximum p-value for deployment significance'),
  ('lead_buffer_minimum', '500', 'Minimum demo buffer before scraper triggers'),
  ('lead_lock_hours', '72', 'Hours a claimed lead is locked'),
  ('replay_ratio', '0.2', 'Experience replay ratio for training'),
  ('cost_alert_daily_max', '10', 'Max daily Vast.ai spend (GBP) before alert'),
  ('scrape_quality_minimum', '0.4', 'Minimum scrape quality for training inclusion'),
  ('sp_minimum_pitches', '10', 'Minimum SP pitches for valid training sample');

-- ── TABLE 10: message_log ──────────────────────────────────

CREATE TABLE message_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_agent    text NOT NULL,
  to_agent      text NOT NULL,
  event_type    text NOT NULL,
  payload       jsonb DEFAULT '{}',
  priority      message_priority NOT NULL DEFAULT 'normal',
  processed     boolean NOT NULL DEFAULT false,
  processed_at  timestamptz,
  expires_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ml_to ON message_log (to_agent, processed);
CREATE INDEX idx_ml_priority ON message_log (priority);
CREATE INDEX idx_ml_created ON message_log (created_at);

-- ── TABLE 11: targeting_scores ─────────────────────────────

CREATE TABLE targeting_scores (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  score_type        text NOT NULL,              -- 'category' | 'region' | 'sp_affinity'
  dimension_key     text NOT NULL,              -- e.g. 'restaurant', 'london', 'sp123_restaurant'
  score             real NOT NULL DEFAULT 0.5,
  sample_size       integer NOT NULL DEFAULT 0,
  confidence        real,                       -- statistical confidence
  last_computed_at  timestamptz NOT NULL DEFAULT now(),
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE(score_type, dimension_key)
);

CREATE INDEX idx_ts_type ON targeting_scores (score_type);
CREATE INDEX idx_ts_score ON targeting_scores (score DESC);

-- ── TABLE 12: cost_log ─────────────────────────────────────

CREATE TABLE cost_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service     text NOT NULL,                    -- 'vastai' | 'digitalocean' | 'supabase' | 'stripe' | 'vercel' | 'claude_api'
  amount_gbp  real NOT NULL,
  description text,
  metadata    jsonb DEFAULT '{}',
  logged_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cl_service ON cost_log (service);
CREATE INDEX idx_cl_logged ON cost_log (logged_at);

-- ── TABLE 13: validation_flags ─────────────────────────────

CREATE TABLE validation_flags (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name    text NOT NULL,
  record_id     uuid NOT NULL,
  flag_type     text NOT NULL,                  -- 'missing_outcome' | 'missing_scrape_score' | 'missing_design_elements' | 'low_sp_pitches' | 'data_poisoning'
  description   text,
  resolved      boolean NOT NULL DEFAULT false,
  resolved_at   timestamptz,
  resolved_by   text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_vf_unresolved ON validation_flags (resolved) WHERE resolved = false;
CREATE INDEX idx_vf_table ON validation_flags (table_name);

-- ── ROW LEVEL SECURITY ─────────────────────────────────────
-- Enable RLS on all tables. Service role key bypasses RLS.

ALTER TABLE business_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE demo_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE salesperson_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE pitch_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE decision_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE targeting_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE validation_flags ENABLE ROW LEVEL SECURITY;

-- Service role bypass policies (all tables)
CREATE POLICY "Service role full access" ON business_profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON demo_records FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON salesperson_metrics FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON pitch_outcomes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON model_versions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON training_runs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON decision_log FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON agent_state FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON system_config FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON message_log FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON targeting_scores FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON cost_log FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON validation_flags FOR ALL USING (true) WITH CHECK (true);

-- ── UPDATED_AT TRIGGER ─────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON business_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON salesperson_metrics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON agent_state
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON system_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- Schema complete. 13 tables, all indexes, RLS enabled.
-- Run this once in your Supabase SQL Editor.
-- ============================================================
