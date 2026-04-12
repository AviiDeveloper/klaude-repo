# SL-MAS Pipeline UI + Enrichment Fixes

**Date:** 2026-04-12
**Branch:** feat/sl-mas-foundation

## What changed

### Pipeline UI in Mission Control
- New pipeline page at `/workspace/[slug]/pipeline` with 4 tabs
- Lead Generation, Pitch to Fulfilment, Self-Learning Loop tabs with:
  - Interactive view: clickable nodes with build status, files, endpoints
  - Figma embed view: embedded FigJam boards
  - Progress bar (built/partial/needed counts)
- Live Runner tab: SVG pipeline graph + controls + node detail panel
- Pipeline nav link in Mission Control header

### Pipeline enrichment fixes
- Fixed OpenRouter model ID (`anthropic/claude-sonnet-4`)
- Fixed LLM Critic JSON parsing (strips markdown code fences)
- Fixed qualifier scoring (businesses with websites still pitchable)
- Fixed lead assigner: reads `_json` suffix fields from profiler, depends on all upstream nodes
- Fixed login route: uses local SQLite, accepts both `name` and `username`
- Merged lead-gen + site-gen into one continuous pipeline

### Live test infrastructure
- `scripts/test-live-pipeline.ts` — end-to-end pipeline test runner
- Creates test salesperson, triggers pipeline, reports results
- 8 real Manchester leads generated and assigned with enriched data

## Files created
- `apps/mission-control/src/app/workspace/[slug]/pipeline/page.tsx`
- `apps/mission-control/src/components/PipelineGraph.tsx`
- `apps/mission-control/src/components/NodeDetail.tsx`
- `apps/mission-control/src/components/PipelineControls.tsx`
- `apps/mission-control/src/components/PipelineRunList.tsx`
- `apps/mission-control/src/components/InteractiveFlowchart.tsx`
- `apps/mission-control/src/lib/flowchart-data.ts`
- `scripts/test-live-pipeline.ts`
- `PIPELINE-UI-HANDOVER.md`
- `SALES-DASHBOARD-HANDOVER.md`

## How to verify
```bash
npm run verify                          # 213 tests, 0 failures
cd apps/mission-control && npx next build  # builds clean
```

## Known issues
- Interactive flowchart renders as vertical list, not matching Figma layout (needs flowchart renderer)
- Lead detail cards in sales dashboard show raw data, not AI-generated content
- Reflection loop wastes API calls (retries brand-intelligence 3x due to low critic scores)
