import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { requireAuth, getUser } from '../auth.js';
import { queryAll, queryOne, run } from '../db.js';

const router = Router();
router.use(requireAuth);

// GET /leads — compact list for mobile
router.get('/', (req, res) => {
  const { user_id } = getUser(req);
  const status = req.query.status as string | undefined;

  let sql = `SELECT la.id as assignment_id, la.lead_id, la.status, la.assigned_at,
    la.visited_at, la.pitched_at, la.notes,
    la.commission_amount, la.location_lat, la.location_lng
    FROM lead_assignments la WHERE la.user_id = ?`;
  const params: unknown[] = [user_id];

  if (status && status !== 'all') {
    sql += ' AND la.status = ?';
    params.push(status);
  }
  sql += ' ORDER BY la.assigned_at DESC';

  const rows = queryAll<Record<string, unknown>>(sql, ...params);

  // Enrich with lead data from notes JSON
  const leads = rows.map(row => {
    let data: Record<string, unknown> = {};
    try { data = JSON.parse((row.notes as string) ?? '{}'); } catch { /* */ }
    return {
      id: row.assignment_id,
      lead_id: row.lead_id,
      status: row.status,
      business_name: data.business_name ?? 'Unknown',
      business_type: data.business_type ?? '',
      postcode: data.postcode ?? '',
      phone: data.phone ?? '',
      google_rating: data.google_rating ?? 0,
      google_review_count: data.google_review_count ?? 0,
      has_demo_site: !!data.demo_site_domain,
      opening_hours: data.opening_hours ?? [],
      services: data.services ?? [],
    };
  });

  res.json({ leads, count: leads.length });
});

// GET /leads/:id — full detail
router.get('/:id', (req, res) => {
  const { user_id } = getUser(req);
  const row = queryOne<Record<string, unknown>>(
    'SELECT * FROM lead_assignments WHERE id = ? AND user_id = ?',
    req.params.id, user_id,
  );
  if (!row) { res.status(404).json({ error: 'Lead not found' }); return; }

  let data: Record<string, unknown> = {};
  try { data = JSON.parse((row.notes as string) ?? '{}'); } catch { /* */ }

  res.json({
    id: row.id,
    lead_id: row.lead_id,
    status: row.status,
    assigned_at: row.assigned_at,
    visited_at: row.visited_at,
    pitched_at: row.pitched_at,
    sold_at: row.sold_at,
    follow_up_at: row.follow_up_at ?? data.follow_up_at,
    follow_up_note: row.follow_up_note ?? data.follow_up_note,
    contact_name: row.contact_name ?? data.contact_name,
    contact_role: row.contact_role ?? data.contact_role,
    business_name: data.business_name ?? 'Unknown',
    business_type: data.business_type ?? '',
    postcode: data.postcode ?? '',
    address: data.address ?? data.postcode ?? '',
    phone: data.phone ?? '',
    google_rating: data.google_rating ?? 0,
    google_review_count: data.google_review_count ?? 0,
    has_demo_site: !!data.demo_site_domain,
    demo_site_domain: data.demo_site_domain,
    opening_hours: data.opening_hours ?? [],
    services: data.services ?? [],
    trust_badges: data.trust_badges ?? [],
    avoid_topics: data.avoid_topics ?? [],
    best_reviews: data.best_reviews ?? [],
  });
});

// PATCH /leads/:id/status — update status with GPS
router.patch('/:id/status', (req, res) => {
  const { user_id } = getUser(req);
  const { status, lat, lng } = req.body;
  const validStatuses = ['new', 'visited', 'pitched', 'sold', 'rejected'];
  if (!validStatuses.includes(status)) {
    res.status(400).json({ error: 'Invalid status' });
    return;
  }

  const now = new Date().toISOString();
  const updates: string[] = [`status = '${status}'`, `updated_at = '${now}'`];
  if (lat && lng) {
    updates.push(`location_lat = ${lat}`, `location_lng = ${lng}`);
  }
  if (status === 'visited') updates.push(`visited_at = '${now}'`);
  if (status === 'pitched') updates.push(`pitched_at = '${now}'`);
  if (status === 'sold') updates.push(`sold_at = '${now}'`, `commission_amount = 50`);

  run(`UPDATE lead_assignments SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`, req.params.id, user_id);

  // Log activity
  run(
    'INSERT INTO sales_activity_log (id, user_id, assignment_id, action, location_lat, location_lng, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    uuid(), user_id, req.params.id, `status_${status}`, lat ?? null, lng ?? null, now,
  );

  res.json({ ok: true, status });
});

