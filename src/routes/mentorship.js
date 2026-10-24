import { Router } from 'express';
import { query } from '../db/pool.js';
import { authRequired, requireRole } from '../middleware/auth.js';
import { logEvent } from '../services/journey.js';
import { sendPush } from '../services/push.js';
import { briefMentor, recordApplication, principleEffectiveness, seedPrinciples, inferStage }
  from '../services/doctrine.js';

const router = Router();
router.use(authRequired);

// Helper: is this user a mentor of that user (active match)?
async function isMentorOf(mentorId, menteeId) {
  const { rows } = await query(
    `SELECT 1 FROM mentorship_matches WHERE mentor_id=$1 AND mentee_id=$2 AND status='active'`,
    [mentorId, menteeId]);
  return rows.length > 0;
}

// ============ Mentor profile ============
router.patch('/mentor-profile', requireRole('mentor', 'admin'), async (req, res) => {
  const { specialties, capacity, availability } = req.body || {};
  await query(
    `UPDATE users SET
       mentor_specialties = COALESCE($2, mentor_specialties),
       mentor_capacity = COALESCE($3, mentor_capacity),
       mentor_availability = COALESCE($4, mentor_availability)
     WHERE id=$1`,
    [req.user.sub, specialties ?? null, capacity ?? null, availability ?? null]);
  res.json({ updated: true });
});

// Mentor directory (for admins pairing, and members browsing mentors)
router.get('/mentors', async (req, res) => {
  const { rows } = await query(
    `SELECT u.id, u.display_name, u.bio, u.avatar_url, u.mentor_specialties,
            u.mentor_availability, u.mentor_capacity,
            COUNT(m.id) FILTER (WHERE m.status='active')::int AS active_mentees
     FROM users u LEFT JOIN mentorship_matches m ON m.mentor_id = u.id
     WHERE u.org_id=$1 AND u.role IN ('mentor','admin') AND u.is_suspended=false
       AND u.show_in_directory=true
     GROUP BY u.id ORDER BY u.display_name`,
    [req.user.org_id]);
  res.json(rows);
});

