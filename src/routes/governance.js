import { Router } from 'express';
import { query } from '../db/pool.js';
import { subsidiarityCheck } from '../services/doctrine.js';
import { authRequired, requireRole } from '../middleware/auth.js';
import { runTilly, runCora, runEddi, runRita, runMeerkat } from '../services/agents.js';
import { logEvent } from '../services/journey.js';

const router = Router();
router.use(authRequired);

// ============ Agent triggers (admin/mentor only) ============
router.post('/agents/:agent/run', requireRole('admin', 'mentor'), async (req, res) => {
  const { agent } = req.params;
  const { subject_user_id, audience } = req.body || {};
  const orgId = req.user.org_id;
  let result;
  switch (agent) {
    case 'tilly':   result = await runTilly(orgId, subject_user_id); break;
    case 'cora':    result = await runCora(orgId); break;
    case 'eddi':    result = await runEddi(orgId, subject_user_id); break;
    case 'rita':    result = await runRita(orgId); break;
    case 'meerkat': result = await runMeerkat(orgId, audience || 'donor'); break;
    default: return res.status(400).json({ error: 'unknown agent' });
  }
  res.json(result);
});

// Latest insights for a user (mentor briefing — "know Jayden before you meet him")
router.get('/insights/:userId', requireRole('admin', 'mentor'), async (req, res) => {
  const { rows } = await query(
    `SELECT DISTINCT ON (insight_type) insight_type, agent, content, confidence, created_at
     FROM agent_insights WHERE subject_user=$1
     ORDER BY insight_type, created_at DESC`,
    [req.params.userId]
  );
  res.json(rows);
});

// RITA's open task queue
router.get('/tasks', requireRole('admin', 'mentor'), async (req, res) => {
  const { rows } = await query(
    `SELECT t.*, u.display_name AS subject_name FROM agent_tasks t
     LEFT JOIN users u ON u.id = t.subject_user
     WHERE t.org_id=$1 AND t.status='open' ORDER BY t.due_at NULLS LAST`,
    [req.user.org_id]
  );
  res.json(rows);
});
router.patch('/tasks/:id', requireRole('admin', 'mentor'), async (req, res) => {
  const { status } = req.body || {};
  if (!['done', 'dismissed'].includes(status)) return res.status(400).json({ error: 'invalid status' });
  await query(`UPDATE agent_tasks SET status=$2 WHERE id=$1 AND org_id=$3`,
    [req.params.id, status, req.user.org_id]);
  res.json({ updated: true });
});

// ============ Change proposals (the approval gate) ============
router.get('/proposals', requireRole('admin'), async (req, res) => {
  const { rows } = await query(
    `SELECT * FROM change_proposals WHERE org_id=$1 AND status='pending' ORDER BY created_at DESC`,
    [req.user.org_id]
  );
  res.json(rows);
});

