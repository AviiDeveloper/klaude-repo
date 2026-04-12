# Pipeline UI — Interactive Flowchart Handover

## Branch: `feat/sl-mas-foundation`
**Date:** 2026-04-12
**Previous handover:** `SALES-DASHBOARD-HANDOVER.md` (AI lead intelligence for SP cards)

---

## What exists

### Mission Control Pipeline Page
**URL:** `http://127.0.0.1:3000/workspace/default/pipeline`

4 tabs:
1. **Lead Generation** — interactive node list + Figma embed toggle
2. **Pitch to Fulfilment** — interactive node list + Figma embed toggle
3. **Self-Learning Loop** — interactive node list + Figma embed toggle
4. **Live Runner** — SVG pipeline graph + run controls + node detail panel

### What's built
- **Interactive view** (`InteractiveFlowchart.tsx`): Every node from all 3 Figma flowcharts defined as clickable cards with build status (built/partial/not_built), relevant files, endpoints, done items, todo items. Progress bar shows completion per flowchart.
- **Figma embed view**: Embedded FigJam boards for reference + "Edit" link to Figma.
- **Live Runner** (`PipelineGraph.tsx`): SVG node graph of the runtime pipeline with real-time status, controls (trigger, cancel, retry, override), and node detail panel with critic scores.
- **Flowchart data** (`flowchart-data.ts`): 53 nodes across 3 flowcharts, each with status, files, endpoints, done/todo.

### What's wrong
The interactive view renders nodes as a **vertical list** (step 1, 2, 3...) but the Figma flowcharts have **branching paths, parallel nodes, and decision diamonds**. The interactive version should be a proper flowchart layout matching the Figma structure exactly — same positions, same branching, same visual flow.

---

## What needs to be built

### Interactive Flowchart Renderer
Replace the vertical list in `InteractiveFlowchart.tsx` with an SVG/Canvas-based flowchart that:

1. **Matches the Figma layout** — nodes positioned to mirror the flowchart structure (not a flat list)
2. **Supports node types visually**:
   - Rectangles for actions/systems
   - Diamonds for decisions (with Yes/No branches)
   - Rounded rectangles for human actions
   - Hexagons or distinct shape for agents
3. **Branching paths** — e.g., "Owner response?" branches to sale path (left) and rejection path (right)
4. **Parallel nodes** — e.g., "Google Places API" and "Apify Instagram scrape" shown side by side
5. **Connecting edges** with labels (e.g., "Yes", "No", "Unclaimed", "Claimed by other SP")
6. **Status colours** — green border (built), yellow (partial), red (not built)
7. **Clickable** — click a node to see detail panel (files, endpoints, status) on the right
8. **Progress bar** — already exists, keep it

### Layout approach

Each flowchart needs explicit x,y coordinates for every node. The data structure already has `depends_on` but that's not enough for visual layout — you need explicit positions.

**Recommended:** Add `x`, `y`, `width`, `height` to each `FlowchartNode` in `flowchart-data.ts`. Define positions manually to match the Figma layout. This is tedious but guarantees exact visual parity.

**Alternative:** Use a layout algorithm (dagre, elkjs) to auto-compute positions from the dependency graph. Faster but won't match Figma exactly.

### Reference: Figma board URLs
- Lead Gen: `https://www.figma.com/board/AkwCrxbE90kno2bjNoKLC7`
- Pitch to Fulfilment: `https://www.figma.com/board/UsMR2GFR7Y5NhA3xtWUjUA`
- Self-Learning Loop: `https://www.figma.com/board/lYBACgMhVS41eVG04wI3hI`

Use Figma MCP `get_metadata` on each board to extract node positions and structure, then map them to the interactive renderer.

---

## Key files

```
apps/mission-control/src/lib/flowchart-data.ts           — Node definitions (53 nodes, 3 flowcharts)
apps/mission-control/src/components/InteractiveFlowchart.tsx — Current list view (REPLACE with flowchart renderer)
apps/mission-control/src/components/PipelineGraph.tsx      — Live runner SVG graph (keep, separate concern)
apps/mission-control/src/components/NodeDetail.tsx          — Node detail panel (reuse for both views)
apps/mission-control/src/components/PipelineControls.tsx    — Run trigger controls
apps/mission-control/src/components/PipelineRunList.tsx     — Run history list
apps/mission-control/src/app/workspace/[slug]/pipeline/page.tsx — Pipeline page (4 tabs)
apps/mission-control/src/components/Header.tsx              — Nav with Pipeline link
```

## Tech stack
- Next.js 14, React 18, TypeScript
- Tailwind CSS with custom `mc-*` colour tokens (see `tailwind.config.ts`)
- Zustand for state
- Lucide React for icons
- JetBrains Mono font
- Dark theme (`#0d1117` bg, `#c9d1d9` text)

## How to run
```bash
# Runtime (port 4317) — needed for Live Runner tab
cd /path/to/worktree
INTERFACE_MODE=mission-control MISSION_CONTROL_HOST=127.0.0.1 MISSION_CONTROL_PORT=4317 \
  DB_PATH=data/mvp.sqlite \
  GOOGLE_PLACES_API_KEY=... OPENROUTER_API_KEY=... \
  npx tsx src/index.ts

# Mission Control (port 3000)
cd apps/mission-control
NEXT_PUBLIC_MC_API_URL=http://127.0.0.1:4317 npx next dev --hostname 127.0.0.1 --port 3000

# Open
http://127.0.0.1:3000/workspace/default/pipeline
```

## Build verification
```bash
cd apps/mission-control && npx next build    # MC builds clean
npm run verify                                # 213 tests, 0 failures
```

---

## Also pending from previous handover

### Sales Dashboard — AI Lead Intelligence (`SALES-DASHBOARD-HANDOVER.md`)
The pipeline generates raw data but lead cards in the sales dashboard show empty fields. Need AI-generated overviews, talking points, and pitch prep for each lead. See `SALES-DASHBOARD-HANDOVER.md` for full details.

### North Star
Refer to `~/.claude/projects/-Users-Avii-Desktop-klaude-repo/memory/north_star_flow.md` — the complete business flow. Do not deviate without permission.
