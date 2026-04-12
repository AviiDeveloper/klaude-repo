/**
 * Layout data for the interactive flowcharts.
 * Positions and edges are hand-crafted to match the Figma FigJam boards.
 */

export interface NodePosition {
  x: number;
  y: number;
}

export interface LayoutEdge {
  from: string;
  to: string;
  label?: string;
  fromSide?: 'top' | 'bottom' | 'left' | 'right';
  toSide?: 'top' | 'bottom' | 'left' | 'right';
  waypoints?: Array<{ x: number; y: number }>;
  dashed?: boolean;
}

export interface FlowchartLayout {
  positions: Record<string, NodePosition>;
  edges: LayoutEdge[];
  canvasWidth: number;
  canvasHeight: number;
}

// ══════════════════════════════════════════════════════════════
// LEAD GENERATION — matches Figma board AkwCrxbE90kno2bjNoKLC7
// ══════════════════════════════════════════════════════════════

const LEAD_GEN_LAYOUT: FlowchartLayout = {
  canvasWidth: 1060,
  canvasHeight: 1760,
  positions: {
    // Main vertical flow (left column)
    'sp-signup':          { x: 280, y: 50 },
    'location-submitted': { x: 280, y: 150 },
    'pipeline-triggers':  { x: 280, y: 260 },
    'agent-scraper':      { x: 280, y: 380 },
    // Parallel data sources (branch from scraper)
    'google-places':      { x: 150, y: 500 },
    'apify-instagram':    { x: 410, y: 500 },
    // Merge back
    'business-profile':   { x: 280, y: 630 },
    // Generation flow (slightly right)
    'agent-generation':   { x: 370, y: 750 },
    'claude-demo':        { x: 300, y: 860 },
    'agent-qc':           { x: 300, y: 960 },
    'qc-decision':        { x: 350, y: 1070 },
    // Post-QC flow
    'screenshot-r2':      { x: 350, y: 1200 },
    'demo-supabase':      { x: 350, y: 1290 },
    'lead-sp-queue':      { x: 350, y: 1380 },
    'sp-onboarding':      { x: 350, y: 1470 },
    'dashboard-unlocks':  { x: 350, y: 1560 },
    // Right side — lead availability decision tree
    'lead-available':     { x: 700, y: 380 },
    'generation-cap':     { x: 560, y: 630 },
    'sp-claims-lead':     { x: 570, y: 1670 },
    'lead-transfer':      { x: 880, y: 630 },
  },
  edges: [
    // Main downward flow
    { from: 'sp-signup', to: 'location-submitted' },
    { from: 'location-submitted', to: 'pipeline-triggers' },
    { from: 'pipeline-triggers', to: 'agent-scraper' },
    // Scraper branches
    { from: 'agent-scraper', to: 'google-places' },
    { from: 'agent-scraper', to: 'apify-instagram' },
    // Merge into business profile
    { from: 'google-places', to: 'business-profile' },
    { from: 'apify-instagram', to: 'business-profile' },
    // Generation flow
    { from: 'business-profile', to: 'agent-generation' },
    { from: 'generation-cap', to: 'agent-generation', fromSide: 'bottom', toSide: 'right' },
    { from: 'agent-generation', to: 'claude-demo' },
    { from: 'claude-demo', to: 'agent-qc' },
    { from: 'agent-qc', to: 'qc-decision' },
    // QC decision branches
    { from: 'qc-decision', to: 'screenshot-r2', label: 'Yes', fromSide: 'bottom' },
    {
      from: 'qc-decision', to: 'agent-generation', label: 'No — regenerate',
      fromSide: 'left', toSide: 'left',
      waypoints: [{ x: 170, y: 1070 }, { x: 170, y: 750 }],
    },
    // Post-QC flow
    { from: 'screenshot-r2', to: 'demo-supabase' },
    { from: 'demo-supabase', to: 'lead-sp-queue' },
    { from: 'lead-sp-queue', to: 'sp-onboarding' },
    { from: 'sp-onboarding', to: 'dashboard-unlocks' },
    // Dashboard → claim → lead availability loop
    { from: 'dashboard-unlocks', to: 'sp-claims-lead' },
    {
      from: 'sp-claims-lead', to: 'lead-available',
      fromSide: 'right', toSide: 'bottom',
      waypoints: [{ x: 770, y: 1670 }, { x: 770, y: 425 }],
    },
    // Lead availability branches
    { from: 'lead-available', to: 'generation-cap', label: 'Generate new', fromSide: 'bottom' },
    { from: 'lead-available', to: 'lead-transfer', label: 'Claimed by\nother SP', fromSide: 'right' },
  ],
};