// Approve or reject. Approved WHITELISTED changes are applied here — this is
// the ONLY code path that turns an agent recommendation into a real change.
router.post('/proposals/:id/decide', requireRole('admin'), async (req, res) => {
  const { decision } = req.body || {};
  if (!['approved', 'rejected'].includes(decision)) return res.status(400).json({ error: 'decision must be approved|rejected' });

  // ---- SUBSIDIARITY GUARD (formation doctrine) ----
  // Fires BEFORE approval. A change that would automate human relationship
  // cannot be approved — not by an agent, not by an admin. The moral layer
  // is a structural veto, not advice. It never blocks a REJECTION.
  if (decision === 'approved') {
    const pending = (await query(
      `SELECT change_type, rationale, change_spec FROM change_proposals
       WHERE id=$1 AND org_id=$2 AND status='pending'`,
      [req.params.id, req.user.org_id])).rows[0];
    if (pending) {
      const moral = subsidiarityCheck(
        `${pending.change_type} ${pending.rationale} ${JSON.stringify(pending.change_spec || {})}`);
      if (!moral.permitted) {
        await query(
          `UPDATE change_proposals SET status='rejected', decided_by=$2, decided_at=now()
           WHERE id=$1`, [req.params.id, req.user.sub]);
        await logEvent(req.user.sub, 'proposal_vetoed_by_doctrine', {
          metadata: { proposal_id: req.params.id, violations: moral.violations } });
        return res.status(409).json({
          error: 'Refused by the formation doctrine layer.',
          principle: moral.principle,
          violations: moral.violations,
          note: 'The platform assists the mentor; it does not replace them. Rework this so a human remains the one who accompanies.',
        });
      }
    }
  }

  const { rows } = await query(
    `UPDATE change_proposals SET status=$2, decided_by=$3, decided_at=now()
     WHERE id=$1 AND org_id=$4 AND status='pending' RETURNING *`,
    [req.params.id, decision, req.user.sub, req.user.org_id]
  );
  const proposal = rows[0];
  if (!proposal) return res.status(404).json({ error: 'not found or already decided' });
  if (decision === 'rejected') return res.json({ status: 'rejected' });

  // Apply the approved change — whitelist enforced by change_type.
  try {
    await applyChange(proposal);
    await query(`UPDATE change_proposals SET status='applied', applied_at=now() WHERE id=$1`, [proposal.id]);
    await logEvent(req.user.sub, 'framework_change_applied', {
      metadata: { proposal_id: proposal.id, change_type: proposal.change_type },
    });
    res.json({ status: 'applied' });
  } catch (err) {
    await query(`UPDATE change_proposals SET status='failed' WHERE id=$1`, [proposal.id]);
    res.status(500).json({ status: 'failed', error: err.message });
  }
});

async function applyChange(p) {
  const spec = p.change_spec || {};
  switch (p.change_type) {
    case 'adjust_track_sequence': {
      // spec: { milestone_positions: [{milestone_id, position}] }
      for (const m of spec.milestone_positions || []) {
        await query(`UPDATE milestones SET position=$2 WHERE id=$1`, [m.milestone_id, m.position]);
      }
      break;
    }
    case 'add_resource_to_code': {
      // spec: { code_id, resource_id }
      await query(
        `INSERT INTO referral_code_grants (code_id, object_type, object_id)
         VALUES ($1,'resource',$2) ON CONFLICT DO NOTHING`,
        [spec.code_id, spec.resource_id]);
      break;
    }
    case 'add_milestone_grant': {
      // spec: { milestone_id, grant: {object_type, object_id} }
      await query(
        `UPDATE milestones SET grants_json = grants_json || $2::jsonb WHERE id=$1`,
        [spec.milestone_id, JSON.stringify([spec.grant])]);
      break;
    }
    case 'update_group_visibility': {
      await query(`UPDATE groups SET visibility=$2 WHERE id=$1`, [spec.group_id, spec.visibility]);
      break;
    }
    case 'new_data_collection': {
      // Creates the policy INACTIVE-pending-consent: users must opt in before
      // any collection under it counts. Guardrail: approval creates the ask,
      // never the data flow itself.
      await query(
        `INSERT INTO data_collection_policies
           (org_id, category, description, purpose, minor_data, requires_guardian_consent, retention_days, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,true)
         ON CONFLICT (org_id, category) DO NOTHING`,
        [p.org_id, spec.category, spec.description, spec.purpose || 'analytics',
         !!spec.minor_data, !!spec.minor_data, spec.retention_days || 365]);
      break;
    }
    default:
      throw new Error(`change_type ${p.change_type} is not whitelisted for auto-apply`);
  }
}

// ============ Consent & data policies ============
router.get('/policies', async (req, res) => {
  const { rows } = await query(
    `SELECT * FROM data_collection_policies WHERE org_id=$1 AND is_active=true`, [req.user.org_id]);
  res.json(rows);
});

