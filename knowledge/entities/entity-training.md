---
tags: [entity, training, academy, mobile]
related: [../domain/training-system.md]
---

# Entity: Training (Units, Lessons, Progress)

Training content for the SalesFlow Academy — teaches salespeople how to pitch effectively.

## Training Unit

| Field | Type | Notes |
|---|---|---|
| unit_id | text PK | UUID |
| title | text | Unit name |
| subtitle | text | Short description |
| estimated_minutes | int | Default 10 |
| sort_order | int | Display order |
| is_advanced | int | 0 = beginner, 1 = advanced |
| lessons_json | text | JSON-encoded array of TrainingLesson objects |

## Training Lesson (embedded in lessons_json)

Each lesson is a JSON object with: title, type (reading/scenario), content, and for scenarios: scenario_id, options array (text, score, feedback).

## Training Progress

| Field | Type | Notes |
|---|---|---|
| id | text PK | UUID |
| user_id | text | Salesperson |
| unit_id | text | Training unit |
| lesson_index | int | Current position (0-based) |
| status | text | locked/in_progress/completed |
| started_at | timestamp | |
| completed_at | timestamp | |
| score | real | Aggregated score |

Constraint: `UNIQUE(user_id, unit_id)` — one row per user per unit.

## Where Defined

- **Seed data**: `apps/mobile-api/src/training-content.ts`
- **Database**: `apps/mobile-api/src/db.ts` (training_units, training_progress, training_responses)
- **API**: `apps/mobile-api/src/routes/training.ts`
- **iOS**: `Models.swift` — `TrainingUnit`, `TrainingLesson`, `TrainingProgressDTO`, `TrainingResponseDTO`
- **Not in**: sales-dashboard or admin-panel
