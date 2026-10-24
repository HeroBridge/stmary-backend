import { Router } from 'express';
import { query } from '../db/pool.js';
import { authRequired, requireRole } from '../middleware/auth.js';
import { accessibleIds, canAccess } from '../services/entitlements.js';
import { logEvent } from '../services/journey.js';
import { completeMilestone } from '../services/milestones.js';

const router = Router();
router.use(authRequired);

// Helper: entitlement check that treats public resources as accessible.
async function resourceAccess(userId, resourceId) {
  if (await canAccess(userId, 'resource', resourceId)) return true;
  const pub = await query(`SELECT 1 FROM resources WHERE id=$1 AND visibility='public'`, [resourceId]);
  return pub.rowCount > 0;
}

// ============ Library listing / search ============
// All filters compose, always inside the user's entitlements:
//   ?q=            full-text search (title, description, page body)
//   ?tag=          filter by tag
//   ?type=         video|audio|document|form|course|page|...
//   ?featured=true featured shelf, in curated order
//   ?on_map=true   GIS layer
//   ?lat&lng&radius_m  nearby, nearest first
router.get('/', async (req, res) => {
  const { q, tag, type, featured, on_map, lat, lng, radius_m } = req.query;
  const allowed = await accessibleIds(req.user.sub, req.user.org_id, 'resource');
  if (allowed.length === 0) return res.json([]);

  const params = [allowed];
  let where = `WHERE r.id = ANY($1)`;
  let distanceSelect = '';
  let orderBy = featured === 'true'
    ? 'ORDER BY r.featured_rank NULLS LAST, r.created_at DESC'
    : 'ORDER BY r.created_at DESC';

  if (type) { params.push(type); where += ` AND r.resource_type = $${params.length}`; }
  if (tag) { params.push(tag); where += ` AND $${params.length} = ANY(r.tags)`; }
  if (featured === 'true') where += ` AND r.is_featured = true`;
  if (on_map === 'true') where += ` AND r.show_on_map = true AND r.location IS NOT NULL`;

  if (q) {
    params.push(q);
    where += ` AND to_tsvector('english', coalesce(r.title,'') || ' ' || coalesce(r.description,'') || ' ' || coalesce(r.body_md,''))
               @@ websearch_to_tsquery('english', $${params.length})`;
  }

  if (lat && lng) {
    params.push(lng, lat);
    const pt = `ST_SetSRID(ST_MakePoint($${params.length - 1}, $${params.length}), 4326)::geography`;
    distanceSelect = `, ST_Distance(r.location, ${pt}) AS distance_m`;
    if (radius_m) { params.push(radius_m); where += ` AND ST_DWithin(r.location, ${pt}, $${params.length})`; }
    orderBy = `ORDER BY distance_m ASC`;
  }

  const { rows } = await query(
    `SELECT r.id, r.title, r.description, r.category, r.tags, r.resource_type,
            r.thumbnail_url, r.duration_minutes, r.is_featured, r.address,
            r.show_on_map, r.is_authenticated,
            ST_X(r.location::geometry) AS lng, ST_Y(r.location::geometry) AS lat
            ${distanceSelect}
     FROM resources r ${where} ${orderBy} LIMIT 200`,
    params
  );
  res.json(rows);
});

// All tags in use (for filter chips), within entitlements
router.get('/tags', async (req, res) => {
  const allowed = await accessibleIds(req.user.sub, req.user.org_id, 'resource');
  if (allowed.length === 0) return res.json([]);
  const { rows } = await query(
    `SELECT unnest(tags) AS tag, COUNT(*)::int AS count
     FROM resources WHERE id = ANY($1) GROUP BY tag ORDER BY count DESC LIMIT 50`,
    [allowed]);
  res.json(rows);
});