// ============ Support requests ============
// audience: 'mentor' -> my active mentor(s); 'peer' -> peer champions; 'admin' -> staff
router.post('/support-requests', async (req, res) => {
  const { category, body, audience } = req.body || {};
  if (!body) return res.status(400).json({ error: 'body required' });
  const aud = ['mentor', 'peer', 'admin'].includes(audience) ? audience : 'mentor';
  const { rows } = await query(
    `INSERT INTO support_requests (org_id, user_id, category, body, audience)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [req.user.org_id, req.user.sub, category || 'general', body, aud]);
  await logEvent(req.user.sub, 'support_requested', {
    objectType: 'support_request', objectId: rows[0].id, metadata: { category, audience: aud } });

  // Notify the right responders
  if (aud === 'mentor') {
    const mentors = await query(
      `SELECT mentor_id FROM mentorship_matches WHERE mentee_id=$1 AND status='active'`, [req.user.sub]);
    if (mentors.rows.length > 0)
      sendPush(mentors.rows.map(m => m.mentor_id), 'Support request from your mentee',
        body.slice(0, 120), { support_request_id: rows[0].id });
  } else if (aud === 'peer') {
    const champs = await query(
      `SELECT id FROM users WHERE org_id=$1 AND is_peer_champion=true AND is_suspended=false`,
      [req.user.org_id]);
    if (champs.rows.length > 0)
      sendPush(champs.rows.map(c => c.id), 'A community member could use support',
        body.slice(0, 120), { support_request_id: rows[0].id });
  } else {
    const admins = await query(
      `SELECT id FROM users WHERE org_id=$1 AND role='admin'`, [req.user.org_id]);
    sendPush(admins.rows.map(a => a.id), 'Support request', body.slice(0, 120),
      { support_request_id: rows[0].id });
  }
  res.status(201).json(rows[0]);
});

// My requests (requester view)
router.get('/support-requests/mine', async (req, res) => {
  const { rows } = await query(
    `SELECT * FROM support_requests WHERE user_id=$1 ORDER BY created_at DESC`, [req.user.sub]);
  res.json(rows);
});

// Open queue for responders: mentors see their mentees' requests; peer
// champions see 'peer' requests; admins see everything.
router.get('/support-requests/open', async (req, res) => {
  const me = (await query(
    `SELECT role, is_peer_champion FROM users WHERE id=$1`, [req.user.sub])).rows[0] || {};
  let rows;
  if (me.role === 'admin') {
    rows = (await query(
      `SELECT s.*, u.display_name AS requester_name FROM support_requests s
       JOIN users u ON u.id=s.user_id
       WHERE s.org_id=$1 AND s.status IN ('open','claimed') ORDER BY s.created_at ASC`,
      [req.user.org_id])).rows;
  } else {
    const clauses = [];
    const params = [req.user.org_id];
    if (me.role === 'mentor') {
      params.push(req.user.sub);
      clauses.push(`(s.audience='mentor' AND s.user_id IN
        (SELECT mentee_id FROM mentorship_matches WHERE mentor_id=$${params.length} AND status='active'))`);
    }
    if (me.is_peer_champion) clauses.push(`s.audience='peer'`);
    if (clauses.length === 0) return res.json([]);
    rows = (await query(
      `SELECT s.*, u.display_name AS requester_name FROM support_requests s
       JOIN users u ON u.id=s.user_id
       WHERE s.org_id=$1 AND s.status IN ('open','claimed') AND (${clauses.join(' OR ')})
       ORDER BY s.created_at ASC`,
      params)).rows;
  }
  res.json(rows);
});

// Claim / resolve / withdraw
router.post('/support-requests/:id/claim', async (req, res) => {
  const { rows } = await query(
    `UPDATE support_requests SET status='claimed', claimed_by=$2
     WHERE id=$1 AND status='open' RETURNING *`,
    [req.params.id, req.user.sub]);
  if (!rows[0]) return res.status(409).json({ error: 'not open' });
  sendPush([rows[0].user_id], 'Someone is on it', 'Your support request was picked up.',
    { support_request_id: rows[0].id });
  res.json(rows[0]);
});
router.post('/support-requests/:id/resolve', async (req, res) => {
  const { rows } = await query(
    `UPDATE support_requests SET status='resolved', resolved_at=now()
     WHERE id=$1 AND (claimed_by=$2 OR user_id=$2) RETURNING *`,
    [req.params.id, req.user.sub]);
  if (!rows[0]) return res.status(403).json({ error: 'not yours to resolve' });
  await logEvent(rows[0].user_id, 'support_resolved', {
    objectType: 'support_request', objectId: rows[0].id });
  res.json(rows[0]);
});
router.post('/support-requests/:id/withdraw', async (req, res) => {
  const { rows } = await query(
    `UPDATE support_requests SET status='withdrawn' WHERE id=$1 AND user_id=$2 RETURNING id`,
    [req.params.id, req.user.sub]);
  res.json(rows[0] || { error: 'not found' });
});

// ============ Sessions & check-ins ============
router.post('/sessions', requireRole('mentor', 'admin'), async (req, res) => {
  const { match_id, session_type, occurred_at, duration_min, notes, mentee_visible_summary, mood } = req.body || {};
  const match = (await query(
    `SELECT * FROM mentorship_matches WHERE id=$1 AND (mentor_id=$2 OR $3='admin')`,
    [match_id, req.user.sub, req.user.role])).rows[0];
  if (!match) return res.status(403).json({ error: 'not your match' });

  const { rows } = await query(
    `INSERT INTO mentor_sessions
       (match_id, session_type, occurred_at, duration_min, notes, mentee_visible_summary, mood, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [match_id, session_type === 'check_in' ? 'check_in' : 'session',
     occurred_at || new Date(), duration_min || null, notes || null,
     mentee_visible_summary || null, mood || null, req.user.sub]);
  await logEvent(match.mentee_id, session_type === 'check_in' ? 'check_in_logged' : 'session_logged', {
    objectType: 'mentor_session', objectId: rows[0].id,
    metadata: { duration_min: duration_min || null } });
  res.status(201).json(rows[0]);
});

// Session history for a match. Mentee sees only mentee_visible_summary + mood.
router.get('/matches/:matchId/sessions', async (req, res) => {
  const match = (await query(
    `SELECT * FROM mentorship_matches WHERE id=$1`, [req.params.matchId])).rows[0];
  if (!match) return res.status(404).json({ error: 'not found' });
  const isMentor = match.mentor_id === req.user.sub || req.user.role === 'admin';
  const isMentee = match.mentee_id === req.user.sub;
  if (!isMentor && !isMentee) return res.status(403).json({ error: 'not your match' });

  const cols = isMentor
    ? `id, session_type, occurred_at, duration_min, notes, mentee_visible_summary, mood`
    : `id, session_type, occurred_at, duration_min, mentee_visible_summary, mood`;
  const { rows } = await query(
    `SELECT ${cols} FROM mentor_sessions WHERE match_id=$1 ORDER BY occurred_at DESC`,
    [req.params.matchId]);
  res.json(rows);
});

// ============ Support history (per person) ============
// Mentors of the person + admins; the person can view their own.
router.get('/support-history/:userId', async (req, res) => {
  const target = req.params.userId;
  const allowed = target === req.user.sub || req.user.role === 'admin'
    || await isMentorOf(req.user.sub, target);
  if (!allowed) return res.status(403).json({ error: 'not authorized' });

  const requests = (await query(
    `SELECT id, category, body, audience, status, created_at, resolved_at
     FROM support_requests WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50`, [target])).rows;
  const sessions = (await query(
    `SELECT ms.id, ms.session_type, ms.occurred_at, ms.mentee_visible_summary, ms.mood
     FROM mentor_sessions ms JOIN mentorship_matches m ON m.id = ms.match_id
     WHERE m.mentee_id=$1 ORDER BY ms.occurred_at DESC LIMIT 50`, [target])).rows;
  const steps = (await query(
    `SELECT id, title, resource_id, status, created_by, created_at
     FROM recommended_steps WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50`, [target])).rows;
  res.json({ support_requests: requests, sessions, recommended_steps: steps });
});

// ============ Recommended next steps ============
// Mentor/admin suggests; computed endpoint blends manual + system signals.
router.post('/next-steps', async (req, res) => {
  const { user_id, title, resource_id } = req.body || {};
  if (!user_id || !title) return res.status(400).json({ error: 'user_id and title required' });
  const allowed = req.user.role === 'admin' || await isMentorOf(req.user.sub, user_id);
  if (!allowed) return res.status(403).json({ error: 'only their mentor or an admin can suggest steps' });
  const { rows } = await query(
    `INSERT INTO recommended_steps (user_id, title, resource_id, created_by)
     VALUES ($1,$2,$3,$4) RETURNING *`,
    [user_id, title, resource_id || null, `${req.user.role}:${req.user.sub}`]);
  sendPush([user_id], 'A next step for you', title, { step_id: rows[0].id });
  res.status(201).json(rows[0]);
});

// My next steps: manual suggestions + what the system already knows
// (in-progress track milestones with linked resources, open goals).
router.get('/next-steps/mine', async (req, res) => {
  const manual = (await query(
    `SELECT rs.*, r.title AS resource_title FROM recommended_steps rs
     LEFT JOIN resources r ON r.id = rs.resource_id
     WHERE rs.user_id=$1 AND rs.status IN ('suggested','accepted')
     ORDER BY rs.created_at DESC`, [req.user.sub])).rows;
  const trackNext = (await query(
    `SELECT m.id AS milestone_id, m.name AS milestone, t.name AS track,
            r.id AS resource_id, r.title AS resource_title
     FROM user_milestone_progress ump
     JOIN milestones m ON m.id = ump.milestone_id
     JOIN learning_tracks t ON t.id = m.track_id
     LEFT JOIN resources r ON r.id = m.resource_id
     WHERE ump.user_id=$1 AND ump.status='in_progress'`, [req.user.sub])).rows;
  const goals = (await query(
    `SELECT id, title FROM user_goals WHERE user_id=$1 AND status='active'`, [req.user.sub])).rows;
  res.json({ suggested: manual, from_tracks: trackNext, open_goals: goals });
});

router.patch('/next-steps/:id', async (req, res) => {
  const { status } = req.body || {};
  if (!['accepted', 'done', 'dismissed'].includes(status))
    return res.status(400).json({ error: 'invalid status' });
  const { rows } = await query(
    `UPDATE recommended_steps SET status=$2 WHERE id=$1 AND user_id=$3 RETURNING *`,
    [req.params.id, status, req.user.sub]);
  if (rows[0] && status === 'done')
    await logEvent(req.user.sub, 'next_step_done', { objectType: 'step', objectId: rows[0].id });
  res.json(rows[0] || { error: 'not found' });
});

// ============ Peer champions ============
router.post('/champions/:userId', requireRole('admin'), async (req, res) => {
  const { champion } = req.body || {};
  const { rows } = await query(
    `UPDATE users SET is_peer_champion=$2 WHERE id=$1 AND org_id=$3
     RETURNING id, display_name, is_peer_champion`,
    [req.params.userId, !!champion, req.user.org_id]);
  if (!rows[0]) return res.status(404).json({ error: 'not found' });
  if (champion) sendPush([req.params.userId], 'You\'re a Peer Champion!',
    'You can now see and respond to peer support requests.', {});
  res.json(rows[0]);
});

// The people a mentor walks with.
// ORDERING IS DOCTRINE: those with least attention come first
// (preferential option for the poor), and isolation outranks silence
// (solidarity). The sort order is a moral statement.
router.get('/mentees', requireRole('mentor', 'admin'), async (req, res) => {
  const { rows } = await query(
    `SELECT u.id, u.display_name,
       (SELECT MAX(ms.occurred_at) FROM mentor_sessions ms WHERE ms.match_id = m.id) AS last_session,
       (SELECT COUNT(*)::int FROM support_requests sr
        WHERE sr.user_id = u.id AND sr.status='open') AS open_requests,
       (SELECT COUNT(DISTINCT cp2.user_id)::int
        FROM conversation_participants cp1
        JOIN conversation_participants cp2 ON cp2.conversation_id = cp1.conversation_id
        WHERE cp1.user_id = u.id AND cp2.user_id != u.id) AS partners,
       (SELECT COUNT(*)::int FROM journey_events je
        WHERE je.user_id = u.id AND je.created_at > now() - interval '30 days') AS events_30d
     FROM mentorship_matches m
     JOIN users u ON u.id = m.mentee_id
     WHERE m.status='active' AND (m.mentor_id=$1 OR $2='admin')
       AND u.org_id=$3 AND u.is_suspended=false
     ORDER BY
       (SELECT COUNT(*) FROM support_requests sr WHERE sr.user_id=u.id AND sr.status='open') DESC,
       (SELECT COUNT(DISTINCT cp2.user_id) FROM conversation_participants cp1
        JOIN conversation_participants cp2 ON cp2.conversation_id=cp1.conversation_id
        WHERE cp1.user_id=u.id AND cp2.user_id!=u.id) ASC,
       (SELECT MAX(ms.occurred_at) FROM mentor_sessions ms WHERE ms.match_id=m.id) ASC NULLS FIRST`,
    [req.user.sub, req.user.role, req.user.org_id]);

  res.json(rows.map(r => ({
    ...r,
    // "Needs attention" is defined by the doctrine, not by inactivity alone:
    // an unanswered request, or isolation, or never having spoken.
    needs_attention: r.open_requests > 0 || r.partners <= 1 || r.last_session == null,
  })));
});

// ============================================================
// FORMATION DOCTRINE — mentor-facing
// ============================================================
// SUBSIDIARITY: these endpoints serve the MENTOR. There is deliberately
// no member-facing counterpart. The system never speaks doctrine into a
// person's formation — it only helps the human who does.

// The briefing: where this person is, what was observed, and which
// principle might serve — as POSTURE, never script.
router.get('/briefing/:menteeId', requireRole('mentor', 'admin'), async (req, res) => {
  const allowed = req.user.role === 'admin' || await isMentorOf(req.user.sub, req.params.menteeId);
  if (!allowed) return res.status(403).json({ error: 'You may only receive briefings for your own mentees.' });
  const brief = await briefMentor(req.user.sub, req.params.menteeId, req.user.org_id);
  res.json(brief);
});

// The mentor records that they DID something with a principle. This is
// the only way the effectiveness data grows — a human acted, then said so.
router.post('/briefing/:menteeId/applied', requireRole('mentor', 'admin'), async (req, res) => {
  const { principle_id, note } = req.body || {};
  if (!principle_id) return res.status(400).json({ error: 'principle_id required' });
  const allowed = req.user.role === 'admin' || await isMentorOf(req.user.sub, req.params.menteeId);
  if (!allowed) return res.status(403).json({ error: 'not your mentee' });
  const result = await recordApplication(principle_id, req.user.sub, req.params.menteeId, note);
  await logEvent(req.params.menteeId, 'principle_applied', {
    objectType: 'principle', objectId: principle_id, metadata: { stage: result.stage } });
  res.status(201).json(result);
});

// The principles themselves — readable by mentors, editable by admins.
router.get('/principles', requireRole('mentor', 'admin'), async (req, res) => {
  const { rows } = await query(
    `SELECT id, name, tradition, summary, heuristic, mentor_cue, stage_affinity, construct
     FROM formation_principles
     WHERE (org_id=$1 OR org_id IS NULL) AND is_active=true
     ORDER BY tradition, name`, [req.user.org_id]);
  res.json(rows);
});

router.post('/principles', requireRole('admin'), async (req, res) => {
  const { name, tradition, summary, heuristic, mentor_cue, agent_directive,
          stage_affinity, construct } = req.body || {};
  if (!name || !summary || !heuristic || !mentor_cue || !agent_directive)
    return res.status(400).json({ error: 'name, summary, heuristic, mentor_cue, agent_directive required' });
  const { rows } = await query(
    `INSERT INTO formation_principles
      (org_id, name, tradition, summary, heuristic, mentor_cue, agent_directive, stage_affinity, construct)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id, name`,
    [req.user.org_id, name, tradition || 'org', summary, heuristic, mentor_cue,
     agent_directive, stage_affinity || ['any'], construct || null]);
  res.status(201).json(rows[0]);
});

router.post('/principles/seed', requireRole('admin'), async (req, res) => {
  const n = await seedPrinciples(req.body?.platform_default ? null : req.user.org_id);
  res.json({ seeded: n });
});

// Which teaching serves when — correlational, caveated, never auto-applied.
router.get('/principles/effectiveness', requireRole('admin'), async (req, res) => {
  res.json(await principleEffectiveness(req.user.org_id));
});

export default router;
