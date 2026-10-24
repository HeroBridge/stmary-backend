import { Router } from 'express';
import { query } from '../db/pool.js';
import { authRequired, requireRole } from '../middleware/auth.js';
import { logEvent } from '../services/journey.js';
import { composeCommunication } from '../services/agents.js';
import { verifyReport, sweepGaps } from '../services/verification.js';

const router = Router();
router.use(authRequired);

// ============ Story collection ============
// Anyone can submit; stories ABOUT someone require that person's (or
// guardian's) consent before external use — enforced at verification.
router.post('/stories', async (req, res) => {
  const { title, body_md, media_url, story_kind, subject_user_id } = req.body || {};
  if (!title || !body_md) return res.status(400).json({ error: 'title and body_md required' });
  const { rows } = await query(
    `INSERT INTO stories (org_id, author_id, subject_user_id, title, body_md, media_url, story_kind)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [req.user.org_id, req.user.sub, subject_user_id || null, title, body_md,
     media_url || null, story_kind || 'success']);
  await logEvent(req.user.sub, 'story_submitted', { objectType: 'story', objectId: rows[0].id });
  res.status(201).json(rows[0]);
});

// Subject (or their guardian) grants/revokes external-use consent
router.post('/stories/:id/consent', async (req, res) => {
  const { consent } = req.body || {};
  const story = (await query(`SELECT subject_user_id FROM stories WHERE id=$1`, [req.params.id])).rows[0];
  if (!story) return res.status(404).json({ error: 'not found' });
  let allowed = story.subject_user_id === req.user.sub;
  if (!allowed && story.subject_user_id) {
    const g = await query(`SELECT 1 FROM guardianships WHERE guardian_id=$1 AND minor_id=$2`,
      [req.user.sub, story.subject_user_id]);
    allowed = g.rowCount > 0;
  }
  if (!allowed) return res.status(403).json({ error: 'only the story subject or their guardian can consent' });
  await query(
    `UPDATE stories SET consent_external=$2, consent_by=$3, consent_at=now() WHERE id=$1`,
    [req.params.id, !!consent, req.user.sub]);
  res.json({ consent_external: !!consent });
});

router.post('/stories/:id/approve', requireRole('admin'), async (req, res) => {
  const { rows } = await query(
    `UPDATE stories SET status='approved' WHERE id=$1 AND org_id=$2 RETURNING id, status`,
    [req.params.id, req.user.org_id]);
  res.json(rows[0] || { error: 'not found' });
});

router.get('/stories', requireRole('admin', 'mentor'), async (req, res) => {
  const { rows } = await query(
    `SELECT s.*, u.display_name AS author_name FROM stories s
     LEFT JOIN users u ON u.id = s.author_id
     WHERE s.org_id=$1 ORDER BY s.created_at DESC LIMIT 200`, [req.user.org_id]);
  res.json(rows);
});

// ============ Ontology ============
router.get('/ontology', async (req, res) => {
  const { rows } = await query(
    `SELECT * FROM ontology_terms WHERE org_id=$1 OR org_id IS NULL ORDER BY name`,
    [req.user.org_id]);
  res.json(rows);
});
router.post('/ontology', requireRole('admin'), async (req, res) => {
  const { name, parent_id, description } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name required' });
  const { rows } = await query(
    `INSERT INTO ontology_terms (org_id, name, parent_id, description)
     VALUES ($1,$2,$3,$4) RETURNING *`,
    [req.user.org_id, name, parent_id || null, description || null]);
  res.status(201).json(rows[0]);
});
router.post('/ontology/tag', requireRole('admin', 'mentor'), async (req, res) => {
  const { term_id, object_type, object_id } = req.body || {};
  await query(
    `INSERT INTO ontology_tags (term_id, object_type, object_id, tagged_by)
     VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
    [term_id, object_type, String(object_id), `${req.user.role}:${req.user.sub}`]);
  res.status(201).json({ tagged: true });
});

