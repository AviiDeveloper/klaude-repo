# SVG Flowchart Renderer — Matching Figma Boards

**Date:** 2026-04-12
**Branch:** `feat/sl-mas-foundation`

## What changed

- **Created** `apps/mission-control/src/lib/flowchart-layout.ts` — layout definitions (positions + edges) for all 3 flowcharts, extracted from Figma FigJam board coordinates
- **Rewrote** `apps/mission-control/src/components/InteractiveFlowchart.tsx` — replaced vertical node list with SVG-based flowchart renderer

## Why

The pipeline page rendered flowchart nodes as a flat vertical list, losing the branching structure that makes the business flow understandable. The Figma boards are the north star — the interactive version should be the same visual with build status overlaid.

## Stack

- Next.js 14, React 18, TypeScript
- Pure SVG rendering (no external graph library)
- Tailwind CSS with `mc-*` colour tokens

## What the renderer supports

- **Node shapes**: rectangles (action/system/human/external/agent), diamonds (decisions)
- **Status colours**: green border (built), yellow (partial), red (not built) with status dot
- **Type indicators**: coloured left bar per node type (blue=human, purple=agent, grey=system, yellow=decision, green=action, pink=external)
- **Branching paths**: parallel nodes (Google Places + Apify side by side), decision branches (Yes/No/Interested/Rejected)
- **Labeled edges**: "Yes", "No — regenerate", "Interested", "Rejected", "Generate new", "Claimed by other SP", etc.
- **Loop edges**: QC regeneration loop, lead availability cycle, payment retry, learning retry, strategy feedback
- **Dashed edges**: strategy injection → next pipeline run
- **Clickable nodes**: click to open detail panel showing files, endpoints, done/todo items
- **Progress bar**: per-flowchart build completion
- **Type legend**: colour key for node types
- **Scrollable canvas**: SVG sized to content with overflow scroll

## Layout source

Positions extracted from Figma FigJam boards via `get_figjam` MCP tool:
- Lead Gen: `AkwCrxbE90kno2bjNoKLC7` — 20 nodes, complex branching + loop-back
- Pitch to Fulfilment: `UsMR2GFR7Y5NhA3xtWUjUA` — 25 nodes, interested/rejected split + fulfilment chain
- Self-Learning Loop: `lYBACgMhVS41eVG04wI3hI` — 11 nodes, retry loop + strategy feedback (inferred from dep graph, Figma rate-limited)

## How to verify

1. `cd apps/mission-control && npx next build` — builds clean
2. Open `http://100.93.24.14:3001/workspace/default/pipeline`
3. Click Lead Generation / Pitch to Fulfilment / Self-Learning Loop tabs
4. Verify SVG flowchart with branching paths, diamonds, labeled edges
5. Click nodes to see detail panel on right
6. Toggle to Figma view to compare layouts

## Known issues

- Self-Learning Loop layout is inferred (Figma API rate-limited) — may not match Figma pixel-perfect
- No pan/zoom — relies on browser scroll
- Edge routing uses polyline waypoints for loops — not smooth curves on loop-back edges
