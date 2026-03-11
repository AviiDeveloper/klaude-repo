# Resource Budget (Single Node)

## Goals
Keep the system stable under local constraints.

## Budgets
- Reserve at least 25 percent RAM for OS and background services.
- Limit concurrent heavy agent tasks to 1.
- Caller model must be lightweight and always responsive.
- Orchestrator should avoid long blocking operations.

## Rules
- When system memory pressure is high, reduce concurrency before failing tasks.
- Prefer queueing over parallel execution.
