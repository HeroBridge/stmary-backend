import { Router } from 'express';
import { query } from '../db/pool.js';
import { authRequired } from '../middleware/auth.js';
import { logEvent } from '../services/journey.js';

const router = Router();
router.use(authRequired);

// Upcoming events, optionally for a group via ?group_id=
router.get('/', async (req, res) => {
  const { group_id, past } = req.query;
  const params = [];
  let where = past === 'true' ? 'WHERE e.starts_at < now()' : 'WHERE e.starts_at >= now()';
  if (group_id) {
    params.push(group_id);
    where += ` AND e.group_id = $${params.length}`;
  }
  const { rows } = await query(
    `SELECT e.*,
            ST_X(e.location::geometry) AS lng,
            ST_Y(e.location::geometry) AS lat,
            (SELECT COUNT(*)::int FROM event_rsvps r WHERE r.event_id = e.id AND r.status='going') AS going_count
     FROM events e ${where}
     ORDER BY e.starts_at ASC LIMIT 100`,
    params
  );
  res.json(rows);
});

// Create an event
router.post('/', async (req, res) => {
  const { group_id, title, description, starts_at, ends_at, lat, lng } = req.body || {};
  if (!title || !starts_at) return res.status(400).json({ error: 'title and starts_at required' });
  const hasLoc = lat != null && lng != null;
  const location = hasLoc ? `ST_SetSRID(ST_MakePoint($7, $8), 4326)::geography` : 'NULL';
  const params = [group_id || null, title, description || null, starts_at, ends_at || null, req.user.sub];
  if (hasLoc) params.push(lng, lat);

  const { rows } = await query(
    `INSERT INTO events (group_id, title, description, starts_at, ends_at, created_by, location)
     VALUES ($1,$2,$3,$4,$5,$6, ${location}) RETURNING id, title, starts_at`,
    params
  );
  res.status(201).json(rows[0]);
});

// RSVP to an event
router.post('/:id/rsvp', async (req, res) => {
  const { status } = req.body || {};
  const valid = ['going', 'maybe', 'declined'];
  if (!valid.includes(status)) return res.status(400).json({ error: 'invalid status' });
  await query(
    `INSERT INTO event_rsvps (event_id, user_id, status) VALUES ($1,$2,$3)
     ON CONFLICT (event_id, user_id) DO UPDATE SET status = EXCLUDED.status`,
    [req.params.id, req.user.sub, status]
  );
  await logEvent(req.user.sub, 'event_rsvp', { objectType: 'event', objectId: req.params.id, metadata: { status } });
  res.json({ status });
});

export default router;
