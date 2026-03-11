# Eval Verification Pipeline

## Purpose

Run a deterministic, repeatable pipeline that stress-tests the Eval Layer and reports:
- scoring correctness per scenario
- fault attribution correctness
- rolling profile aggregation behavior
- evaluation latency performance

## Command

From repo root:

```bash
npm run mc:eval:verify
```

Or directly in app:

```bash
cd apps/mission-control
npm run eval:verify
```

## What It Tests

The pipeline creates an isolated temporary SQLite DB and executes scenarios:

1. `strong-output-pass`
- expects `status=pass`, `fault=unknown`

2. `partial-output-partial`
- expects `status=partial`, `fault=agent_error`

3. `thin-output-agent-fail`
- expects `status=fail`, `fault=agent_error`

4. `weak-input-gap-fail`
- expects `status=fail`, `fault=input_gap`

It then validates:
- all scenario expectations pass
- performance profile sample count matches scenario count
- average eval latency meets target (`avg < 80ms`)

## Output

The script prints:
- per-scenario result rows
- performance summary
- gate checks (`PASS`/`FAIL`)

If any gate fails, the command exits non-zero.
