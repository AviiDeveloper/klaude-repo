# Sales Dashboard — AI Lead Intelligence Handover

## Branch: `feat/sl-mas-foundation`
**Date:** 2026-04-09
**Priority:** HIGH — this is the salesperson-facing output. Nothing else matters if this isn't useful.

---

## The Problem

The pipeline generates rich data about each business (brand tone, reviews, services, opening hours, pain points, brand colours, USPs, Instagram presence) but the sales dashboard shows raw fields. A salesperson opening a lead card sees:

- Business name, type, address, rating ✓
- Brand colours as hex codes (useless)
- Brand tone as a phrase (useless)
- Services as a raw array (useless)
- No pitch preparation
- No talking points
- No objection handling
- No business overview

## What the salesperson actually needs

### Overview Tab
An AI-generated 2-3 paragraph summary of the business:
- What they do, who their customers are, what makes them stand out
- Their online presence (website quality, Instagram, Google reviews)
- Why they're a good fit for our service
- Key numbers: reviews, rating, years in business

### Prepare Tab
AI-generated pitch preparation:
- **Talking points** — 3-5 bullet points tailored to this specific business ("They have 759 reviews but their website is from 2015 — lead with the contrast between their reputation and their online presence")
- **Trust badges** — what credentials/awards to mention
- **Objection handling** — predicted objections with suggested responses ("If they say 'I already have a website', point out it's not mobile-friendly and has no booking integration")
- **Avoid topics** — things not to mention (competitors, negative reviews)

### Pitch Tab  
- The demo site viewer (WebView of the generated HTML)
- QR code share button
- Key stats to quote during the pitch
- Suggested opening line

### Follow Up Tab
Already exists — works fine.

---

## What exists in the codebase

### Data available in `lead_assignments.notes` JSON
All of this is already in the database from the pipeline:
```
business_name, business_type, address, postcode, phone
google_rating, google_review_count
opening_hours (JSON array)
services (JSON array) 
best_reviews (JSON array with author/rating/text)
brand_colours (array of hex codes)
brand_tone ("warm and welcoming", "professional and approachable")
brand_personality
usps (unique selling points array)
hero_headline
description (raw business description)
pain_points (JSON array)
instagram_handle, instagram_followers
has_website, website_url
qualification_score
```

### Dashboard components that need updating
- `apps/sales-dashboard/src/app/lead/[id]/page.tsx` — Lead detail page with tabs
- `apps/sales-dashboard/src/components/TalkingPoints.tsx` — Currently empty/placeholder
- `apps/sales-dashboard/src/components/BusinessIntel.tsx` — Currently shows raw fields
- `apps/sales-dashboard/src/app/api/leads/[id]/route.ts` — API that serves lead detail

### What needs to be built
1. **AI Overview Generator** — Takes raw lead data, calls Claude, produces a human-readable business overview
2. **AI Pitch Prep Generator** — Takes raw lead data, calls Claude, produces talking points, objection handling, avoid topics
3. **Cache the AI output** — Generate once per lead, store in `lead_assignments.notes` as `ai_overview`, `ai_talking_points`, `ai_objections`, `ai_avoid_topics`
4. **Update the dashboard components** — Display the AI-generated content in the tabs

### Where to call Claude
Use the same OpenRouter pattern as `src/agents/outreach/brandIntelligence.ts`:
```typescript
const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${OPENROUTER_API_KEY}`,
    "HTTP-Referer": process.env.OPENROUTER_SITE_URL ?? "https://localhost",
    "X-Title": "openclaw-sales-intel",
  },
  body: JSON.stringify({
    model: "anthropic/claude-sonnet-4",
    temperature: 0.4,
    max_tokens: 2000,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildPrompt(leadData) },
    ],
  }),
});
```

### System prompt guidance
The AI should write as a sales coach briefing a salesperson before a visit:
- Conversational, not corporate
- Specific to this business, not generic
- Actionable — "do this", "say this", "avoid this"
- Confident but not pushy
- Reference real data (their actual review count, their actual rating)

---

## Database & API

- **DB:** SQLite at `apps/mission-control/mission-control.db`
- **Lead data:** `lead_assignments` table, enriched data in `notes` JSON column
- **Dashboard API:** `apps/sales-dashboard/src/app/api/leads/[id]/route.ts`
- **Auth:** Login route updated to use local SQLite (not Supabase). Login with name + PIN.
- **Test user:** `Test SP (Manchester)` / PIN `1234` — has 8 real Manchester leads

## How to run
```bash
# Dashboard (port 4300)
cd apps/sales-dashboard
DATABASE_PATH=../mission-control/mission-control.db npm run dev:safe

# Re-run pipeline for fresh leads (optional)
GOOGLE_PLACES_API_KEY=... OPENROUTER_API_KEY=... npx tsx scripts/test-live-pipeline.ts
```

## Key files
```
apps/sales-dashboard/src/app/lead/[id]/page.tsx    — Lead detail (4 tabs)
apps/sales-dashboard/src/app/api/leads/[id]/route.ts — Lead detail API
apps/sales-dashboard/src/components/TalkingPoints.tsx — Talking points component
apps/sales-dashboard/src/components/BusinessIntel.tsx — Business intel component
apps/sales-dashboard/src/lib/db/index.ts            — SQLite helpers
apps/sales-dashboard/src/lib/types.ts               — TypeScript interfaces
scripts/test-live-pipeline.ts                        — Pipeline test runner
```

## North Star
Refer to the memory file at `~/.claude/projects/-Users-Avii-Desktop-klaude-repo/memory/north_star_flow.md` — the complete business flow from SP signup to client portal. Do not deviate without permission.