// ══════════════════════════════════════════════════════════════
// PITCH TO FULFILMENT — matches Figma board UsMR2GFR7Y5NhA3xtWUjUA
// ══════════════════════════════════════════════════════════════

const PITCH_FULFIL_LAYOUT: FlowchartLayout = {
  canvasWidth: 860,
  canvasHeight: 1970,
  positions: {
    // Top — visit + demo
    'sp-visits':              { x: 380, y: 50 },
    'demo-shown':             { x: 380, y: 150 },
    'owner-response':         { x: 380, y: 260 },
    // Left branch (Interested path)
    'qr-capture':             { x: 160, y: 420 },
    'link-sent':              { x: 160, y: 530 },
    'client-wizard':          { x: 160, y: 640 },
    'stripe-payment-link':    { x: 220, y: 770 },
    // Payment decision (center)
    'payment-received':       { x: 420, y: 650 },
    // Fulfilment chain (center-right column)
    'fulfilment-pipeline':    { x: 530, y: 810 },
    'full-site-gen':          { x: 530, y: 910 },
    'vercel-deploy':          { x: 530, y: 1000 },
    'domain-porkbun':         { x: 530, y: 1090 },
    'ssl-provision':          { x: 530, y: 1180 },
    'stripe-invoice':         { x: 530, y: 1270 },
    'confirmation-email':     { x: 530, y: 1360 },
    'sp-commission':          { x: 530, y: 1450 },
    'queue-replenish':        { x: 530, y: 1540 },
    'client-portal':          { x: 530, y: 1630 },
    // Portal branches
    'tier2-changes':          { x: 420, y: 1760 },
    'tier1-selfservice':      { x: 640, y: 1760 },
    // Right branch (Rejected path)
    'pitch-outcome-logged':   { x: 650, y: 420 },
    'voice-memo':             { x: 650, y: 530 },
    'gps-dwell-validate':     { x: 650, y: 640 },
    'rejection-captured':     { x: 650, y: 750 },
    'commission-enhancement': { x: 650, y: 860 },
  },
  edges: [
    // Top flow
    { from: 'sp-visits', to: 'demo-shown' },
    { from: 'demo-shown', to: 'owner-response' },
    // Decision branches
    { from: 'owner-response', to: 'qr-capture', label: 'Interested', fromSide: 'left' },
    { from: 'owner-response', to: 'pitch-outcome-logged', label: 'Rejected', fromSide: 'right' },
    // Interested path
    { from: 'qr-capture', to: 'link-sent' },
    { from: 'link-sent', to: 'client-wizard' },
    { from: 'client-wizard', to: 'stripe-payment-link' },
    { from: 'stripe-payment-link', to: 'payment-received', fromSide: 'right', toSide: 'bottom' },
    // Payment decision
    { from: 'payment-received', to: 'fulfilment-pipeline', label: 'Yes', fromSide: 'right' },
    {
      from: 'payment-received', to: 'stripe-payment-link', label: 'No',
      fromSide: 'left', toSide: 'left',
      waypoints: [{ x: 120, y: 650 }, { x: 120, y: 770 }],
    },
    // Fulfilment chain
    { from: 'fulfilment-pipeline', to: 'full-site-gen' },
    { from: 'full-site-gen', to: 'vercel-deploy' },
    { from: 'vercel-deploy', to: 'domain-porkbun' },
    { from: 'domain-porkbun', to: 'ssl-provision' },
    { from: 'ssl-provision', to: 'stripe-invoice' },
    { from: 'stripe-invoice', to: 'confirmation-email' },
    { from: 'confirmation-email', to: 'sp-commission' },
    { from: 'sp-commission', to: 'queue-replenish' },
    { from: 'queue-replenish', to: 'client-portal' },
    // Portal branches
    { from: 'client-portal', to: 'tier2-changes' },
    { from: 'client-portal', to: 'tier1-selfservice' },
    // Rejected path
    { from: 'pitch-outcome-logged', to: 'voice-memo' },
    { from: 'voice-memo', to: 'gps-dwell-validate' },
    { from: 'gps-dwell-validate', to: 'rejection-captured' },
    { from: 'rejection-captured', to: 'commission-enhancement' },
  ],
};

