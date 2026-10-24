import { Router } from 'express';
import { query } from '../db/pool.js';
import { authRequired, requireRole } from '../middleware/auth.js';
import { sendPush } from '../services/push.js';
import { sendEmail } from '../services/email.js';
import { logEvent } from '../services/journey.js';

const router = Router();
router.use(authRequired, requireRole('admin'));

// ============ Dashboard summary (the admin home screen data) ============
router.get('/dashboard', async (req, res) => {
  const org = req.user.org_id;
  const [members, active7, openReports, pendingProposals, openSupport, draftReports, codes] =
    await Promise.all([
      query(`SELECT COUNT(*)::int AS n FROM users WHERE org_id=$1 AND is_suspended=false`, [org]),
      query(`SELECT COUNT(DISTINCT je.user_id)::int AS n FROM journey_events je
             JOIN users u ON u.id=je.user_id
             WHERE u.org_id=$1 AND je.created_at > now() - interval '7 days'`, [org]),
      query(`SELECT COUNT(*)::int AS n FROM reports WHERE org_id=$1 AND status='open'`, [org]),
      query(`SELECT COUNT(*)::int AS n FROM change_proposals WHERE org_id=$1 AND status='pending'`, [org]),
      query(`SELECT COUNT(*)::int AS n FROM support_requests WHERE org_id=$1 AND status='open'`, [org]),
      query(`SELECT COUNT(*)::int AS n FROM stakeholder_reports WHERE org_id=$1 AND status='draft'`, [org]),
      query(`SELECT COUNT(*)::int AS n FROM referral_codes WHERE org_id=$1 AND is_active=true`, [org]),
    ]);
  res.json({
    members: members.rows[0].n,
    active_last_7d: active7.rows[0].n,
    open_reports: openReports.rows[0].n,
    pending_proposals: pendingProposals.rows[0].n,
    open_support_requests: openSupport.rows[0].n,
    draft_stakeholder_reports: draftReports.rows[0].n,
    active_codes: codes.rows[0].n,
  });
});

// ============ Member management ============
// List with activity summary; filter ?q= name, ?role=, ?inactive_days=
router.get('/members', async (req, res) => {
  const { q, role, inactive_days } = req.query;
  const params = [req.user.org_id];
  let where = `WHERE u.org_id=$1`;
  if (q) { params.push(`%${q}%`); where += ` AND u.display_name ILIKE $${params.length}`; }
  if (role) { params.push(role); where += ` AND u.role=$${params.length}`; }
  if (inactive_days) {
    params.push(parseInt(inactive_days));
    where += ` AND NOT EXISTS (SELECT 1 FROM journey_events je WHERE je.user_id=u.id
               AND je.created_at > now() - ($${params.length} || ' days')::interval)`;
  }
  const { rows } = await query(
    `SELECT u.id, u.display_name, u.role, u.is_suspended, u.is_peer_champion,
            u.is_minor, u.created_at,
            (SELECT MAX(created_at) FROM journey_events je WHERE je.user_id=u.id) AS last_active,
            (SELECT COUNT(*)::int FROM journey_events je WHERE je.user_id=u.id
             AND je.created_at > now() - interval '30 days') AS events_30d
     FROM users u ${where} ORDER BY u.display_name LIMIT 500`,
    params);
  res.json(rows);
});

// Change a member's role (member | mentor | admin)
router.patch('/members/:userId/role', async (req, res) => {
  const { role } = req.body || {};
  if (!['member', 'mentor', 'admin'].includes(role))
    return res.status(400).json({ error: 'invalid role' });
  const { rows } = await query(
    `UPDATE users SET role=$2 WHERE id=$1 AND org_id=$3 AND id != $4
     RETURNING id, display_name, role`,
    [req.params.userId, role, req.user.org_id, req.user.sub]); // can't change own role
  if (!rows[0]) return res.status(404).json({ error: 'not found (or is you)' });
  await logEvent(req.user.sub, 'role_changed', {
    objectType: 'user', objectId: req.params.userId, metadata: { role } });
  res.json(rows[0]);
});

