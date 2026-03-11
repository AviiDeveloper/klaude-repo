# 2026-03-02 045 Next.js OpenClaw Fetch Hardening

## Date and sequence
- Date: 2026-03-02
- Sequence: 045

## Milestone mapping
- Expansion track: Mission Control runtime stability

## Summary
- Hardened frontend polling paths that read OpenClaw session state to prevent unhandled runtime errors when fetch fails.
- Added safe fetch helper with timeout + null fallback in Agents sidebar and Header polling flows.
- Converted polling callbacks to fire-and-forget wrappers so rejected promises do not surface as unhandled errors.

## Files changed
- `apps/mission-control/src/components/AgentsSidebar.tsx`
- `apps/mission-control/src/components/Header.tsx`
- `TASK_BOARD.md`
- `src/index.ts`

## Behavior changes
- OpenClaw fetch failures now degrade gracefully (sub-agent counters reset to 0, no runtime crash overlay).
- Sidebar/session polling continues running even when gateway is unavailable.

## Tests or verification
- `npm run mc:build`
- Manual runtime verification on `http://127.0.0.1:3000`

## Rollback steps
1. Revert safe-fetch helpers in `AgentsSidebar.tsx` and `Header.tsx`.
2. Restore previous polling implementations.
3. Revert `TASK_BOARD.md` and `src/index.ts` updates.
4. Delete this changelog pair.

## Next steps
- Apply same safe polling wrapper pattern to remaining components (`SessionsList`, `ActivityLog`, `DeliverablesList`) for full consistency.
