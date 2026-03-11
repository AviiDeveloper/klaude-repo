# ADR-0001: Single Node Only for MVP

## Status
Accepted

## Context
Initial concept included multiple nodes. MVP needs speed, simplicity, and reliable debugging.

## Options Considered
1. Single node
2. Multi node

## Decision
Single node only.

## Rationale
Reduces operational risk and complexity. Improves iteration speed and makes audits simpler.

## Consequences
- Must keep interfaces clean so later scaling is possible
- Performance is limited by single machine resources
