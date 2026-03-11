# Eval Layer V1 Implementation Spec

Date: 2026-03-11  
Owner: Louis (operator) + Charlie (Lead Orchestrator control plane)  
Status: Ready for build

## 1. Purpose

Add a first-class evaluation layer so Charlie can measure agent quality, not just completion.  
This is the prerequisite for any self-improvement pipeline.

## 2. Scope

In scope:
- Define eval contracts per agent task type.
- Score worker outputs with explicit pass/fail + confidence + fault attribution.
- Persist eval records and feed results into delegation weighting.
- Surface eval outcomes in Mission Control (Lead console + task timeline).
- Add a learning page that turns recent diffs into architecture questions and scores operator answers.

Out of scope (v1):
- Fully autonomous self-modifying agents.
- Multi-node distributed eval workers.
- Replacing existing approval gate behavior.

## 3. Architecture Rules (Locked)

- Single-node only.
- Approval gating remains mandatory for side effects.
- TypeScript only for runtime and UI.
- All delegation remains Charlie-first (no direct worker routing).
- Evals must be explainable: every score requires reason fields.

## 4. Eval Model

Eval unit:
- `task_id`
- `delegation_id`
- `agent_id`
- `eval_spec_id`
- `artifact_set` (deliverables + findings + task activity context)

Eval outputs:
- `quality_score` (0-100)
- `status` (`pass` | `partial` | `fail`)
- `confidence` (0-1)
- `fault_attribution` (`agent_error` | `input_gap` | `mixed` | `unknown`)
- `reason_codes[]`
- `improvement_actions[]`
- `evaluated_at`

## 5. Data Model Additions (Mission Control DB)

New table: `agent_eval_specs`
- `id` TEXT PK
- `workspace_id` TEXT FK
- `agent_id` TEXT FK
- `task_type` TEXT NOT NULL
- `version` INTEGER NOT NULL
- `criteria_json` TEXT NOT NULL
- `rubric_json` TEXT NOT NULL
- `created_at` TEXT
- `updated_at` TEXT

New table: `agent_eval_runs`
- `id` TEXT PK
- `workspace_id` TEXT FK
- `task_id` TEXT FK
- `delegation_id` TEXT FK
- `agent_id` TEXT FK
- `eval_spec_id` TEXT FK
- `quality_score` INTEGER NOT NULL
- `status` TEXT CHECK (`pass`,`partial`,`fail`)
- `confidence` REAL NOT NULL
- `fault_attribution` TEXT CHECK (`agent_error`,`input_gap`,`mixed`,`unknown`)
- `reason_codes_json` TEXT
- `summary` TEXT NOT NULL
- `details_json` TEXT
- `evaluated_at` TEXT

New table: `agent_performance_profiles`
- `agent_id` TEXT PK FK
- `workspace_id` TEXT FK
- `rolling_score` REAL NOT NULL DEFAULT 0
- `pass_rate` REAL NOT NULL DEFAULT 0
- `failure_rate` REAL NOT NULL DEFAULT 0
- `input_gap_rate` REAL NOT NULL DEFAULT 0
- `avg_confidence` REAL NOT NULL DEFAULT 0
- `samples` INTEGER NOT NULL DEFAULT 0
- `updated_at` TEXT

New table: `learning_questions`
- `id` TEXT PK
- `workspace_id` TEXT FK
- `source_type` TEXT CHECK (`git_diff`,`decision_log`,`manual`)
- `source_ref` TEXT
- `question` TEXT NOT NULL
- `expected_answer_json` TEXT NOT NULL
- `concept_tag` TEXT
- `created_at` TEXT

New table: `learning_answers`
- `id` TEXT PK
- `question_id` TEXT FK
- `workspace_id` TEXT FK
- `operator_id` TEXT
- `answer_text` TEXT NOT NULL
- `score` INTEGER NOT NULL
- `grade` TEXT CHECK (`good`,`partial`,`wrong`)
- `feedback` TEXT NOT NULL
- `next_resource` TEXT
- `created_at` TEXT

