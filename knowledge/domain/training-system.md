---
tags: [training, academy, mobile, onboarding]
related: [../entities/entity-training.md]
---

# Training System (SalesFlow Academy)

Mobile-only feature teaching salespeople how to pitch effectively. Structured as units containing lessons.

## Structure

- **Training Unit** — a topic (e.g., "First Visit", "Handling Objections"). Has title, subtitle, estimated minutes, sort order.
- **Training Lesson** — a step within a unit. Stored as JSON array in `training_units.lessons_json`.
- **Lesson types**: reading content, scenario-based questions with scored options.

## Progress Tracking

- `training_progress` table: tracks per-user, per-unit progress.
- Fields: `lesson_index` (how far they've gotten), `status` (locked/in_progress/completed), `score`.
- `UNIQUE(user_id, unit_id)` — one progress row per user per unit.

## Scoring

- `training_responses` table: records each answer to scenario questions.
- Fields: `scenario_id`, `selected_option`, `score` (integer), `responded_at`.
- Overall unit score aggregated from individual response scores.

## Availability

- **Defined in**: `apps/mobile-api/src/training-content.ts` (seed data).
- **Database tables**: `training_units`, `training_progress`, `training_responses` (SQLite, mobile-api only).
- **API endpoints**: `GET /training/units`, `GET /training/units/:id`, `POST /training/progress`, `POST /training/responses`.
- **iOS models**: `TrainingUnit`, `TrainingLesson`, `TrainingProgressDTO`, `TrainingResponseDTO` in `Models.swift`.
- **Not available in**: sales-dashboard or admin-panel (mobile-only feature).
