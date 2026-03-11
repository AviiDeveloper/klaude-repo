# Prompt Governance

## Global Rules
- Caller model never performs multi-step planning.
- Orchestrator must output a structured plan for every task.
- Agents must only execute plan steps.
- No component may be introduced unless SPEC.md or an ADR explicitly allows it.

## Required Output Discipline
- All outputs must match schemas in AGENTS/AGENT_CONTRACTS.md and GOVERNANCE/TRACE_SCHEMA.md.
- Orchestrator must explicitly list side effects for every task.

## Forbidden Behaviors
- Adding new services not in the spec
- Performing side effects without approval token
- Storing secrets in logs or prompts
- Changing file paths or schemas without updating the spec and an ADR

## When uncertain
1) State assumptions
2) Provide up to 3 options
3) Recommend one option with justification
