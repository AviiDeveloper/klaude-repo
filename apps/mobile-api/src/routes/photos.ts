import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import multer from 'multer';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { requireAuth, getUser } from '../auth.js';
import { queryAll, run } from '../db.js';

const UPLOAD_DIR = process.env.PHOTOS_DIR ?? join(homedir(), 'projects', '.lead-photos');
if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => cb(null, `${uuid()}-${file.originalname}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only images allowed'));
  },
});

const router = Router();
router.use(requireAuth);

// POST /photos/:assignmentId — upload a photo
router.post('/:assignmentId', upload.single('photo'), (req, res) => {
  const { user_id } = getUser(req);
  const file = req.file;
  if (!file) { res.status(400).json({ error: 'No photo uploaded' }); return; }

  const { category, lat, lng, captured_at } = req.body;
  const id = uuid();
  const now = new Date().toISOString();

  run(
    'INSERT INTO lead_photos (id, assignment_id, user_id, filename, category, lat, lng, captured_at, uploaded_at, synced) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)',
    id, req.params.assignmentId, user_id, file.filename,
    category ?? 'storefront', lat ?? null, lng ?? null,
    captured_at ?? now, now,
  );

  res.status(201).json({ photo_id: id, filename: file.filename });
});

// GET /photos/:assignmentId — list photos for a lead
router.get('/:assignmentId', (req, res) => {
  const { user_id } = getUser(req);
  const photos = queryAll<Record<string, unknown>>(
    'SELECT * FROM lead_photos WHERE assignment_id = ? AND user_id = ? ORDER BY captured_at DESC',
    req.params.assignmentId, user_id,
  );
  res.json({ photos });
});

export default router;