// ============ Resource page ============
// The full page: body, media, my progress, community feedback stats,
// and (if part of a course) its place in the sequence.
router.get('/:id', async (req, res) => {
  if (!(await resourceAccess(req.user.sub, req.params.id)))
    return res.status(403).json({ error: 'no access' });

  const { rows } = await query(
    `SELECT r.id, r.title, r.description, r.body_md, r.category, r.tags,
            r.resource_type, r.content_url, r.thumbnail_url, r.duration_minutes,
            r.is_authenticated, r.is_featured, r.address,
            ST_X(r.location::geometry) AS lng, ST_Y(r.location::geometry) AS lat
     FROM resources r WHERE r.id=$1`, [req.params.id]);
  const resource = rows[0];
  if (!resource) return res.status(404).json({ error: 'not found' });

  const progress = (await query(
    `SELECT status, progress_pct, completed_at FROM resource_progress
     WHERE user_id=$1 AND resource_id=$2`, [req.user.sub, req.params.id])).rows[0] || null;

  const feedback = (await query(
    `SELECT COUNT(*)::int AS responses,
            COUNT(*) FILTER (WHERE useful)::int AS found_useful,
            ROUND(AVG(rating), 1) AS avg_rating
     FROM resource_feedback WHERE resource_id=$1`, [req.params.id])).rows[0];

  const sequence = (await query(
    `SELECT m.id AS milestone_id, m.name, m.position, t.id AS track_id, t.name AS track_name
     FROM milestones m JOIN learning_tracks t ON t.id = m.track_id
     WHERE m.resource_id=$1`, [req.params.id])).rows;

  const saved = (await query(
    `SELECT 1 FROM saved_resources WHERE user_id=$1 AND resource_id=$2`,
    [req.user.sub, req.params.id])).rowCount > 0;

  res.json({ ...resource, my_progress: progress, feedback_stats: feedback, in_sequences: sequence, saved });
});

// Open (deep-link target for the media/player). Logs view + starts progress.
router.get('/:id/open', async (req, res) => {
  if (!(await resourceAccess(req.user.sub, req.params.id)))
    return res.status(403).json({ error: 'no access' });
  const { rows } = await query(
    `SELECT id, title, resource_type, content_url, is_authenticated FROM resources WHERE id=$1`,
    [req.params.id]);
  const r = rows[0];
  if (!r) return res.status(404).json({ error: 'not found' });

  await query(
    `INSERT INTO resource_progress (user_id, resource_id) VALUES ($1,$2)
     ON CONFLICT (user_id, resource_id) DO NOTHING`, [req.user.sub, r.id]);
  await logEvent(req.user.sub, 'resource_viewed', {
    objectType: 'resource', objectId: r.id, metadata: { type: r.resource_type } });

  // In production: if is_authenticated, mint an S3 presigned URL / partner token here.
  res.json({ id: r.id, title: r.title, type: r.resource_type, url: r.content_url,
             open_in_app_player: r.is_authenticated });
});

// ============ Completion tracking ============
// Progress updates; hitting 'completed' cascades into any milestone that
// points at this resource -> auto-graduation grants fire automatically.
router.post('/:id/progress', async (req, res) => {
  if (!(await resourceAccess(req.user.sub, req.params.id)))
    return res.status(403).json({ error: 'no access' });
  let { progress_pct, completed } = req.body || {};
  progress_pct = Math.max(0, Math.min(100, parseInt(progress_pct) || 0));
  const isDone = completed === true || progress_pct >= 100;

  await query(
    `INSERT INTO resource_progress (user_id, resource_id, status, progress_pct, completed_at)
     VALUES ($1,$2,$3,$4, CASE WHEN $3='completed' THEN now() ELSE NULL END)
     ON CONFLICT (user_id, resource_id) DO UPDATE SET
       status = CASE WHEN resource_progress.status='completed' THEN 'completed' ELSE EXCLUDED.status END,
       progress_pct = GREATEST(resource_progress.progress_pct, EXCLUDED.progress_pct),
       completed_at = COALESCE(resource_progress.completed_at, EXCLUDED.completed_at)`,
    [req.user.sub, req.params.id, isDone ? 'completed' : 'started', isDone ? 100 : progress_pct]);

  const cascaded = [];
  if (isDone) {
    await logEvent(req.user.sub, 'resource_completed', {
      objectType: 'resource', objectId: req.params.id });
    // Course sequence cascade: complete any milestone tied to this resource
    const { rows: linked } = await query(
      `SELECT id FROM milestones WHERE resource_id=$1`, [req.params.id]);
    for (const m of linked) {
      try {
        const result = await completeMilestone(req.user.sub, m.id);
        cascaded.push(result);
      } catch (e) { console.warn('milestone cascade failed', e.message); }
    }
  }
  res.json({ status: isDone ? 'completed' : 'started', progress_pct: isDone ? 100 : progress_pct,
             milestones_completed: cascaded });
});

