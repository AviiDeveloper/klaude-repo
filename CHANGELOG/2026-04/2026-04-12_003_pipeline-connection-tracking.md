# Pipeline Connection Tracking + Wiring Issue Indicators

**Date:** 2026-04-12
**Branch:** `feat/sl-mas-foundation`

## What changed

- **Updated** `apps/mission-control/src/lib/flowchart-data.ts` — added `connectedTo` and `connectionIssues` fields to `FlowchartNode` type, populated across all 56 nodes with accurate cross-app connection data
- **Updated** `apps/mission-control/src/components/InteractiveFlowchart.tsx` — added connection badges, warning indicators, disconnection count, and app legend to the SVG renderer

## Why

The pipeline flowchart showed build status but not whether nodes were actually wired to the apps that need them (sales-dashboard, iOS, mobile-api). Several nodes marked "built" have broken downstream connections (e.g., generated HTML never reaches Supabase, no push notifications on lead assignment). The user wants the pipeline page to be the single command center for all pipeline work — if something is disconnected, it should be visible at a glance.

## Stack

- Next.js 14, React 18, TypeScript
- Pure SVG rendering
- Tailwind CSS with `mc-*` colour tokens

## What was added

### Per-node connection data
- `connectedTo`: which apps each node is wired to (`sales-dashboard`, `ios-app`, `mobile-api`, `pipeline-runtime`, `supabase`, `stripe`)
- `connectionIssues`: specific wiring gaps (e.g., "Generated HTML stays in local SQLite — never pushed to Supabase")

### Visual indicators on SVG
- **Connection badges**: coloured pills below each node showing app connections (SD=blue, iOS=green, API=purple, RT=orange, SB=teal, $$=indigo)
- **Warning triangle**: red triangle on nodes with wiring issues
- **Dashed border**: nodes with issues + not_built/partial status get dashed stroke
- **Disconnected count**: progress bar shows "N disconnected" with unplug icon
- **App legend**: full app colour key in the legend bar

### Detail panel enhancements
- **Connected To** section with coloured app badges
- **Wiring Issues** section in red warning box listing specific gaps

## Key wiring gaps discovered and documented

1. **Generated HTML never reaches Supabase** — pipeline writes to local SQLite, sales-dashboard reads from Supabase Storage, manual admin upload is the only bridge
2. **No push notification on lead assignment** — SP only sees new leads on next app open/sync
3. **No auto-trigger from SP signup** — pipeline requires manual API call
4. **Trigger endpoint doesn't exist** — POST /api/jobs/:id/trigger referenced but not in MC routes
5. **iOS has no outcome capture UI** — mobile-api has status endpoint but no structured outcome flow
6. **Learning loop has no API endpoint** — recordOutcome() exists but iOS can't send outcomes back
7. **StrategyProvider reads from empty store** — interface exists but no real strategies flow through

## How to verify

1. Open `http://100.93.24.14:3001/workspace/default/pipeline`
2. Lead Generation tab: see connection badges (SD, API, iOS, RT), warning triangle on "Pipeline triggers", "8 disconnected" in progress bar
3. Pitch to Fulfilment tab: see "23 disconnected", most fulfilment chain nodes have dashed borders and warning triangles
4. Click any node with warning triangle — detail panel shows "Wiring Issues" section with specific gaps
5. Self-Learning Loop tab: see "outcome-attached" node has wiring issue (no API endpoint)

## Known issues

- None
