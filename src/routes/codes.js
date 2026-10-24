import { Router } from 'express';
import crypto from 'crypto';
import { query, getClient } from '../db/pool.js';
import { authRequired, requireRole, signToken } from '../middleware/auth.js';
import { grantMany } from '../services/entitlements.js';
import { logEvent } from '../services/journey.js';
import { sendPush } from '../services/push.js';

const router = Router();
router.use(authRequired);

// ============================================================
// Referral Code Engine v2
// A code is a complete arrival package: grants (groups, resources,
// tracks, events) + onboarding (mentor match, role, welcome message,
// starter goals). Redeeming one builds the member's entire curated
// environment in a single transaction.
// ============================================================

// --- Admin: create a code ---
// body: { code, label, max_uses, expires_at,
//         grants: [{object_type, object_id}],
//         onboarding: { role, mentor_id | mentor_pool, welcome_message, starter_goals } }
router.post('/', requireRole('admin'), async (req, res) => {
  const { code, label, max_uses, expires_at, grants, onboarding } = req.body || {};
  if (!code) return res.status(400).json({ error: 'code required' });
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO referral_codes (org_id, code, label, max_uses, expires_at, created_by, onboarding_json)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.user.org_id, code.toUpperCase(), label || null, max_uses || null,
       expires_at || null, req.user.sub, onboarding || {}]
    );
    for (const g of (grants || [])) {
      await client.query(
        `INSERT INTO referral_code_grants (code_id, object_type, object_id)
         VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
        [rows[0].id, g.object_type, g.object_id]);
    }
    await client.query('COMMIT');
    res.status(201).json({ ...rows[0], grants: grants || [] });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') return res.status(409).json({ error: 'code already exists' });
    throw err;
  } finally { client.release(); }
});

// --- Admin: batch of single-use codes (one per invitee) ---
// Privacy pattern: hand each person their own code; identity on the
// platform can then be pseudonymous — the code carries the context.
// body: { prefix, count (<=500), label, expires_at, grants, onboarding }
router.post('/batch', requireRole('admin'), async (req, res) => {
  const { prefix, count, label, expires_at, grants, onboarding } = req.body || {};
  const n = Math.min(parseInt(count) || 0, 500);
  if (!prefix || n < 1) return res.status(400).json({ error: 'prefix and count (1-500) required' });

  const batchId = crypto.randomUUID();
  const codes = [];
  const client = await getClient();
  try {
    await client.query('BEGIN');
    for (let i = 0; i < n; i++) {
      const suffix = crypto.randomBytes(3).toString('hex').toUpperCase(); // e.g. A1B2C3
      const codeStr = `${prefix.toUpperCase()}-${suffix}`;
      const { rows } = await client.query(
        `INSERT INTO referral_codes (org_id, code, label, max_uses, expires_at, created_by, onboarding_json, batch_id)
         VALUES ($1,$2,$3,1,$4,$5,$6,$7) RETURNING id, code`,
        [req.user.org_id, codeStr, label || null, expires_at || null, req.user.sub, onboarding || {}, batchId]
      );
      for (const g of (grants || [])) {
        await client.query(
          `INSERT INTO referral_code_grants (code_id, object_type, object_id)
           VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`, [rows[0].id, g.object_type, g.object_id]);
      }
      codes.push(rows[0].code);
    }
    await client.query('COMMIT');
    res.status(201).json({ batch_id: batchId, count: n, codes });
  } catch (err) { await client.query('ROLLBACK'); throw err; }
  finally { client.release(); }
});

// --- Admin: list codes (with grants + usage) ---
router.get('/', requireRole('admin'), async (req, res) => {
  const { rows } = await query(
    `SELECT c.*,
       (SELECT json_agg(json_build_object('object_type', g.object_type, 'object_id', g.object_id))
        FROM referral_code_grants g WHERE g.code_id = c.id) AS grants
     FROM referral_codes c WHERE c.org_id=$1 ORDER BY c.created_at DESC LIMIT 500`,
    [req.user.org_id]);
  res.json(rows);
});

// --- Admin: edit a code (label, limits, active state, onboarding) ---
router.patch('/:id', requireRole('admin'), async (req, res) => {
  const { label, max_uses, expires_at, is_active, onboarding } = req.body || {};
  const { rows } = await query(
    `UPDATE referral_codes SET
       label = COALESCE($2, label),
       max_uses = COALESCE($3, max_uses),
       expires_at = COALESCE($4, expires_at),
       is_active = COALESCE($5, is_active),
       onboarding_json = COALESCE($6, onboarding_json)
     WHERE id=$1 AND org_id=$7 RETURNING *`,
    [req.params.id, label ?? null, max_uses ?? null, expires_at ?? null,
     is_active ?? null, onboarding ?? null, req.user.org_id]);
  if (!rows[0]) return res.status(404).json({ error: 'not found' });
  res.json(rows[0]);
});

// --- Admin: tune the grant bundle ---
router.post('/:id/grants', requireRole('admin'), async (req, res) => {
  const { object_type, object_id } = req.body || {};
  await query(
    `INSERT INTO referral_code_grants (code_id, object_type, object_id)
     SELECT $1,$2,$3 WHERE EXISTS (SELECT 1 FROM referral_codes WHERE id=$1 AND org_id=$4)
     ON CONFLICT DO NOTHING`,
    [req.params.id, object_type, object_id, req.user.org_id]);
  res.status(201).json({ added: true });
});
router.delete('/:id/grants', requireRole('admin'), async (req, res) => {
  const { object_type, object_id } = req.body || {};
  await query(
    `DELETE FROM referral_code_grants WHERE code_id=$1 AND object_type=$2 AND object_id=$3
     AND EXISTS (SELECT 1 FROM referral_codes WHERE id=$1 AND org_id=$4)`,
    [req.params.id, object_type, object_id, req.user.org_id]);
  res.json({ removed: true });
});

// --- Anyone: preview a code before/while joining ---
// Deliberately reveals ONLY validity, label, and org name — never the
// grant contents, so secret groups/resources cannot be probed by code.
router.get('/preview/:code', async (req, res) => {
  const { rows } = await query(
    `SELECT c.label, c.is_active, c.expires_at, c.max_uses, c.use_count, o.name AS org_name
     FROM referral_codes c LEFT JOIN organizations o ON o.id = c.org_id
     WHERE c.code=$1`, [req.params.code.toUpperCase()]);
  const c = rows[0];
  if (!c) return res.status(404).json({ valid: false });
  const valid = c.is_active
    && (!c.expires_at || new Date(c.expires_at) > new Date())
    && (c.max_uses == null || c.use_count < c.max_uses);
  res.json({ valid, label: c.label, org_name: c.org_name });
});

// --- User: redeem — builds the entire arrival environment ---
router.post('/redeem', async (req, res) => {
  const { code } = req.body || {};
  if (!code) return res.status(400).json({ error: 'code required' });

  const { rows } = await query(
    `SELECT * FROM referral_codes WHERE code=$1 AND is_active=true`, [code.toUpperCase()]);
  const rc = rows[0];
  if (!rc) return res.status(404).json({ error: 'invalid code' });
  if (rc.expires_at && new Date(rc.expires_at) < new Date())
    return res.status(410).json({ error: 'code expired' });
  if (rc.max_uses != null && rc.use_count >= rc.max_uses)
    return res.status(409).json({ error: 'code fully redeemed' });

  const userId = req.user.sub;
  const ob = rc.onboarding_json || {};
  const applied = { granted: 0, mentor_matched: false, goals_created: 0, tracks_started: 0 };

  // 1) Attach the user to the code's org (fixes org-less joins)
  await query(`UPDATE users SET org_id = COALESCE(org_id, $2) WHERE id=$1`, [userId, rc.org_id]);

  // 2) Role from the code (e.g. mentor-onboarding codes). Never grants admin.
  if (ob.role && ['member', 'mentor'].includes(ob.role)) {
    await query(`UPDATE users SET role=$2 WHERE id=$1 AND role != 'admin'`, [userId, ob.role]);
  }

  // 3) Apply the grant bundle (groups auto-join via grantMany)
  const grantsRes = await query(
    `SELECT object_type, object_id FROM referral_code_grants WHERE code_id=$1`, [rc.id]);
  await grantMany(userId, grantsRes.rows, `code:${rc.id}`);
  applied.granted = grantsRes.rows.length;

  // 4) Kick off learning tracks: first milestone -> in_progress
  for (const g of grantsRes.rows.filter(g => g.object_type === 'track')) {
    const first = await query(
      `SELECT id FROM milestones WHERE track_id=$1 ORDER BY position ASC LIMIT 1`, [g.object_id]);
    if (first.rows[0]) {
      await query(
        `INSERT INTO user_milestone_progress (user_id, milestone_id, status)
         VALUES ($1,$2,'in_progress') ON CONFLICT DO NOTHING`, [userId, first.rows[0].id]);
      applied.tracks_started++;
    }
  }

  // 5) Mentor match: direct assignment, or least-loaded from a pool
  let mentorId = ob.mentor_id || null;
  if (!mentorId && Array.isArray(ob.mentor_pool) && ob.mentor_pool.length > 0) {
    const { rows: load } = await query(
      `SELECT u.id, COUNT(m.id)::int AS active_mentees
       FROM users u LEFT JOIN mentorship_matches m
         ON m.mentor_id = u.id AND m.status IN ('proposed','active')
       WHERE u.id = ANY($1) GROUP BY u.id ORDER BY active_mentees ASC LIMIT 1`,
      [ob.mentor_pool]);
    mentorId = load[0]?.id || null;
  }
  if (mentorId && mentorId !== userId) {
    await query(
      `INSERT INTO mentorship_matches (org_id, mentor_id, mentee_id, status, match_reason, proposed_by)
       VALUES ($1,$2,$3,'active',$4,$5)
       ON CONFLICT (mentor_id, mentee_id) DO UPDATE SET status='active'`,
      [rc.org_id, mentorId, userId, { via: 'referral_code', code_id: rc.id }, `code:${rc.id}`]);
    applied.mentor_matched = true;

    // 6) Welcome message: a real DM from the mentor, waiting on arrival
    if (ob.welcome_message) {
      const conv = await query(`INSERT INTO conversations DEFAULT VALUES RETURNING id`);
      const convId = conv.rows[0].id;
      await query(`INSERT INTO conversation_participants (conversation_id, user_id) VALUES ($1,$2),($1,$3)`,
        [convId, mentorId, userId]);
      await query(`INSERT INTO messages (conversation_id, sender_id, body) VALUES ($1,$2,$3)`,
        [convId, mentorId, ob.welcome_message]);
      sendPush([userId], 'Welcome!', ob.welcome_message.slice(0, 120), { conversation_id: convId });
    }
  }

  // 7) Starter goals
  for (const title of (ob.starter_goals || []).slice(0, 10)) {
    await query(`INSERT INTO user_goals (user_id, title) VALUES ($1,$2)`, [userId, title]);
    applied.goals_created++;
  }

  await query(`UPDATE referral_codes SET use_count = use_count + 1 WHERE id=$1`, [rc.id]);
  await logEvent(userId, 'code_redeemed', {
    metadata: { code: rc.code, batch_id: rc.batch_id, ...applied } });

  // Redemption changed org (and possibly role): the caller's JWT is stale.
  // Return a fresh token so entitlement-scoped queries work immediately.
  const { rows: fresh } = await query(
    `SELECT id, email, username, display_name, org_id, role FROM users WHERE id=$1`, [userId]);
  res.json({ redeemed: true, ...applied, user: fresh[0], token: signToken(fresh[0]) });
});

export default router;
