# Deployment Blueprint (Single Node)

## Services (MVP)
- openclaw-adapter (interface boundary)
- orchestrator
- agent-code
- agent-ops
- mission-control (optional minimal UI)
- database (sqlite or postgres)

## Local runtime
- Prefer a single process supervisor
- Prefer containerization only if it reduces risk

## Startup order
1) database
2) queue tables or queue service
3) orchestrator
4) agents
5) openclaw-adapter
6) mission-control
