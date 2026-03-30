import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { requireAuth, getUser } from '../auth.js';
import { queryAll, queryOne, run } from '../db.js';
import { TRAINING_UNITS } from '../training-content.js';

const router = Router();
router.use(requireAuth);

// Seed training units on first access
function ensureSeeded() {
  const count = queryOne<{ c: number }>('SELECT COUNT(*) as c FROM training_units');
  if (!count || count.c === 0) {
    const now = new Date().toISOString();
    for (const unit of TRAINING_UNITS) {
      run(
        'INSERT OR IGNORE INTO training_units (unit_id, title, subtitle, estimated_minutes, sort_order, is_advanced, lessons_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        unit.unit_id, unit.title, unit.subtitle, unit.estimated_minutes, unit.sort_order, unit.is_advanced, unit.lessons_json, now
      );
    }
  }
}

// GET /training — list units + user progress
router.get('/', (req, res) => {
  ensureSeeded();
  const { user_id } = getUser(req);

  const units = queryAll<Record<string, unknown>>(
    'SELECT unit_id, title, subtitle, estimated_minutes, sort_order, is_advanced FROM training_units ORDER BY sort_order'
  );

  const progress = queryAll<Record<string, unknown>>(
    'SELECT unit_id, lesson_index, status, score, started_at, completed_at FROM training_progress WHERE user_id = ?',
    user_id
  );

  const progressMap = new Map(progress.map(p => [p.unit_id as string, p]));

  // Auto-determine status: first unit is available if no progress exists
  const enriched = units.map((unit, i) => {
    const prog = progressMap.get(unit.unit_id as string);
    let status = prog?.status ?? 'locked';

    if (i === 0 && !prog) {
      status = 'available';
    } else if (!prog && i > 0) {
      // Check if previous unit is completed
      const prevUnit = units[i - 1];
      const prevProg = progressMap.get(prevUnit.unit_id as string);
      if (prevProg?.status === 'completed') {
        status = 'available';
      }
    }

    return {
      ...unit,
      status,
      lesson_index: (prog?.lesson_index as number) ?? 0,
      score: (prog?.score as number) ?? 0,
    };
  });

  res.json({ units: enriched });
});

// GET /training/:unitId — unit detail with lessons content
router.get('/:unitId', (req, res) => {
  ensureSeeded();
  const { user_id } = getUser(req);
  const { unitId } = req.params;

  const unit = queryOne<Record<string, unknown>>(
    'SELECT * FROM training_units WHERE unit_id = ?', unitId
  );
  if (!unit) {
    res.status(404).json({ error: 'Unit not found' });
    return;
  }

  const progress = queryOne<Record<string, unknown>>(
    'SELECT * FROM training_progress WHERE user_id = ? AND unit_id = ?',
    user_id, unitId
  );

  const responses = queryAll<Record<string, unknown>>(
    'SELECT lesson_index, scenario_id, selected_option, score FROM training_responses WHERE user_id = ? AND unit_id = ?',
    user_id, unitId
  );

  let lessons: unknown[] = [];
  try { lessons = JSON.parse(unit.lessons_json as string); } catch { /* */ }

  res.json({
    unit: { ...unit, lessons_json: undefined, lessons },
    progress: progress ?? { status: 'available', lesson_index: 0, score: 0 },
    responses,
  });
});

// POST /training/:unitId/start — mark in_progress
router.post('/:unitId/start', (req, res) => {
  const { user_id } = getUser(req);
  const { unitId } = req.params;
  const now = new Date().toISOString();

  const existing = queryOne<Record<string, unknown>>(
    'SELECT id FROM training_progress WHERE user_id = ? AND unit_id = ?',
    user_id, unitId
  );

  if (existing) {
    run('UPDATE training_progress SET status = ?, started_at = COALESCE(started_at, ?) WHERE user_id = ? AND unit_id = ?',
      'in_progress', now, user_id, unitId);
  } else {
    run('INSERT INTO training_progress (id, user_id, unit_id, status, started_at) VALUES (?, ?, ?, ?, ?)',
      uuid(), user_id, unitId, 'in_progress', now);
  }

  res.json({ ok: true });
});

// POST /training/:unitId/respond — log scenario response
router.post('/:unitId/respond', (req, res) => {
  const { user_id } = getUser(req);
  const { unitId } = req.params;
  const { lesson_index, scenario_id, selected_option, score } = req.body;

  if (scenario_id == null || selected_option == null || score == null) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }

  const now = new Date().toISOString();
  run(
    'INSERT INTO training_responses (id, user_id, unit_id, lesson_index, scenario_id, selected_option, score, responded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    uuid(), user_id, unitId, lesson_index ?? 0, scenario_id, String(selected_option), score, now
  );

  // Update progress: advance lesson_index
  run(
    'UPDATE training_progress SET lesson_index = MAX(lesson_index, ?) WHERE user_id = ? AND unit_id = ?',
    (lesson_index ?? 0) + 1, user_id, unitId
  );

  // Get updated score
  const totalScore = queryOne<{ s: number }>(
    'SELECT SUM(score) as s FROM training_responses WHERE user_id = ? AND unit_id = ?',
    user_id, unitId
  );

  res.json({ ok: true, total_score: totalScore?.s ?? 0 });
});

// POST /training/:unitId/complete — finish unit, unlock next
router.post('/:unitId/complete', (req, res) => {
  const { user_id } = getUser(req);
  const { unitId } = req.params;
  const now = new Date().toISOString();

  // Mark completed
  run('UPDATE training_progress SET status = ?, completed_at = ? WHERE user_id = ? AND unit_id = ?',
    'completed', now, user_id, unitId);

  // Find and unlock next unit
  const currentUnit = queryOne<{ sort_order: number }>('SELECT sort_order FROM training_units WHERE unit_id = ?', unitId);
  if (currentUnit) {
    const nextUnit = queryOne<{ unit_id: string }>(
      'SELECT unit_id FROM training_units WHERE sort_order = ? AND is_advanced <= (SELECT CASE WHEN ? >= 6 THEN 1 ELSE 0 END)',
      currentUnit.sort_order + 1, currentUnit.sort_order
    );

    if (nextUnit) {
      const existingNext = queryOne<Record<string, unknown>>(
        'SELECT id FROM training_progress WHERE user_id = ? AND unit_id = ?',
        user_id, nextUnit.unit_id
      );
      if (!existingNext) {
        run('INSERT INTO training_progress (id, user_id, unit_id, status) VALUES (?, ?, ?, ?)',
          uuid(), user_id, nextUnit.unit_id, 'available');
      }
      res.json({ ok: true, next_unit_id: nextUnit.unit_id });
      return;
    }
  }

  res.json({ ok: true, next_unit_id: null });
});

export default router;