// Grant/revoke my consent (or, for a guardian, on behalf of a linked minor)
router.post('/consents', async (req, res) => {
  const { policy_id, granted, for_user_id } = req.body || {};
  let target = req.user.sub;
  if (for_user_id && for_user_id !== req.user.sub) {
    const g = await query(`SELECT 1 FROM guardianships WHERE guardian_id=$1 AND minor_id=$2`,
      [req.user.sub, for_user_id]);
    if (g.rowCount === 0) return res.status(403).json({ error: 'not this user\'s guardian' });
    target = for_user_id;
  }
  await query(
    `INSERT INTO consents (user_id, policy_id, granted, granted_by, revoked_at)
     VALUES ($1,$2,$3,$4, CASE WHEN $3 THEN NULL ELSE now() END)
     ON CONFLICT (user_id, policy_id)
     DO UPDATE SET granted=$3, granted_by=$4,
       granted_at=now(), revoked_at=CASE WHEN $3 THEN NULL ELSE now() END`,
    [target, policy_id, !!granted, req.user.sub]
  );
  res.json({ user_id: target, policy_id, granted: !!granted });
});

router.get('/consents/me', async (req, res) => {
  const { rows } = await query(
    `SELECT c.policy_id, p.category, p.description, c.granted, c.granted_at, c.revoked_at
     FROM consents c JOIN data_collection_policies p ON p.id=c.policy_id
     WHERE c.user_id=$1`, [req.user.sub]);
  res.json(rows);
});

// ============ Mentorship matching ============
router.post('/matches', requireRole('admin', 'mentor'), async (req, res) => {
  const { mentor_id, mentee_id, match_reason } = req.body || {};
  if (!mentor_id || !mentee_id) return res.status(400).json({ error: 'mentor_id and mentee_id required' });
  const { rows } = await query(
    `INSERT INTO mentorship_matches (org_id, mentor_id, mentee_id, match_reason, proposed_by)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (mentor_id, mentee_id) DO UPDATE SET status='proposed'
     RETURNING *`,
    [req.user.org_id, mentor_id, mentee_id, match_reason || {}, `admin:${req.user.sub}`]
  );
  res.status(201).json(rows[0]);
});
router.post('/matches/:id/status', async (req, res) => {
  const { status } = req.body || {};
  if (!['active', 'paused', 'completed', 'declined'].includes(status))
    return res.status(400).json({ error: 'invalid status' });
  // Mentor, mentee, or admin can update
  const { rows } = await query(
    `UPDATE mentorship_matches SET status=$2
     WHERE id=$1 AND (mentor_id=$3 OR mentee_id=$3 OR $4='admin') RETURNING *`,
    [req.params.id, status, req.user.sub, req.user.role]
  );
  if (!rows[0]) return res.status(403).json({ error: 'not authorized for this match' });
  await logEvent(req.user.sub, 'match_status_changed', {
    metadata: { match_id: req.params.id, status } });
  res.json(rows[0]);
});
router.get('/matches/mine', async (req, res) => {
  const { rows } = await query(
    `SELECT m.*, mu.display_name AS mentor_name, eu.display_name AS mentee_name
     FROM mentorship_matches m
     JOIN users mu ON mu.id=m.mentor_id JOIN users eu ON eu.id=m.mentee_id
     WHERE m.mentor_id=$1 OR m.mentee_id=$1`, [req.user.sub]);
  res.json(rows);
});

// ============ Stakeholder reports (review workflow) ============
router.get('/reports', requireRole('admin'), async (req, res) => {
  const { rows } = await query(
    `SELECT id, audience, title, status, created_at FROM stakeholder_reports
     WHERE org_id=$1 ORDER BY created_at DESC`, [req.user.org_id]);
  res.json(rows);
});
router.get('/reports/:id', requireRole('admin'), async (req, res) => {
  const { rows } = await query(
    `SELECT * FROM stakeholder_reports WHERE id=$1 AND org_id=$2`,
    [req.params.id, req.user.org_id]);
  res.json(rows[0] || null);
});
router.post('/reports/:id/approve', requireRole('admin'), async (req, res) => {
  const { rows } = await query(
    `UPDATE stakeholder_reports SET status='approved', reviewed_by=$2
     WHERE id=$1 AND org_id=$3 AND status='draft' RETURNING id, status`,
    [req.params.id, req.user.sub, req.user.org_id]);
  res.json(rows[0] || { error: 'not found or not a draft' });
});

export default router;
