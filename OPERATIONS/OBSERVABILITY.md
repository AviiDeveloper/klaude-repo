# Observability Requirements

## Required Metrics
- task_queue_length
- tasks_by_state
- agent_heartbeat_age_seconds
- step_duration_seconds
- approval_latency_seconds
- voice_ack_latency_ms (if voice mode)
- error_rate_by_component

## Required Logs
- All model inputs and outputs (redacted)
- All tool calls
- All commands executed
- All file writes with paths and hashes
- All network calls with destination allowlist decision
- All OpenClaw inbound and outbound events (payloads sanitized)

## Health Checks
- OpenClaw connectivity
- DB connectivity
- Queue latency
- Agent heartbeats
