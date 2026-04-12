# Pipeline Artifact Viewer + Copy for Claude Code

## What changed
- **Created** `apps/mission-control/src/components/ArtifactViewer.tsx` — type-specific viewers for all pipeline agents (Scout, Brand Analyser, Brand Intelligence, Qualifier, Composer, QA) plus JSON fallback
- **Created** `apps/mission-control/src/hooks/usePipelineArtifacts.ts` — hook to fetch artifacts from pipeline runtime API
- **Created** `apps/mission-control/src/components/CopyForClaude.tsx` — formats node + artifact data as markdown for clipboard
- **Modified** `apps/mission-control/src/components/InteractiveFlowchart.tsx` — added Output tab to detail panel with artifact rendering and Copy for Claude Code button
- **Modified** `apps/mission-control/src/lib/flowchart-data.ts` — added `pipelineNodeIds` field mapping flowchart nodes to pipeline agent IDs

## Why
Pipeline agents produce outputs (leads, brand colours, HTML sites, QA scores) but there was no way to inspect them visually. Users need to see what each agent actually produced, verify quality, and easily reference findings to Claude Code for tweaking.

## Stack
- Next.js 14, React 18, TypeScript
- Tailwind CSS with mc-* colour tokens
- Pipeline runtime REST API (port 4317)

## Integrations
- Pipeline runtime `GET /api/job-runs` and `GET /api/job-runs/:runId` for artifact data
- Asset file server `GET /api/files/download?relativePath=...&raw=true` for photo thumbnails

## How to verify
1. Open `http://100.93.24.14:3001/workspace/default/pipeline`
2. Click any pipeline node (e.g. AGENT-01: Scraper)
3. Output tab should appear showing agent outputs from latest run
4. Click "Copy for Claude Code" — paste in terminal to see markdown summary
5. If runtime is down, shows "Pipeline runtime unavailable" gracefully

## Known issues
- Requires pipeline runtime (port 4317) to be running with completed job runs
- Photo thumbnails depend on .assets directory being populated by scout agent
