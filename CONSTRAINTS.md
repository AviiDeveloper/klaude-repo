# Hard Constraints (Single Node MVP)

## Scope
- Single machine only
- OpenClaw is the primary integration layer
- No cluster scheduling
- No Kubernetes
- No microservice sprawl

## System Limits
- Max 2 agents in MVP core (Code Agent, Ops Agent). Expanded to 8-agent DAG topology in EXP-003 (see ADR-0012).
- Max 1 orchestrator service
- Max 1 queue implementation

## Security Limits
- No secrets in prompts
- No secrets in logs
- Side effects require approval token

## Performance Limits
- Voice acknowledgements under 1.5 seconds when voice mode is enabled
- No silence longer than 3 seconds without progress message
- Retry at most once for agent failures before blocking

## Complexity Limits
- Prefer a single language runtime for orchestrator + agents
- Prefer Postgres or SQLite for state
- Prefer simple queue patterns that are inspectable and debuggable