// ══════════════════════════════════════════════════════════════
// SELF-LEARNING LOOP — inferred from dependency graph
// (Figma board lYBACgMhVS41eVG04wI3hI — rate-limited)
// ══════════════════════════════════════════════════════════════

const LEARNING_LOOP_LAYOUT: FlowchartLayout = {
  canvasWidth: 740,
  canvasHeight: 1100,
  positions: {
    // Main vertical flow
    'agent-produces-output': { x: 300, y: 50 },
    'critic-evaluates':      { x: 300, y: 160 },
    'score-threshold':       { x: 300, y: 280 },
    // Retry branch (right)
    'critique-injected':     { x: 550, y: 280 },
    'agent-retries':         { x: 550, y: 400 },
    // Continue after pass
    'episode-recorded':      { x: 300, y: 440 },
    'outcome-attached':      { x: 300, y: 550 },
    'attribution-engine':    { x: 300, y: 660 },
    'strategy-ranker':       { x: 300, y: 770 },
    'strategic-memory':      { x: 300, y: 880 },
    'strategy-injected':     { x: 300, y: 990 },
  },
  edges: [
    { from: 'agent-produces-output', to: 'critic-evaluates' },
    { from: 'critic-evaluates', to: 'score-threshold' },
    // Score decision
    { from: 'score-threshold', to: 'episode-recorded', label: 'Yes — ≥ 0.7', fromSide: 'bottom' },
    { from: 'score-threshold', to: 'critique-injected', label: 'No — < 0.7', fromSide: 'right' },
    // Retry loop
    { from: 'critique-injected', to: 'agent-retries' },
    {
      from: 'agent-retries', to: 'critic-evaluates',
      fromSide: 'right', toSide: 'right',
      waypoints: [{ x: 660, y: 400 }, { x: 660, y: 160 }],
    },
    // Main flow continues
    { from: 'episode-recorded', to: 'outcome-attached' },
    { from: 'outcome-attached', to: 'attribution-engine' },
    { from: 'attribution-engine', to: 'strategy-ranker' },
    { from: 'strategy-ranker', to: 'strategic-memory' },
    { from: 'strategic-memory', to: 'strategy-injected' },
    // Strategy feeds back to next run (dashed)
    {
      from: 'strategy-injected', to: 'agent-produces-output', label: 'Next run',
      dashed: true, fromSide: 'left', toSide: 'left',
      waypoints: [{ x: 110, y: 990 }, { x: 110, y: 50 }],
    },
  ],
};

export const LAYOUTS: Record<string, FlowchartLayout> = {
  'lead-gen': LEAD_GEN_LAYOUT,
  'pitch-fulfil': PITCH_FULFIL_LAYOUT,
  'learning-loop': LEARNING_LOOP_LAYOUT,
};
