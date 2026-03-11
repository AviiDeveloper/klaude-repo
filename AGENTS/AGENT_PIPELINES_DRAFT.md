# Agent Pipelines Draft (8-Agent Target)

## Agent roles (draft)
1. `idea-agent`: ideation and topic generation
2. `research-agent`: source gathering and evidence extraction
3. `script-agent`: structured script drafting
4. `code-agent`: implementation and automation code
5. `ops-agent`: execution environment and runtime checks
6. `qa-agent`: validation, tests, and guardrail checks
7. `publish-agent`: distribution formatting and channel packaging
8. `analytics-agent`: performance analysis and optimization suggestions

## Example chained workflow
1. `idea-agent` generates candidates
2. `research-agent` validates top ideas
3. `script-agent` writes production script
4. `qa-agent` checks quality and policy gates
5. `publish-agent` packages assets for target channels
6. `analytics-agent` logs outcome and suggests next iteration

## Provider routing (draft)
- Local models: fast iterative tasks and private data processing
- API models: high-quality generation and structured reasoning
- OAuth services: external platform actions (publish, retrieve metrics)

## Core invariants
- Side effects remain approval-gated
- Every handoff event is trace-logged
- Each agent step has explicit timeout/retry policy
- Pipeline resumes from last durable checkpoint after restart
