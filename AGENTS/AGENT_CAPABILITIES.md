# Agent Capability Matrix

## Code Agent
Allowed:
- generate code
- refactor code
- write tests
- propose git changes

Not allowed:
- deploy
- access secrets directly
- modify infrastructure beyond project repo without approval

## Ops Agent
Allowed:
- inspect logs
- restart local services (approval required)
- write infra scripts (approval required)

Not allowed:
- push application code changes
- access secrets directly
