import { Router } from 'express';
import { requireAuth, getUser } from '../auth.js';
import { run, queryOne } from '../db.js';

const router = Router();
router.use(requireAuth);

// POST /push/register — register Expo push token
router.post('/register', (req, res) => {
  const { user_id } = getUser(req);
  const { expo_token, platform } = req.body;

  if (!expo_token) {
    res.status(400).json({ error: 'expo_token required' });
    return;
  }

  const now = new Date().toISOString();
  run(
    `INSERT INTO push_tokens (user_id, expo_token, platform, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET expo_token = ?, platform = ?, updated_at = ?`,
    user_id, expo_token, platform ?? 'unknown', now,
    expo_token, platform ?? 'unknown', now,
  );

  res.json({ ok: true });
});

// Utility: send push to a user (called internally, not exposed as route)
export async function sendPush(userId: string, title: string, body: string, data?: Record<string, unknown>): Promise<boolean> {
  const token = queryOne<{ expo_token: string }>('SELECT expo_token FROM push_tokens WHERE user_id = ?', userId);
  if (!token) return false;

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: token.expo_token,
        title,
        body,
        data: data ?? {},
        sound: 'default',
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export default router;
