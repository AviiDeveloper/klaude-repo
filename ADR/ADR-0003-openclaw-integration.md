# ADR-0003: OpenClaw as Primary Interface Layer

## Status
Accepted

## Context
System must be linked using OpenClaw for inbound requests, approvals, notifications, and voice handling.

## Options Considered
1. OpenClaw-first integration
2. Per-channel direct integrations

## Decision
OpenClaw-first integration.

## Rationale
Centralizes interface logic and keeps orchestration and agent logic separate from channel plumbing.

## Consequences
- Must define strict event contracts with OpenClaw
- Must support graceful degradation when OpenClaw is unavailable
