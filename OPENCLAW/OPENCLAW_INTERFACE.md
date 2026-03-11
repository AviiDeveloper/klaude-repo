# OpenClaw Interface Contract

OpenClaw is the primary interface layer for:
- inbound user messages or voice transcripts
- outbound assistant messages or audio responses
- approval requests and approval decisions
- notifications and call-backs

## Inbound event types (minimum)
- openclaw.message_received
- openclaw.voice_transcript_partial (optional)
- openclaw.voice_transcript_final (optional)
- openclaw.approval_decision
- openclaw.session_started
- openclaw.session_ended

## Outbound event types (minimum)
- system.message_send
- system.voice_speak (optional)
- system.approval_request
- system.notify_user
- system.call_user (optional)

## Required event fields
All events must include:
- event_id
- timestamp
- session_id
- user_id
- payload

## Fail-closed rule for approvals
If OpenClaw cannot deliver approval requests or receive decisions, the system must not execute side effects.

## Context continuity requirement
Each OpenClaw session must be associated with:
- session_id
- active_task_id (if any)
- changelog_change_id (latest build change applied)

This ensures conversations can be interpreted against the correct system version.
