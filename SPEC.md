# Local Voice-Orchestrated Agent System
## Master Specification (Single Node + OpenClaw)
Version: 0.2
Owner: Louis
Status: Active Source of Truth

---

# 1. Vision

Build a local, multi-agent AI system that:
- Accepts real-time voice interactions
- Engages in natural conversation
- Creates and schedules structured tasks
- Delegates work to specialized agents
- Requests approval before side-effect actions
- Logs all decisions and actions
- Integrates with OpenClaw as the primary interface layer

This document is the single source of truth. All implementation must conform.

---

# 2. Non Goals (MVP)

Out of scope for MVP:
- Multi-node clustering
- Full autonomy without approvals
- Fine-tuning custom models
- Multi-tenant architecture
- Enterprise RBAC

---

# 3. Definition of Done (MVP)

MVP is complete when:
1. OpenClaw routes text or voice input into the system.
2. If voice is enabled, streaming STT provides partial and final transcripts.
3. The system provides two-phase responses to reduce awkward pauses.
4. The system can create a structured Task object and persist it.
5. The system routes tasks to at least two specialist agents (local workers).
6. Approval gating blocks all side effects until approved via OpenClaw.
7. Full audit trail exists per task: prompts, decisions, tool calls, outputs, errors.
8. The system can notify or call back via OpenClaw when blocked.

---

# 4. High-Level Architecture (Single Node)

## 4.1 Core Components

1) OpenClaw Interface Layer
- Primary ingress and egress for user interaction
- Provides: input events, output messages, approvals, notifications, optional call control

2) STT and TTS (optional for MVP until Milestone 4)
- Streaming transcription and streaming speech output
- May be provided by OpenClaw or by local services invoked by OpenClaw

3) Caller Model
- Lightweight conversational model for:
  - intent detection
  - clarification
  - fast acknowledgements
  - user-facing summaries
- Caller Model does not do heavy task planning

4) Orchestrator
- Creates tasks
- Builds plans
- Routes steps to agents
- Enforces approval gates
- Monitors execution and reliability rules
- Writes full trace logs

5) Agent Runtime
- Standard request/response schema
- Tool access constraints
- Logging

6) Mission Control (minimal MVP acceptable)
- UI or local web panel showing:
  - tasks
  - approvals
  - statuses
  - logs
  - artifacts

7) Queue / Event Bus
- Single-node queue for dispatching plan steps and tracking events
- Must support:
  - task.created
  - agent.requested
  - agent.completed
  - approval.requested
  - approval.resolved
  - notify.requested

8) Storage
- Local DB for state
- Local filesystem for artifacts
- Logs are immutable and append-only

---

# 5. Voice Performance Requirements

## 5.1 Latency Targets
- Partial transcription within 300 to 700 ms (if streaming STT enabled)
- Initial acknowledgement within 800 to 1500 ms after user finishes a phrase
- No silence longer than 3 seconds without a progress update

## 5.2 Two-Phase Response Rule
Phase 1: Immediate acknowledgement (fast)
Phase 2: Detailed response (after agents complete)

If processing exceeds 3 seconds, provide periodic progress narration via OpenClaw.

---

# 6. Task System Specification

## 6.1 Task Object Fields
- id
- title
- created_at
- status
- objective (one sentence)
- constraints
- plan_steps[]
- assigned_agents[]
- approvals_required[]
- artifacts[]
- logs[]
- side_effects[]
- rollback_plan
- stop_conditions[]

## 6.2 Task Status States
- created
- awaiting_approval
- in_progress
- blocked
- failed
- completed

---

# 7. Agents (MVP)

## 7.1 Code Agent
- code generation
- refactoring
- test creation
- repo operations (approval required)

## 7.2 Ops Agent
- local infra scripts
- process and service monitoring
- local deployment scripts (approval required)

MVP requires at least two agents.

---

# 8. Orchestrator Rules

## 8.1 Mandatory Outputs Per Task
For every task, orchestrator must produce:
- Task ID
- Objective
- Plan (3 to 8 steps)
- Agents assigned
- Explicit side effects list
- Inputs needed
- Rollback plan
- Stop conditions

## 8.2 Approval Required If
- Writing files outside sandbox directory
- Executing shell commands
- Network calls outside allowlist
- Git push
- Sending messages
- Deploying services

## 8.3 Notify or Call Back Via OpenClaw If
- Credentials missing
- Ambiguous instruction with side effects
- Agent fails twice
- Risk score above threshold
- Any stop condition is met

---

# 9. Linear Build Plan (Milestones)

## Milestone 1: OpenClaw text loop
- OpenClaw inbound events create tasks
- Caller model acknowledges and clarifies
- DB persistence
- Manual task execution allowed

## Milestone 2: Orchestrator + two agents
- Implement agent contracts
- Dispatch steps to Code Agent and Ops Agent
- Minimal Mission Control showing state

## Milestone 3: Approval gating via OpenClaw
- approval.requested flow
- approval.resolved flow
- Execution blocked until approved

## Milestone 4: Voice mode
- STT and TTS integrated through OpenClaw
- Two-phase response enforced
- Latency metrics recorded

---

# 10. Model Usage Policy

Caller Model:
- fast, lightweight, conversational
- outputs structured intent and short user-facing messages

Orchestrator:
- produces structured plans and routing decisions

Agents:
- must follow plan steps
- must not expand architecture
- must never perform side effects without approval token
