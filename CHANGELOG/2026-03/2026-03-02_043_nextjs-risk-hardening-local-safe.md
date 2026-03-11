# 2026-03-02 043 Next.js Risk Hardening (Local Safe Mode)

## Date and sequence
- Date: 2026-03-02
- Sequence: 043

## Milestone mapping
- Expansion track: Mission Control integration hardening

## Summary
- Upgraded imported Mission Control Next.js runtime from `14.2.21` to `14.2.35`.
- Removed the previously reported critical vulnerability from `npm audit`.
- Added localhost-only safe run scripts for development and start flows.

## Files changed
- `apps/mission-control/package.json`
- `package.json`
- `README.md`
- `TASK_BOARD.md`
- `src/index.ts`

## Behavior changes
- New safer run commands:
  - `npm run mc:dev:safe`
  - `npm run mc:start:safe`
- Safe mode binds to `127.0.0.1` only.

## Tests or verification
- `npm --prefix apps/mission-control install`
- `npm --prefix apps/mission-control audit --json` (critical reduced to 0)
- `npm run mc:build`

## Risks and mitigations
- Remaining advisories are primarily framework/toolchain-level and require major upgrades (`next@16`/`eslint-config-next@16`) for full remediation.
- Mitigation: keep this imported app local-only in development and avoid internet exposure until major upgrade pass.

## Next steps
- Plan a controlled upgrade branch for `next@16` compatibility testing.
- Remove or isolate non-essential API routes if internet-exposed deployment is required before major upgrade.