// ============ Polling engine ============
router.post('/polls', requireRole('admin', 'mentor'), async (req, res) => {
  const { title, purpose, audience, group_id, questions } = req.body || {};
  if (!title || !Array.isArray(questions) || questions.length === 0)
    return res.status(400).json({ error: 'title and questions required' });
  const { rows } = await query(
    `INSERT INTO polls (org_id, title, purpose, audience, group_id, created_by)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [req.user.org_id, title, purpose || 'pulse', audience || 'members',
     group_id || null, req.user.sub]);
  const poll = rows[0];
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    await query(
      `INSERT INTO poll_questions (poll_id, position, prompt, qtype, choices, construct)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [poll.id, i, q.prompt, q.qtype || 'scale', q.choices || null, q.construct || null]);
  }
  res.status(201).json(poll);
});

router.get('/polls/open', async (req, res) => {
  const { rows } = await query(
    `SELECT p.id, p.title, p.purpose,
       (SELECT json_agg(json_build_object('id', q.id, 'prompt', q.prompt, 'qtype', q.qtype,
          'choices', q.choices) ORDER BY q.position)
        FROM poll_questions q WHERE q.poll_id = p.id) AS questions
     FROM polls p
     WHERE p.org_id=$1 AND p.is_open=true
       AND NOT EXISTS (SELECT 1 FROM poll_responses pr
         JOIN poll_questions pq ON pq.id=pr.question_id
         WHERE pq.poll_id=p.id AND pr.user_id=$2)
     ORDER BY p.created_at DESC`,
    [req.user.org_id, req.user.sub]);
  res.json(rows);
});

router.post('/polls/:id/respond', async (req, res) => {
  const { answers } = req.body || {}; // [{question_id, scale_value|choice_value|text_value}]
  if (!Array.isArray(answers)) return res.status(400).json({ error: 'answers required' });
  for (const a of answers) {
    await query(
      `INSERT INTO poll_responses (question_id, user_id, scale_value, choice_value, text_value)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (question_id, user_id) DO UPDATE SET
         scale_value=EXCLUDED.scale_value, choice_value=EXCLUDED.choice_value,
         text_value=EXCLUDED.text_value, created_at=now()`,
      [a.question_id, req.user.sub, a.scale_value ?? null, a.choice_value ?? null, a.text_value ?? null]);
  }
  await logEvent(req.user.sub, 'poll_responded', { objectType: 'poll', objectId: req.params.id });
  res.json({ recorded: answers.length });
});

router.get('/polls/:id/results', requireRole('admin', 'mentor'), async (req, res) => {
  const { rows } = await query(
    `SELECT q.id, q.prompt, q.qtype, q.construct,
            ROUND(AVG(r.scale_value),2)::float AS avg_scale,
            COUNT(r.id)::int AS responses,
            json_agg(DISTINCT r.choice_value) FILTER (WHERE r.choice_value IS NOT NULL) AS choices_given
     FROM poll_questions q LEFT JOIN poll_responses r ON r.question_id = q.id
     WHERE q.poll_id=$1 GROUP BY q.id ORDER BY q.position`,
    [req.params.id]);
  res.json(rows);
});

