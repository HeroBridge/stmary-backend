import { Router } from 'express';
import { query } from '../db/pool.js';
import { authRequired, requireRole } from '../middleware/auth.js';
import { completeMilestone } from '../services/milestones.js';
import { logEvent } from '../services/journey.js';

const router = Router();
router.use(authRequired);

// --- My profile (community-facing view) ---
router.get('/me', async (req, res) => {
  const profile = await buildProfile(req.user.sub);
  res.json(profile);
});

// Update my bio / avatar
router.patch('/me', async (req, res) => {
  const { bio, avatar_url } = req.body || {};
  await query(`UPDATE users SET bio = COALESCE($2,bio), avatar_url = COALESCE($3,avatar_url) WHERE id=$1`,
    [req.user.sub, bio ?? null, avatar_url ?? null]);
  res.json({ updated: true });
});

// Goals
router.get('/me/goals', async (req, res) => {
  const { rows } = await query(`SELECT * FROM user_goals WHERE user_id=$1 ORDER BY created_at DESC`, [req.user.sub]);
  res.json(rows);
});
router.post('/me/goals', async (req, res) => {
  const { title } = req.body || {};
  if (!title) return res.status(400).json({ error: 'title required' });
  const { rows } = await query(
    `INSERT INTO user_goals (user_id, title) VALUES ($1,$2) RETURNING *`, [req.user.sub, title]);
  await logEvent(req.user.sub, 'goal_created', { metadata: { title } });
  res.status(201).json(rows[0]);
});
router.patch('/me/goals/:id', async (req, res) => {
  const { status } = req.body || {};
  const achieved = status === 'achieved' ? 'now()' : 'achieved_at';
  const { rows } = await query(
    `UPDATE user_goals SET status=$2, achieved_at=${achieved}
     WHERE id=$1 AND user_id=$3 RETURNING *`,
    [req.params.id, status, req.user.sub]);
  res.json(rows[0]);
});

// Complete a milestone (triggers auto-graduation). Mentors/admins can do it for others.
router.post('/milestones/:id/complete', async (req, res) => {
  const targetUser = req.body?.user_id && ['admin', 'mentor'].includes(req.user.role)
    ? req.body.user_id : req.user.sub;
  const result = await completeMilestone(targetUser, req.params.id);
  res.json(result);
});

// --- My Impact Transcript (self-facing transparency) ---
// The person served can always see their own record. This is the feature
// that makes the "not surveillance" claim real: nothing is collected about
// you that you cannot see yourself.
router.get('/me/impact', async (req, res) => {
  const { before, limit } = req.query;
  const lim = Math.min(parseInt(limit) || 50, 200);
  const params = [req.user.sub];
  let where = `WHERE user_id = $1`;
  if (before) { params.push(before); where += ` AND created_at < $${params.length}`; }
  params.push(lim);
  const { rows } = await query(
    `SELECT event_type, object_type, metadata, created_at
     FROM journey_events ${where} ORDER BY created_at DESC LIMIT $${params.length}`,
    params
  );
  const summary = await query(
    `SELECT event_type, COUNT(*)::int AS count FROM journey_events
     WHERE user_id=$1 GROUP BY event_type ORDER BY count DESC`,
    [req.user.sub]
  );
  res.json({ summary: summary.rows, events: rows });
});

// --- Register a push notification token ---
router.post('/me/push-token', async (req, res) => {
  const { token, platform } = req.body || {};
  if (!token) return res.status(400).json({ error: 'token required' });
  await query(
    `INSERT INTO push_tokens (user_id, token, platform) VALUES ($1,$2,$3)
     ON CONFLICT (user_id, token) DO UPDATE SET updated_at = now()`,
    [req.user.sub, token, platform || null]
  );
  res.json({ registered: true });
});

// --- Delete my account (Apple App Store requirement) ---
// Hard-deletes the user row; ON DELETE CASCADE removes memberships,
// entitlements, consents, journey events, push tokens, likes, RSVPs,
// saved resources, and milestone progress. Authored posts/comments/messages
// have SET NULL authorship, so conversations remain coherent for others.
router.delete('/me', async (req, res) => {
  const { confirm } = req.body || {};
  if (confirm !== 'DELETE') {
    return res.status(400).json({ error: 'Pass {"confirm":"DELETE"} to permanently delete your account' });
  }
  await query(`DELETE FROM users WHERE id=$1`, [req.user.sub]);
  res.json({ deleted: true });
});

// --- Admin: full transcript / resume for a user ---
router.get('/:userId/transcript', requireRole('admin', 'mentor'), async (req, res) => {
  const profile = await buildProfile(req.params.userId);
  const events = await query(
    `SELECT event_type, object_type, object_id, metadata, created_at
     FROM journey_events WHERE user_id=$1 ORDER BY created_at ASC`,
    [req.params.userId]
  );
  // Lightweight performance metrics rolled up from the journey log
  const metrics = await query(
    `SELECT event_type, COUNT(*)::int AS count
     FROM journey_events WHERE user_id=$1 GROUP BY event_type ORDER BY count DESC`,
    [req.params.userId]
  );
  res.json({ ...profile, metrics: metrics.rows, transcript: events.rows });
});

// Shared profile builder
async function buildProfile(userId) {
  const user = (await query(
    `SELECT id, display_name, bio, avatar_url, role, created_at FROM users WHERE id=$1`, [userId]
  )).rows[0];
  if (!user) return null;

  const badges = (await query(
    `SELECT b.id, b.name, b.description, b.icon_url, ub.earned_at
     FROM user_badges ub JOIN badges b ON b.id = ub.badge_id
     WHERE ub.user_id=$1 ORDER BY ub.earned_at DESC`, [userId])).rows;

  const goals = (await query(`SELECT * FROM user_goals WHERE user_id=$1`, [userId])).rows;

  const saved = (await query(
    `SELECT r.id, r.title, r.resource_type FROM saved_resources s
     JOIN resources r ON r.id = s.resource_id WHERE s.user_id=$1`, [userId])).rows;

  const posts = (await query(
    `SELECT id, group_id, body, created_at FROM posts WHERE author_id=$1
     ORDER BY created_at DESC LIMIT 50`, [userId])).rows;

  const tracks = (await query(
    `SELECT t.id AS track_id, t.name AS track_name,
            COUNT(m.id)::int AS total_milestones,
            COUNT(ump.milestone_id) FILTER (WHERE ump.status='completed')::int AS completed
     FROM learning_tracks t
     LEFT JOIN milestones m ON m.track_id = t.id
     LEFT JOIN user_milestone_progress ump ON ump.milestone_id = m.id AND ump.user_id=$1
     GROUP BY t.id, t.name`, [userId])).rows;

  return { user, badges, goals, saved_resources: saved, posting_history: posts, track_progress: tracks };
}

export default router;
