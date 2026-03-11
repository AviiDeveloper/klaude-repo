# 2026-02-27 018 Expansion Track Design Docs

## Date and sequence
- Date: 2026-02-27
- Sequence: 018

## Milestone mapping
- Post-MVP expansion planning
- Supports future changes beyond current MVP constraints

## Summary
- Added ADR for post-MVP multi-agent expansion track.
- Added expansion roadmap phases for scheduler, pipelines, provider routing, and operations.
- Added 8-agent pipeline draft with role matrix and handoff model.
- Kept current runtime implementation path unchanged.

## Files changed
- `ADR/ADR-0006-multi-agent-expansion-track.md`
- `ROADMAP_EXPANSION.md`
- `AGENTS/AGENT_PIPELINES_DRAFT.md`

## New components
- Planning artifacts only (no runtime code changes).

## Behavior changes
- None. This change documents a future path and does not modify active execution behavior.

## Tests or verification
- `npm run verify`

## Rollback steps
1. Remove ADR-0006.
2. Remove `ROADMAP_EXPANSION.md`.
3. Remove `AGENTS/AGENT_PIPELINES_DRAFT.md`.
4. Remove this changelog `.md` and `.json` pair.

## Risks and mitigations
- Risk: roadmap assumptions diverge from future SPEC/constraints updates.
- Mitigation: ADR marks track as proposed and requires future formal spec updates before implementation.

## Next steps
- Continue active build flow with `M5-004`.
- Begin expansion implementation only after MVP cut and approved spec updates.