// ============ Usefulness feedback ============
router.post('/:id/feedback', async (req, res) => {
  if (!(await resourceAccess(req.user.sub, req.params.id)))
    return res.status(403).json({ error: 'no access' });
  const { useful, rating, comment } = req.body || {};
  if (typeof useful !== 'boolean') return res.status(400).json({ error: 'useful (true/false) required' });
  const r = rating != null ? Math.max(1, Math.min(5, parseInt(rating))) : null;
  await query(
    `INSERT INTO resource_feedback (user_id, resource_id, useful, rating, comment)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (user_id, resource_id) DO UPDATE SET
       useful=EXCLUDED.useful, rating=EXCLUDED.rating, comment=EXCLUDED.comment, created_at=now()`,
    [req.user.sub, req.params.id, useful, r, comment || null]);
  await logEvent(req.user.sub, 'resource_feedback', {
    objectType: 'resource', objectId: req.params.id, metadata: { useful, rating: r } });
  res.json({ recorded: true });
});

// ============ Save / unsave ============
router.post('/:id/save', async (req, res) => {
  await query(`INSERT INTO saved_resources (user_id, resource_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
    [req.user.sub, req.params.id]);
  await logEvent(req.user.sub, 'resource_saved', { objectType: 'resource', objectId: req.params.id });
  res.json({ saved: true });
});
router.delete('/:id/save', async (req, res) => {
  await query(`DELETE FROM saved_resources WHERE user_id=$1 AND resource_id=$2`, [req.user.sub, req.params.id]);
  res.json({ saved: false });
});

// ============ Admin: create / update ============
router.post('/', requireRole('admin', 'mentor'), async (req, res) => {
  const { title, description, body_md, category, tags, resource_type, content_url,
          thumbnail_url, duration_minutes, is_authenticated, is_featured, featured_rank,
          show_on_map, visibility, group_id, lat, lng, address } = req.body || {};
  if (!title) return res.status(400).json({ error: 'title required' });
  const hasLoc = lat != null && lng != null;
  const params = [
    req.user.org_id, title, description || null, body_md || null, category || null,
    tags || [], resource_type || 'link', content_url || null, thumbnail_url || null,
    duration_minutes || null, !!is_authenticated, !!is_featured, featured_rank || null,
    !!show_on_map, visibility || 'public', group_id || null,
  ];
  const location = hasLoc ? `ST_SetSRID(ST_MakePoint($17,$18),4326)::geography` : 'NULL';
  if (hasLoc) params.push(lng, lat);

  const { rows } = await query(
    `INSERT INTO resources
       (org_id, title, description, body_md, category, tags, resource_type, content_url,
        thumbnail_url, duration_minutes, is_authenticated, is_featured, featured_rank,
        show_on_map, visibility, group_id, location, address)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16, ${location}, $${params.length + 1})
     RETURNING id, title, resource_type, is_featured`,
    [...params, address || null]);
  res.status(201).json(rows[0]);
});

router.patch('/:id', requireRole('admin', 'mentor'), async (req, res) => {
  const allowed = ['title','description','body_md','category','tags','resource_type','content_url',
    'thumbnail_url','duration_minutes','is_authenticated','is_featured','featured_rank',
    'show_on_map','visibility'];
  const sets = []; const params = [req.params.id, req.user.org_id];
  for (const k of allowed) {
    if (k in (req.body || {})) { params.push(req.body[k]); sets.push(`${k}=$${params.length}`); }
  }
  if (sets.length === 0) return res.status(400).json({ error: 'nothing to update' });
  const { rows } = await query(
    `UPDATE resources SET ${sets.join(', ')} WHERE id=$1 AND org_id=$2 RETURNING id, title`,
    params);
  if (!rows[0]) return res.status(404).json({ error: 'not found' });
  res.json(rows[0]);
});

export default router;
