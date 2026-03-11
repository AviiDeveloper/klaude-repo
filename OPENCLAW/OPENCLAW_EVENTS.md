# OpenClaw Event Mapping

## inbound: openclaw.message_received
Triggers:
- Caller model intent parse
- Orchestrator task creation if needed
- Two-phase response behavior

## inbound: openclaw.voice_transcript_partial
Triggers:
- optional live caption updates
- no task creation yet unless explicitly configured

## inbound: openclaw.voice_transcript_final
Triggers:
- Caller model generates acknowledgement
- Orchestrator creates or updates task
- Orchestrator dispatches plan steps

## inbound: openclaw.approval_decision
Triggers:
- Orchestrator unblocks task step execution if approved
- Orchestrator cancels denied steps

## inbound: openclaw.lead_command
Triggers:
- Lead Orchestrator command intake (operator-only control path)
- Command is logged to operator command history
- Lead emits status update event for acknowledgement

## outbound: system.approval_request
Must include:
- task_id
- side_effects list
- risks
- rollback notes
- decision options (approve, deny)

## outbound: system.call_user
Triggers:
- blocked tasks
- repeated failures
- missing inputs
- stop conditions met

## outbound: system.lead_status
Must include:
- task_id (if command/task-scoped)
- lead status summary
- next action expected from operator (if any)

## outbound: system.lead_approval_request
Must include:
- task_id
- approval_request_id
- recommendation
- risks
- decision options
