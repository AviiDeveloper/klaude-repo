# 2026-03-02 040 ClawDeck Visual Integration

## Date and sequence
- Date: 2026-03-02
- Sequence: 040

## Milestone mapping
- Expansion track: Mission Control UX integration

## Summary
- Integrated ClawDeck visual language into Mission Control frontend (dark palette, monospace command-center style, ClawDeck branding).
- Preserved and reused the existing Mission Control API surface without introducing a second runtime.
- Kept tracking-free implementation and retained local single-node architecture.
- Verified local typecheck/tests and remote Pi build/runtime availability.

## Files changed
- `src/missionControl/server.ts`
- `src/index.ts`

## New components
- ClawDeck-themed embedded Mission Control web UI skin.

## Behavior changes
- Mission Control now renders with ClawDeck-inspired styling while maintaining existing scheduler, DAG, queue, telephony, notification, and task controls.

## Tests or verification
- `npm run typecheck`
- `npm test`
- Pi runtime smoke (`/api/health`, `/`)

## Rollback steps
1. Revert `renderHtml()` style/theme modifications in `src/missionControl/server.ts`.
2. Revert build change id update in `src/index.ts`.
3. Remove this changelog pair.

## Risks and mitigations
- Risk: visual-only integration may diverge from upstream ClawDeck component behavior.
- Mitigation: API bindings kept stable and can be incrementally componentized later.

## Next steps
- Componentize the embedded UI into separate TS modules for easier ongoing merges from ClawDeck source.
- Optionally add route-level UI modes (`classic` and `clawdeck`) for operator preference.