// ============ Broadcast messaging ============
// Push + in-app to everyone (or a group); optional email; optional pinned
// announcement post. One call, whole community reached, fully logged.
router.post('/broadcast', async (req, res) => {
  const { title, body, group_id, also_email, also_announce } = req.body || {};
  if (!title || !body) return res.status(400).json({ error: 'title and body required' });

  let recipients;
  if (group_id) {
    recipients = (await query(
      `SELECT gm.user_id AS id, u.email FROM group_members gm
       JOIN users u ON u.id = gm.user_id
       WHERE gm.group_id=$1 AND u.is_suspended=false`, [group_id])).rows;
  } else {
    recipients = (await query(
      `SELECT id, email FROM users WHERE org_id=$1 AND is_suspended=false`,
      [req.user.org_id])).rows;
  }

  await sendPush(recipients.map(r => r.id), title, body, { broadcast: true });

  let emailResult = null;
  if (also_email) {
    emailResult = await sendEmail(recipients.map(r => r.email).filter(Boolean), title, body);
  }
  if (also_announce) {
    await query(
      `INSERT INTO posts (group_id, author_id, body) VALUES ($1,$2,$3)`,
      [group_id || null, req.user.sub, `${title}\n\n${body}`]);
  }
  await logEvent(req.user.sub, 'broadcast_sent', {
    metadata: { title, recipients: recipients.length, group_id: group_id || null,
                emailed: emailResult?.sent || 0 } });
  res.json({ notified: recipients.length, emailed: emailResult?.sent || 0,
             announced: !!also_announce });
});

// ============ Engagement reporting ============
router.get('/reports/engagement', async (req, res) => {
  const org = req.user.org_id;
  const days = Math.min(parseInt(req.query.days) || 30, 365);

  const [byType, weekly, topGroups, completions, feedback] = await Promise.all([
    query(`SELECT je.event_type, COUNT(*)::int AS n
           FROM journey_events je JOIN users u ON u.id=je.user_id
           WHERE u.org_id=$1 AND je.created_at > now() - ($2 || ' days')::interval
           GROUP BY je.event_type ORDER BY n DESC`, [org, days]),
    query(`SELECT date_trunc('week', je.created_at) AS week,
                  COUNT(DISTINCT je.user_id)::int AS active_members,
                  COUNT(*)::int AS events
           FROM journey_events je JOIN users u ON u.id=je.user_id
           WHERE u.org_id=$1 AND je.created_at > now() - ($2 || ' days')::interval
           GROUP BY 1 ORDER BY 1`, [org, days]),
    query(`SELECT g.name, COUNT(p.id)::int AS posts
           FROM posts p JOIN groups g ON g.id = p.group_id
           WHERE g.org_id=$1 AND p.created_at > now() - ($2 || ' days')::interval
           GROUP BY g.name ORDER BY posts DESC LIMIT 10`, [org, days]),
    query(`SELECT r.title,
                  COUNT(*) FILTER (WHERE rp.status='completed')::int AS completed,
                  COUNT(*)::int AS started
           FROM resource_progress rp JOIN resources r ON r.id = rp.resource_id
           WHERE r.org_id=$1 GROUP BY r.title ORDER BY completed DESC LIMIT 10`, [org]),
    query(`SELECT r.title, ROUND(AVG(rf.rating),1) AS avg_rating,
                  COUNT(*) FILTER (WHERE rf.useful)::int AS found_useful,
                  COUNT(*)::int AS responses
           FROM resource_feedback rf JOIN resources r ON r.id = rf.resource_id
           WHERE r.org_id=$1 GROUP BY r.title HAVING COUNT(*) >= 3
           ORDER BY avg_rating ASC LIMIT 10`, [org]),
  ]);

  res.json({
    window_days: days,
    activity_by_type: byType.rows,
    weekly_active: weekly.rows,
    most_active_groups: topGroups.rows,
    resource_completion: completions.rows,
    lowest_rated_resources: feedback.rows, // surfaced ascending: what needs attention
  });
});

// ============ Design control panel (branding) ============
const HEX = /^#[0-9a-fA-F]{6}$/;
router.put('/branding', async (req, res) => {
  const { app_name, tagline, colors, images } = req.body || {};
  // Validate: colors must be 6-digit hex; image slots must be https URLs.
  for (const [k, v] of Object.entries(colors || {})) {
    if (!HEX.test(v)) return res.status(400).json({ error: `color '${k}' must be #RRGGBB hex` });
  }
  for (const [k, v] of Object.entries(images || {})) {
    if (v != null && !/^https:\/\//.test(v))
      return res.status(400).json({ error: `image '${k}' must be an https URL` });
  }
  const patch = {};
  if (app_name) patch.app_name = String(app_name).slice(0, 60);
  if (tagline) patch.tagline = String(tagline).slice(0, 140);
  if (colors) patch.colors = colors;
  if (images) patch.images = images;

  const { rows } = await query(
    `UPDATE organizations SET
       branding = branding || $2::jsonb,
       branding_version = branding_version + 1
     WHERE id=$1 RETURNING branding, branding_version`,
    [req.user.org_id, JSON.stringify(patch)]);
  await logEvent(req.user.sub, 'branding_updated', {
    metadata: { version: rows[0].branding_version, keys: Object.keys(patch) } });
  res.json({ version: rows[0].branding_version, branding: rows[0].branding });
});

export default router;
