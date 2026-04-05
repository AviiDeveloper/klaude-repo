# ADR-0006: Multi-Agent Expansion Track (Post-MVP)

## Status
Accepted (implemented via EXP-003 series, ADR-0012)

## Date
2026-02-27

## Context
Current MVP constraints are intentionally narrow (single node, two agents, approval-gated side effects) to deliver a reliable voice-first core.
The next-stage product direction requires:
- Mission Control with richer orchestration
- Recurring/scheduled tasks
- Agent-to-agent handoff pipelines
- Mixed execution backends (local models, API models, OAuth-connected services)
- Expansion from 2 to approximately 8 specialized agents

## Decision
Define a post-MVP expansion track that preserves current core safety model while extending orchestration capabilities in phases.
This ADR authorizes planning artifacts and phased implementation after MVP hardening.

## Scope of Expansion Track
- Scheduler and recurrence engine
- Pipeline DAG execution model (agent chaining)
- Provider routing policy per agent
- Mission Control workflow UX for recurring tasks and approvals
- Multi-provider authentication and secret-scoped execution

## Non-Goals (for this ADR)
- Immediate removal of current MVP limits in active production path
- Unbounded autonomous execution without approval controls

## Consequences
Positive:
- Clear path to scale without interrupting current MVP flow
- Maintains compatibility with existing safety and trace contracts

Negative:
- Requires staged migration from current 2-agent assumptions
- Additional complexity in observability and failure handling

## Follow-up
- Create expansion roadmap artifact
- Define 8-agent contract matrix and handoff rules
- Propose SPEC/CONSTRAINT updates when implementation phase starts