// ============ Stakeholders & preferences ============
router.post('/stakeholders', requireRole('admin'), async (req, res) => {
  const { name, email, kind, user_id } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name required' });
  const { rows } = await query(
    `INSERT INTO stakeholders (org_id, name, email, kind, user_id)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [req.user.org_id, name, email || null, kind || 'donor', user_id || null]);
  res.status(201).json(rows[0]);
});
router.get('/stakeholders', requireRole('admin'), async (req, res) => {
  const { rows } = await query(
    `SELECT s.*, cp.channels, cp.frequency, cp.depth, cp.topic_terms, cp.polled_at
     FROM stakeholders s LEFT JOIN comm_preferences cp ON cp.stakeholder_id = s.id
     WHERE s.org_id=$1 ORDER BY s.name`, [req.user.org_id]);
  res.json(rows);
});
// Record polled preferences (admin entering poll results, or linked user self-serve)
router.put('/stakeholders/:id/preferences', async (req, res) => {
  const st = (await query(`SELECT user_id, org_id FROM stakeholders WHERE id=$1`, [req.params.id])).rows[0];
  if (!st) return res.status(404).json({ error: 'not found' });
  const allowed = req.user.role === 'admin' || st.user_id === req.user.sub;
  if (!allowed) return res.status(403).json({ error: 'not authorized' });
  const { channels, frequency, depth, topic_terms } = req.body || {};
  await query(
    `INSERT INTO comm_preferences (stakeholder_id, channels, frequency, depth, topic_terms, polled_at)
     VALUES ($1,$2,$3,$4,$5,now())
     ON CONFLICT (stakeholder_id) DO UPDATE SET
       channels=EXCLUDED.channels, frequency=EXCLUDED.frequency,
       depth=EXCLUDED.depth, topic_terms=EXCLUDED.topic_terms, polled_at=now()`,
    [req.params.id, channels || ['email'], frequency || 'quarterly',
     depth || 'balanced', topic_terms || []]);
  res.json({ updated: true });
});

// ============ Campaigns ============
router.post('/campaigns', requireRole('admin'), async (req, res) => {
  const { name, goal, starts_at, ends_at } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name required' });
  const { rows } = await query(
    `INSERT INTO campaigns (org_id, name, goal, starts_at, ends_at)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [req.user.org_id, name, goal || null, starts_at || null, ends_at || null]);
  res.status(201).json(rows[0]);
});
router.get('/campaigns', requireRole('admin'), async (req, res) => {
  const { rows } = await query(
    `SELECT c.*,
       (SELECT COUNT(*)::int FROM stakeholder_reports r WHERE r.campaign_id=c.id) AS communications
     FROM campaigns c WHERE c.org_id=$1 ORDER BY c.created_at DESC`, [req.user.org_id]);
  res.json(rows);
});

// ============ Communications: compose, verify, approve ============
// comm_type: impact_update | newsletter | donor_report | program_update |
//            recognition | success_story | custom
router.post('/communications/compose', requireRole('admin'), async (req, res) => {
  const result = await composeCommunication(req.user.org_id, req.body || {});
  res.json(result);
});

// Re-verify on demand (data may have moved since composition)
router.post('/communications/:id/verify', requireRole('admin'), async (req, res) => {
  const result = await verifyReport(req.user.org_id, req.params.id);
  res.json(result);
});

// Approval GATE: refuses unless every claim verifies right now.
router.post('/communications/:id/approve', requireRole('admin'), async (req, res) => {
  const verification = await verifyReport(req.user.org_id, req.params.id);
  if (!verification.all_verified) {
    return res.status(409).json({
      error: 'Cannot approve: unverified claims remain. Resolve the data gaps or remove the claims.',
      verification,
    });
  }
  const { rows } = await query(
    `UPDATE stakeholder_reports SET status='approved', reviewed_by=$2
     WHERE id=$1 AND org_id=$3 AND status='draft' RETURNING id, status`,
    [req.params.id, req.user.sub, req.user.org_id]);
  await logEvent(req.user.sub, 'communication_approved', {
    objectType: 'communication', objectId: req.params.id });
  res.json(rows[0] || { error: 'not found or not a draft' });
});

// Engagement recording (resonance raw material)
router.post('/communications/:id/engagement', requireRole('admin'), async (req, res) => {
  const { stakeholder_id, action } = req.body || {};
  await query(
    `INSERT INTO communication_engagement (report_id, stakeholder_id, action)
     VALUES ($1,$2,$3)`, [req.params.id, stakeholder_id, action]);
  res.status(201).json({ recorded: true });
});

// ============ Gap engine ============
router.get('/gaps', requireRole('admin'), async (req, res) => {
  const { rows } = await query(
    `SELECT * FROM data_gaps WHERE org_id=$1 AND status IN ('open','collecting')
     ORDER BY created_at DESC`, [req.user.org_id]);
  res.json(rows);
});
router.patch('/gaps/:id', requireRole('admin'), async (req, res) => {
  const { status } = req.body || {};
  if (!['collecting', 'resolved', 'dismissed'].includes(status))
    return res.status(400).json({ error: 'invalid status' });
  await query(`UPDATE data_gaps SET status=$2 WHERE id=$1 AND org_id=$3`,
    [req.params.id, status, req.user.org_id]);
  res.json({ status });
});
router.post('/gaps/sweep', requireRole('admin'), async (req, res) => {
  res.json(await sweepGaps(req.user.org_id));
});

export default router;
