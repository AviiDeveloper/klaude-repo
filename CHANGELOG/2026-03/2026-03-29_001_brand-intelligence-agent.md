# Brand Intelligence Agent — AI-Powered Research Layer

**Date:** 2026-03-29
**Branch:** feat/demo-generation-pipeline

## What changed

### New file
- `src/agents/outreach/brandIntelligence.ts` — New agent that calls Claude Sonnet via OpenRouter to analyse all scraped business data and produce structured brand intelligence (tone, personality, voice, USPs, colour/font recommendations, market position)

### Modified files
- `src/agents/outreach/brandAnalyser.ts` — Extended `BrandAnalysis` interface with `rawReviews`, `rawSocialBios`, `rawGoogleCategories`, `rawBusinessDescription`, and `intelligence` fields. Brand analyser now passes through raw scraped data instead of discarding it.
- `src/agents/outreach/index.ts` — Registered `brand-intelligence-agent` in the pipeline between brand-analyser and brief-generator
- `src/agents/outreach/briefGenerator.ts` — `buildBrief()` now prefers intelligence-derived headline, tagline, about copy, services, and trust signals. Extended `SiteBrief` with `brandTone`, `brandPersonality`, `voiceExamples`, `customerSentiment`, `uniqueSellingPoints`, `marketPosition`, `differentiators`.
- `src/agents/outreach/designSystem.ts` — Extended `DesignInput` with `brandTone`, `marketPosition`, `recommendedColours`, `recommendedFonts`. Colour resolution now uses AI recommendations when no scrape exists (priority: scraped > AI > vertical default). Font selection uses AI-recommended fonts. Brand tone maps to component style. Market position adjusts layout spacing and hero height.
- `src/agents/outreach/aiComposer.ts` — System prompt now includes BRAND PERSONALITY & VOICE and CUSTOMER INSIGHTS sections when intelligence is available.
- `src/agents/outreach/siteComposerAgent.ts` — Wires intelligence data into `DesignInput` for the design system.

### New ADR
- `ADR/ADR-0014-brand-intelligence-agent.md`

## Why

Demo websites felt like templates with different business names swapped in. The pipeline scraped rich data (reviews, social bios, Google categories, photos) but the BrandAnalyser reduced it all to basic hex codes and font names, usually falling back to hardcoded vertical defaults. A plumber in Mayfair got the same blue template as a plumber in Burnley.

## Stack

- TypeScript, OpenRouter API (Claude Sonnet), existing outreach pipeline agents

## Integrations

- OpenRouter API (same pattern as existing `aiComposer.ts`)
- New env vars: `BRAND_INTELLIGENCE_ENABLED` (default: true), `BRAND_INTELLIGENCE_MODEL`, `BRAND_INTELLIGENCE_TIMEOUT_MS`

## How to verify

1. `npm run verify` — 187 pass, 1 pre-existing fail
2. Set `BRAND_INTELLIGENCE_ENABLED=true` and `OPENROUTER_API_KEY` — run pipeline with a test lead
3. Set `BRAND_INTELLIGENCE_ENABLED=false` — verify pipeline produces identical output to before
4. Check intelligence JSON on brand analysis object has populated fields
5. Compare generated HTML with/without intelligence for same business

## Known issues

- Requires OpenRouter API key to function (graceful fallback when unavailable)
- ~$0.005-0.01 additional cost per lead for the intelligence call
- Pre-existing outreach pipeline e2e test failure (unrelated, documented in CLAUDE.md)
