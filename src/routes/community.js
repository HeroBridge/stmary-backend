import { Router } from 'express';
import { query } from '../db/pool.js';
import { authRequired, requireRole } from '../middleware/auth.js';
import { logEvent } from '../services/journey.js';

const router = Router();
router.use(authRequired);

// ============ Member directory ============
// Org members who opted in. Never exposes email/username — display name,
// role, bio, badge count only. Pseudonymous members appear exactly as
// their chosen display name: the code carried their context, not identity.
router.get('/directory', async (req, res) => {
  const { q } = req.query;
  const params = [req.user.org_id];
  let search = '';
  if (q) { params.push(`%${q}%`); search = ` AND u.display_name ILIKE $${params.length}`; }
  const { rows } = await query(
    `SELECT u.id, u.display_name, u.role, u.bio, u.avatar_url,
            (SELECT COUNT(*)::int FROM user_badges b WHERE b.user_id=u.id) AS badge_count
     FROM users u
     WHERE u.org_id=$1 AND u.show_in_directory=true AND u.is_suspended=false ${search}
     ORDER BY u.display_name LIMIT 100`,
    params);
  res.json(rows);
});

// Toggle my own directory visibility
router.patch('/directory/me', async (req, res) => {
  const { visible } = req.body || {};
  await query(`UPDATE users SET show_in_directory=$2 WHERE id=$1`, [req.user.sub, !!visible]);
  res.json({ visible: !!visible });
});

// ============ Community guidelines ============
router.get('/guidelines', async (req, res) => {
  const { rows } = await query(
    `SELECT guidelines_md FROM organizations WHERE id=$1`, [req.user.org_id]);
  const me = await query(`SELECT accepted_guidelines_at FROM users WHERE id=$1`, [req.user.sub]);
  res.json({
    guidelines_md: rows[0]?.guidelines_md || null,
    accepted_at: me.rows[0]?.accepted_guidelines_at || null,
  });
});
router.post('/guidelines/accept', async (req, res) => {
  await query(`UPDATE users SET accepted_guidelines_at=now() WHERE id=$1`, [req.user.sub]);
  await logEvent(req.user.sub, 'guidelines_accepted', {});
  res.json({ accepted: true });
});
router.put('/guidelines', requireRole('admin'), async (req, res) => {
  const { guidelines_md } = req.body || {};
  await query(`UPDATE organizations SET guidelines_md=$2 WHERE id=$1`,
    [req.user.org_id, guidelines_md || null]);
  res.json({ updated: true });
});

// ============ In-app notification center ============
router.get('/notifications', async (req, res) => {
  const { rows } = await query(
    `SELECT id, title, body, data, read_at, created_at FROM notifications
     WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50`, [req.user.sub]);
  const unread = await query(
    `SELECT COUNT(*)::int AS n FROM notifications WHERE user_id=$1 AND read_at IS NULL`,
    [req.user.sub]);
  res.json({ unread: unread.rows[0].n, notifications: rows });
});
router.post('/notifications/read', async (req, res) => {
  const { ids } = req.body || {};
  if (Array.isArray(ids) && ids.length > 0) {
    await query(`UPDATE notifications SET read_at=now() WHERE user_id=$1 AND id=ANY($2)`,
      [req.user.sub, ids]);
  } else {
    await query(`UPDATE notifications SET read_at=now() WHERE user_id=$1 AND read_at IS NULL`,
      [req.user.sub]);
  }
  res.json({ read: true });
});

// ============ Moderation queue (admin) ============
router.get('/moderation/reports', requireRole('admin'), async (req, res) => {
  const { rows } = await query(
    `SELECT r.*, u.display_name AS reporter_name,
            CASE r.target_type
              WHEN 'post' THEN (SELECT LEFT(p.body, 200) FROM posts p WHERE p.id = r.target_id)
              WHEN 'comment' THEN (SELECT LEFT(c.body, 200) FROM comments c WHERE c.id = r.target_id)
              ELSE NULL END AS content_preview
     FROM reports r LEFT JOIN users u ON u.id = r.reporter_id
     WHERE r.org_id=$1 AND r.status='open' ORDER BY r.created_at ASC`,
    [req.user.org_id]);
  res.json(rows);
});
router.post('/moderation/reports/:id/resolve', requireRole('admin'), async (req, res) => {
  const { status } = req.body || {};
  if (!['resolved', 'dismissed'].includes(status)) return res.status(400).json({ error: 'invalid status' });
  await query(
    `UPDATE reports SET status=$2, resolved_by=$3 WHERE id=$1 AND org_id=$4`,
    [req.params.id, status, req.user.sub, req.user.org_id]);
  res.json({ status });
});

// Suspend / reinstate a member (admin). Suspension blocks all API access.
router.post('/moderation/members/:userId/suspend', requireRole('admin'), async (req, res) => {
  const { suspended } = req.body || {};
  const { rows } = await query(
    `UPDATE users SET is_suspended=$2 WHERE id=$1 AND org_id=$3 AND role != 'admin'
     RETURNING id, display_name, is_suspended`,
    [req.params.userId, !!suspended, req.user.org_id]);
  if (!rows[0]) return res.status(404).json({ error: 'member not found (admins cannot be suspended here)' });
  await logEvent(req.user.sub, suspended ? 'member_suspended' : 'member_reinstated', {
    objectType: 'user', objectId: req.params.userId });
  res.json(rows[0]);
});

// ============ Branding (theme) ============
// Every client fetches this at login and themes itself from it.
export const DEFAULT_BRANDING = {
  app_name: 'Hero One Eleven',
  tagline: 'A community that meets you where you are.',
  colors: {
    primary: '#12123D',   // badge navy — headers, nav, dark surfaces
    accent: '#E43024',    // brand red — actions, highlights
    light: '#F4F4F8',     // cool off-white — backgrounds
    surface: '#FFFFFF',   // cards
    success: '#2FA84F',   // confirmations (accessible green)
  },
  images: { logo_url: null, login_background_url: null, mascot_url: null },
};

router.get('/branding', async (req, res) => {
  const { rows } = await query(
    `SELECT branding, branding_version FROM organizations WHERE id=$1`, [req.user.org_id]);
  const b = rows[0]?.branding || {};
  res.json({
    version: rows[0]?.branding_version || 1,
    ...DEFAULT_BRANDING,
    ...b,
    colors: { ...DEFAULT_BRANDING.colors, ...(b.colors || {}) },
    images: { ...DEFAULT_BRANDING.images, ...(b.images || {}) },
  });
});

export default router;
