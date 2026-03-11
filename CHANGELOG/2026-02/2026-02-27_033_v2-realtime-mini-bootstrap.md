# 2026-02-27 033 V2 Realtime Mini Bootstrap

## Date and sequence
- Date: 2026-02-27
- Sequence: 033

## Milestone mapping
- Voice mode expansion (post-V1)
- Secure OpenAI Realtime integration bootstrap

## Summary
- Added OpenAI Realtime session broker for server-side session creation.
- Added bridge endpoint `POST /realtime/session` to issue short-lived Realtime session credentials.
- Added runtime wiring in `index.ts` to enable Realtime session endpoint with `OPENAI_REALTIME_ENABLED=true` and `OPENAI_API_KEY`.
- Added browser voice-lab action to request a Realtime Mini session and log readiness.
- Added bridge contract tests for realtime endpoint available/unavailable paths.
- Added ADR documenting interface change and security rationale.

## Files changed
- `src/openclaw/realtimeSessionBroker.ts`
- `src/openclaw/bridgeServer.ts`
- `src/tests/openclawBridgeServer.test.ts`
- `src/index.ts`
- `README.md`
- `TASK_BOARD.md`
- `ADR/ADR-0007-openai-realtime-session-bootstrap.md`

## New components
- `OpenAIRealtimeSessionBroker`
- `POST /realtime/session` bridge endpoint

## Behavior changes
- Bridge can now mint Realtime session credentials for `gpt-realtime-mini` without exposing long-lived API keys in browser clients.
- If realtime is not configured, bridge responds with `503` and explicit error guidance.

## Tests or verification
- `npm run typecheck`
- `npm test`

## Rollback steps
1. Remove `realtimeSessionBroker.ts` and bridge route wiring for `/realtime/session`.
2. Revert runtime env wiring in `src/index.ts`.
3. Revert voice-lab Realtime session trigger button.
4. Revert bridge tests for realtime route behavior.
5. Revert README/task board/ADR updates.
6. Remove this changelog `.md` and `.json` pair.

## Risks and mitigations
- Risk: misconfigured env causes confusion when endpoint unavailable.
- Mitigation: explicit `503` response with clear configuration message.
- Risk: accidental key exposure in frontend code.
- Mitigation: session minting remains server-side; only short-lived `client_secret` is returned.

## Next steps
- Implement direct browser WebRTC Realtime media path using `/realtime/session` credentials.
- Add fallback handoff to existing `/calls/*` pipeline when Realtime setup fails.