// POST /leads/:id/intel — save follow-up intel
router.post('/:id/intel', (req, res) => {
  const { user_id } = getUser(req);
  const { interest_level, sentiment, objection, competitor, price_discussed, best_time, contact_name, contact_role, notes } = req.body;
  const now = new Date().toISOString();

  // Store as activity log entries
  const intelData = JSON.stringify({ interest_level, sentiment, objection, competitor, price_discussed, best_time, contact_name, contact_role, notes });
  run(
    'INSERT INTO sales_activity_log (id, user_id, assignment_id, action, notes, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    uuid(), user_id, req.params.id, 'intel_captured', intelData, now,
  );

  // Update contact info on assignment if provided
  if (contact_name || contact_role) {
    const row = queryOne<Record<string, unknown>>('SELECT notes FROM lead_assignments WHERE id = ? AND user_id = ?', req.params.id, user_id);
    if (row) {
      let data: Record<string, unknown> = {};
      try { data = JSON.parse((row.notes as string) ?? '{}'); } catch { /* */ }
      if (contact_name) data.contact_name = contact_name;
      if (contact_role) data.contact_role = contact_role;
      run('UPDATE lead_assignments SET notes = ?, updated_at = ? WHERE id = ? AND user_id = ?', JSON.stringify(data), now, req.params.id, user_id);
    }
  }

  res.json({ ok: true });
});

// GET /leads/:id/brief — quick brief data for walkthrough
router.get('/:id/brief', (req, res) => {
  const { user_id } = getUser(req);
  const row = queryOne<Record<string, unknown>>(
    'SELECT * FROM lead_assignments WHERE id = ? AND user_id = ?',
    req.params.id, user_id,
  );
  if (!row) { res.status(404).json({ error: 'Lead not found' }); return; }

  let data: Record<string, unknown> = {};
  try { data = JSON.parse((row.notes as string) ?? '{}'); } catch { /* */ }

  res.json({
    business_name: data.business_name,
    business_type: data.business_type,
    postcode: data.postcode,
    phone: data.phone,
    google_rating: data.google_rating,
    google_review_count: data.google_review_count,
    has_demo_site: !!data.demo_site_domain,
    services: data.services ?? [],
    opening_hours: data.opening_hours ?? [],
    trust_badges: data.trust_badges ?? [],
    avoid_topics: data.avoid_topics ?? [],
    best_reviews: data.best_reviews ?? [],
  });
});

// GET /stats — dashboard stats
router.get('/stats/summary', (req, res) => {
  const { user_id } = getUser(req);
  const counts = queryOne<Record<string, number>>(
    `SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) as queue,
      SUM(CASE WHEN status = 'visited' THEN 1 ELSE 0 END) as visited,
      SUM(CASE WHEN status = 'pitched' THEN 1 ELSE 0 END) as pitched,
      SUM(CASE WHEN status = 'sold' THEN 1 ELSE 0 END) as sold,
      SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected
    FROM lead_assignments WHERE user_id = ?`,
    user_id,
  );

  res.json({
    total: counts?.total ?? 0,
    queue: counts?.queue ?? 0,
    visited: counts?.visited ?? 0,
    pitched: counts?.pitched ?? 0,
    sold: counts?.sold ?? 0,
    rejected: counts?.rejected ?? 0,
    earned: (counts?.sold ?? 0) * 50,
  });
});

export default router;
