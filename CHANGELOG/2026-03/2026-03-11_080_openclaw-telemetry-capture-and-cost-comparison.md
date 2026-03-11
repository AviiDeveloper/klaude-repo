# 2026-03-11 080 OpenClaw Telemetry Capture And Cost Comparison

## Why
- Estimated spend is useful for trend visibility, but the operator needs a direct way to compare estimates against actual billed cost.
- Mission Control did not persist exact OpenClaw request-level cost/usage fields previously.

## What Changed
- Added persistent request telemetry table for OpenClaw responses:
  - `ai_request_telemetry` (request id, method, provider, model, tokens, cost_usd, finish reason, status, request/response payloads)
- Added migration:
  - `010_add_ai_request_telemetry`
- Added non-blocking telemetry logger:
  - `apps/mission-control/src/lib/openclaw/telemetry.ts`
- Wired telemetry capture into OpenClaw RPC response handling:
  - Captures both `type: res` and legacy JSON-RPC response flows.
  - Never blocks/rejects runtime behavior if telemetry persistence fails.
- Extended cost observability model:
  - workspace estimated total
  - workspace actual captured total (from telemetry)
  - delta (estimated - actual)
  - provider/model actual breakdown
  - agent actual captured total + delta + breakdown
- Added telemetry inspection API:
  - `GET /api/costs/telemetry?workspace_id=...&limit=...`
- Updated Cost Observatory UI to show estimated vs actual captured totals and model/provider breakdown.
- Updated Agent performance panel to show estimated vs actual captured spend.

## Validation
- `npm run typecheck`
- `npm run mc:build`

## Notes
- “Actual captured” reflects only requests where OpenClaw response payload exposes cost fields.
- Missing cost in payload is treated as unknown actual cost (not silently estimated).
- This enables direct estimate-vs-capture comparison today and provides the data path for full billing reconciliation later.
