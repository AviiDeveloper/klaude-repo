import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { requireAuth, getUser } from '../auth.js';
import { queryAll, run } from '../db.js';

const router = Router();
router.use(requireAuth);

// GET /sync?since=ISO_TIMESTAMP — get changes since last sync
router.get('/', (req, res) => {
  const { user_id } = getUser(req);
  const since = (req.query.since as string) ?? '1970-01-01T00:00:00Z';

  // Get updated assignments
  const leads = queryAll<Record<string, unknown>>(
    'SELECT * FROM lead_assignments WHERE user_id = ? AND (updated_at > ? OR assigned_at > ?)',
    user_id, since, since,
  );

  // Get recent activity
  const activity = queryAll<Record<string, unknown>>(
    'SELECT * FROM sales_activity_log WHERE user_id = ? AND created_at > ? ORDER BY created_at DESC LIMIT 50',
    user_id, since,
  );

  res.json({
    leads,
    activity,
    synced_at: new Date().toISOString(),
  });
});

// POST /sync — replay offline journal entries
router.post('/', (req, res) => {
  const { user_id } = getUser(req);
  const { entries } = req.body as { entries: Array<{ entity_type: string; entity_id: string; payload: string; created_at: string }> };

  if (!Array.isArray(entries)) {
    res.status(400).json({ error: 'entries array required' });
    return;
  }

  let processed = 0;
  const now = new Date().toISOString();

  for (const entry of entries) {
    try {
      // Record in journal
      run(
        'INSERT OR IGNORE INTO sync_journal (id, user_id, entity_type, entity_id, payload, created_at, synced_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        uuid(), user_id, entry.entity_type, entry.entity_id, entry.payload, entry.created_at, now,
      );

      // Apply the change
      const data = JSON.parse(entry.payload);
      switch (entry.entity_type) {
        case 'status':
          run('UPDATE lead_assignments SET status = ?, updated_at = ? WHERE id = ? AND user_id = ?',
            data.status, now, entry.entity_id, user_id);
          break;
        case 'intel':
          run('INSERT INTO sales_activity_log (id, user_id, assignment_id, action, notes, created_at) VALUES (?, ?, ?, ?, ?, ?)',
            uuid(), user_id, entry.entity_id, 'intel_captured', entry.payload, entry.created_at);
          break;
        case 'notes':
          run('INSERT INTO sales_activity_log (id, user_id, assignment_id, action, notes, created_at) VALUES (?, ?, ?, ?, ?, ?)',
            uuid(), user_id, entry.entity_id, 'note_added', data.notes, entry.created_at);
          break;
      }
      processed++;
    } catch (err) {
      console.error('Sync entry failed:', err);
    }
  }

  res.json({ ok: true, processed, total: entries.length });
});

export default router;
