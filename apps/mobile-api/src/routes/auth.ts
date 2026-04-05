import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { v4 as uuid } from 'uuid';
import { loginUser, hashPin, createToken, requireAuth, getUser } from '../auth.js';
import { queryOne, run } from '../db.js';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later', code: 'RATE_LIMITED' },
});

// POST /auth/login
router.post('/login', authLimiter, (req, res) => {
  const { name, pin } = req.body;
  if (!name || !pin) {
    res.status(400).json({ error: 'Name and PIN required' });
    return;
  }

  const result = loginUser(name, pin);
  if (!result) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  // Update device type
  const rawDevice = (req.headers['x-device-type'] as string) ?? 'ios';
  const deviceType = ['web', 'ios', 'android'].includes(rawDevice) ? rawDevice : 'ios';
  try { run('UPDATE sales_users SET device_type = ? WHERE id = ?', deviceType, result.user.id); } catch { /* constraint may not exist */ }

  const { id, name: userName, email, phone, area_postcode, commission_rate, created_at } = result.user;
  res.json({
    user: { id, name: userName, email, phone, area_postcode, commission_rate, created_at },
    token: result.token,
  });
});

// POST /auth/register
router.post('/register', authLimiter, (req, res) => {
  const { name, pin, area_postcode, phone } = req.body;
  if (!name?.trim() || !pin?.trim()) {
    res.status(400).json({ error: 'Name and PIN required' });
    return;
  }
  if (pin.length < 4 || pin.length > 6) {
    res.status(400).json({ error: 'PIN must be 4-6 digits' });
    return;
  }

  const existing = queryOne('SELECT id FROM sales_users WHERE name = ?', name.trim());
  if (existing) {
    res.status(409).json({ error: 'Name already taken' });
    return;
  }

  const id = uuid();
  const now = new Date().toISOString();
  const pinHash = hashPin(pin);
  const rawDevice = (req.headers['x-device-type'] as string) ?? 'ios';
  const deviceType = ['web', 'ios', 'android'].includes(rawDevice) ? rawDevice : 'ios';

  run(
    'INSERT INTO sales_users (id, name, pin_hash, area_postcode, phone, device_type, commission_rate, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    id, name.trim(), pinHash, area_postcode?.trim() ?? '', phone?.trim() ?? '', deviceType, 0.10, now,
  );

  const token = createToken({ user_id: id, name: name.trim(), exp: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60 });
  res.status(201).json({
    user: { id, name: name.trim(), area_postcode, phone, commission_rate: 0.10, created_at: now },
    token,
  });
});

// GET /auth/me
router.get('/me', requireAuth, (req, res) => {
  const { user_id } = getUser(req);
  const user = queryOne<Record<string, unknown>>('SELECT * FROM sales_users WHERE id = ?', user_id);
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }

  const { id, name, email, phone, area_postcode, commission_rate, device_type, last_active_at, created_at } = user;
  res.json({ id, name, email, phone, area_postcode, commission_rate, device_type, last_active_at, created_at });
});

export default router;
