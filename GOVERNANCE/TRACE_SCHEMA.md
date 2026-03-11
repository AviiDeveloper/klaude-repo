# Execution Trace Contract

Each task must produce an immutable trace record.

## Required fields
- task_id: string
- objective: string
- created_at: timestamp
- build_version: string
- changelog_change_id: string
- final_state: string
- timeline: array of events
- approvals: array
- side_effects: array
- artifacts: array

## Timeline event schema
Each event:
- timestamp
- event_type (task.created, plan.generated, agent.requested, agent.completed, approval.requested, approval.resolved, notify.requested, error)
- component (openclaw, caller_model, orchestrator, agent.code, agent.ops, storage, queue)
- summary (short)
- details (structured JSON where possible)

## Approval record schema
- approval_id
- requested_at
- resolved_at
- requested_by
- channel (openclaw)
- decision (approved, denied)
- scope (what actions it covers)
- expires_at

## Side effect schema
- type (file_write, shell_exec, network_call, git_push, message_send, deploy)
- description
- approved_by_token_id
- started_at
- ended_at
- result
