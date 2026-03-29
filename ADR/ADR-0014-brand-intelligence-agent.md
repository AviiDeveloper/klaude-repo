# ADR-0014: Brand Intelligence Agent

## Status
Accepted

## Date
2026-03-29

## Context

The demo generation pipeline scrapes rich business data (Google reviews, social media bios, photos, business categories) but the BrandAnalyser reduces it to basic colour hex codes, font names, and a service list. Most businesses without a website fall back to hardcoded vertical defaults — every plumber gets blue, every restaurant gets red, every business gets Inter font and generic template copy.

The AI Composer receives a thin brief and must guess the business personality, resulting in demos that feel like templates with different names swapped in rather than genuinely personalised websites.

## Decision

Add a new `brand-intelligence-agent` between the BrandAnalyser and BriefGenerator in the outreach pipeline. This agent makes a single Claude API call per lead that analyses ALL scraped data and returns structured brand intelligence:

- Brand tone, personality, and voice examples
- Review-derived USPs, customer sentiment, and common praise
- Intelligent colour and font recommendations with rationale
- Market position assessment
- Business-specific trust signals and differentiators
- Refined copy (headline, tagline, about section)

The intelligence enriches the existing `BrandAnalysis` object and flows through to the BriefGenerator, DesignSystem, and AIComposer.

## Alternatives Considered

1. **Expand the BrandAnalyser with heuristics** — Would require encoding domain knowledge for hundreds of business subtypes. Brittle and doesn't generalise.

2. **Move all intelligence into the AIComposer prompt** — Overloads a single call that already handles HTML generation. Separating analysis from generation produces better results.

3. **Use a local model for analysis** — Insufficient quality for nuanced brand personality extraction at this stage.

## Consequences

### Positive
- Demos feel genuinely personalised to each business
- Businesses without websites get intelligent colour/font/copy rather than generic defaults
- Customer reviews are analysed for USPs and sentiment, improving demo relevance
- Each component downstream receives richer input without structural changes

### Negative
- Adds ~$0.005-0.01 per lead in API cost (~$0.15-0.30 per batch of 30)
- Adds ~5-10 seconds per lead to pipeline time (parallelisable)
- Depends on OpenRouter/Claude API availability

### Mitigations
- Fully gated by `BRAND_INTELLIGENCE_ENABLED` env flag
- Graceful fallback: API failure means pipeline continues with existing defaults
- Every consumption point uses `intelligence?.field ?? existingFallback`
- No existing behaviour changes when intelligence is unavailable

## Files Changed
- `src/agents/outreach/brandIntelligence.ts` — New agent
- `src/agents/outreach/brandAnalyser.ts` — Extended types, raw data pass-through
- `src/agents/outreach/index.ts` — Agent registration
- `src/agents/outreach/briefGenerator.ts` — Intelligence consumption
- `src/agents/outreach/designSystem.ts` — AI colour/font/tone recommendations
- `src/agents/outreach/aiComposer.ts` — Brand personality in prompt