## 6. API Additions

Lead and eval APIs:
- `POST /api/evals/specs`
- `GET /api/evals/specs?workspace_id=&agent_id=`
- `POST /api/evals/run`
- `GET /api/evals/task/:task_id`
- `GET /api/evals/agent/:agent_id/profile`

Learning page APIs:
- `POST /api/learning/questions/generate`
- `GET /api/learning/questions/latest?workspace_id=`
- `POST /api/learning/questions/:id/answer`
- `GET /api/learning/history?workspace_id=`

## 7. Charlie Integration

Decision pipeline update:
1. Worker submits finding/deliverables.
2. Charlie calls eval runner with matching `eval_spec`.
3. Eval result is persisted.
4. Charlie writes decision log entry with score + attribution.
5. Delegation weighting updates for future routing.
6. If `fail` and `agent_error`, Charlie retries/reassigns under policy.
7. If `fail` and `input_gap`, Charlie asks operator for missing context.

Delegation score formula (v1):
- `total = specialization_fit * 0.40 + availability * 0.15 + reliability * 0.30 + recent_eval_quality * 0.15`
- `reliability` and `recent_eval_quality` come from `agent_performance_profiles`.

## 8. Eval Spec Contract (Per Agent Type)

Each eval spec must define:
- Expected outputs.
- Minimum acceptance criteria.
- Failure patterns to detect.
- Attribution rules (agent vs input).
- Rubric bands:
  - `good` example x3
  - `partial` example x3
  - `wrong` example x3

No eval spec, no autonomous routing for that task type.

## 9. Mission Control UI Additions

Lead Console:
- Add `Eval` column on delegated tasks.
- Add score chips: `PASS/PARTIAL/FAIL`.
- Add attribution tag and top reason code.

Task modal:
- Add `Evaluation` tab:
  - latest eval summary
  - rubric criteria checklist
  - confidence and attribution
  - re-run eval action

Agent modal:
- Add `Performance` tab:
  - rolling score graph
  - pass/fail trend
  - top failure modes

Learning page:
- Route: `/workspace/[slug]/learning`
- Show latest architecture question.
- Accept operator answer and score it.
- Show "why this answer is good/partial/wrong" and next concept resource.

## 10. Testing Plan

Contract tests:
- Eval run requires valid task + delegation + spec.
- Eval result schema completeness.
- Attribution enum constraints.

Behavior tests:
- Charlie uses eval score in next delegation decision.
- Fail with `input_gap` triggers operator request, not blind retry.
- Fail with `agent_error` triggers retry/reassign policy.

UI tests:
- Lead console shows latest eval status.
- Task evaluation tab renders rubric + reason codes.
- Learning page question/answer/score loop works.

Regression tests:
- Approval-gated side effects unchanged.
- Existing planning/session/transcript flows unaffected.

## 11. Rollout Plan

Phase A:
- DB migrations and type models.
- Eval spec CRUD.

Phase B:
- Eval runner + Charlie integration.
- Agent performance profile aggregation.

Phase C:
- Mission Control eval UI.
- Learning page v1 (diff-to-question-to-score loop).

Phase D:
- Delegation weighting switched from static to eval-informed.
- Hardening and telemetry.

## 12. Risks and Controls

Risk: Bad eval rubric teaches wrong behavior.  
Control: Require examples for good/partial/wrong before enabling spec.

Risk: Overfitting to score rather than true quality.  
Control: Include reason codes + human override in lead console.

Risk: Blaming agent for missing input.  
Control: Force explicit fault attribution and branch handling.

## 13. Immediate Task Slices

1. `EXP-010a`: Eval schema + migrations + types.
2. `EXP-010b`: Eval spec CRUD APIs and seed templates.
3. `EXP-010c`: Charlie eval execution and delegation weighting.
4. `EXP-010d`: Mission Control eval UI tabs/panels.
5. `EXP-010e`: Learning page (diff question + answer scoring loop).
