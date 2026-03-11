# Failure Mode Matrix

## Agent crash or hang
- Detection: no heartbeat for 10 seconds OR step timeout exceeded
- Action: retry once
- If fails again: mark task blocked and notify via OpenClaw

## Storage write failure
- Detection: DB write error OR artifact write error
- Action: pause execution, mark blocked
- Notify via OpenClaw

## OpenClaw unavailable
- Detection: interface call failure
- Action: continue processing tasks where safe
- Queue notifications for later delivery
- Do not perform side effects without confirmed approval delivery path

## STT failure (voice mode)
- Detection: missing transcripts or stream error
- Action: request user to repeat
- Fallback to OpenClaw text message for the same session where possible

## Model timeout
- Retry once
- If fails again: mark blocked and notify via OpenClaw with a short diagnostic summary
