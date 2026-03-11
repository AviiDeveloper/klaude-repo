# Latency Budget

Applies primarily to voice mode.

## Targets
- STT partial: 300 to 700 ms
- Caller ack generation: 300 to 900 ms
- TTS start after text: under 1000 ms
- Orchestrator plan generation: under 1500 ms for simple tasks
- Agent dispatch overhead: under 200 ms

## Rules
- If any layer exceeds budget consistently, redesign that layer.
- If agent work takes longer than 3 seconds, system must send progress narration via OpenClaw.
