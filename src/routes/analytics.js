import { Router } from 'express';
import { query } from '../db/pool.js';
import { authRequired, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(authRequired, requireRole('admin', 'mentor'));

// NOTE ON EPISTEMICS: everything here is observational. Endpoints report
// correlations, deltas, and coverage — never causal proof. Language in
// outputs is chosen accordingly, and small samples are labeled.

const MIN_N = 5;

// ============ Sliced activity: individual → community ============
// ?scope=user|match|group|org  &id=<uuid>  &days=30  &construct=<term_id>
// Ontology construct filter rides on tagged events when present.
router.get('/activity', async (req, res) => {
  const { scope = 'org', id, construct } = req.query;
  const days = Math.min(parseInt(req.query.days) || 30, 365);
  const params = [days];
  let joinUsers = `JOIN users u ON u.id = je.user_id`;
  let where = ``;

  if (scope === 'user' && id) { params.push(id); where = `AND je.user_id=$${params.length}`; }
  else if (scope === 'match' && id) {
    params.push(id);
    where = `AND je.user_id IN (SELECT mentee_id FROM mentorship_matches WHERE id=$${params.length}
             UNION SELECT mentor_id FROM mentorship_matches WHERE id=$${params.length})`;
  }
  else if (scope === 'group' && id) {
    params.push(id);
    where = `AND je.user_id IN (SELECT user_id FROM group_members WHERE group_id=$${params.length})`;
  }
  else { params.push(req.user.org_id); where = `AND u.org_id=$${params.length}`; }

  let constructJoin = '';
  if (construct) {
    params.push(construct);
    constructJoin = `JOIN ontology_tags ot ON ot.object_type='journey_event'
                     AND ot.object_id = je.id::text AND ot.term_id=$${params.length}`;
  }

  const { rows } = await query(
    `SELECT date_trunc('week', je.created_at) AS week, je.event_type, COUNT(*)::int AS n
     FROM journey_events je ${joinUsers} ${constructJoin}
     WHERE je.created_at > now() - ($1 || ' days')::interval ${where}
     GROUP BY 1, 2 ORDER BY 1`,
    params);
  res.json({ scope, id: id || req.user.org_id, days, series: rows });
});

// ============ Real-time field map ============
// Geo intensity: engagement volume per located resource/event pin.
router.get('/field-map', async (req, res) => {
  const days = Math.min(parseInt(req.query.days) || 30, 365);
  const resources = (await query(
    `SELECT r.id, r.title, 'resource' AS pin_type,
            ST_X(r.location::geometry) AS lng, ST_Y(r.location::geometry) AS lat,
            COUNT(je.id)::int AS activity
     FROM resources r
     LEFT JOIN journey_events je ON je.object_type='resource'
       AND je.object_id = r.id AND je.created_at > now() - ($2 || ' days')::interval
     WHERE r.org_id=$1 AND r.location IS NOT NULL
     GROUP BY r.id ORDER BY activity DESC`,
    [req.user.org_id, days])).rows;
  const events = (await query(
    `SELECT e.id, e.title, 'event' AS pin_type,
            ST_X(e.location::geometry) AS lng, ST_Y(e.location::geometry) AS lat,
            COUNT(rv.user_id)::int AS activity
     FROM events e
     LEFT JOIN event_rsvps rv ON rv.event_id = e.id
     JOIN groups g ON g.id = e.group_id
     WHERE g.org_id=$1 AND e.location IS NOT NULL
     GROUP BY e.id ORDER BY activity DESC`,
    [req.user.org_id])).rows;
  res.json({ days, pins: [...resources, ...events] });
});

// ============ Engagement trends ============
router.get('/trends', async (req, res) => {
  const days = Math.min(parseInt(req.query.days) || 90, 365);
  const { rows } = await query(
    `WITH weekly AS (
       SELECT date_trunc('week', je.created_at) AS week,
              COUNT(DISTINCT je.user_id)::int AS active, COUNT(*)::int AS events
       FROM journey_events je JOIN users u ON u.id=je.user_id
       WHERE u.org_id=$1 AND je.created_at > now() - ($2 || ' days')::interval
       GROUP BY 1 ORDER BY 1)
     SELECT week, active, events,
            active - LAG(active) OVER (ORDER BY week) AS active_delta
     FROM weekly`,
    [req.user.org_id, days]);
  res.json({ days, weekly: rows });
});

// ============ Mentorship effectiveness (correlational, labeled) ============
// Per mentor: session cadence, mentee activity, milestone velocity,
// support resolution. Deltas are associations, not causation.
router.get('/mentorship-effectiveness', async (req, res) => {
  const { rows } = await query(
    `SELECT m.mentor_id, u.display_name AS mentor_name,
       COUNT(DISTINCT m.id) FILTER (WHERE m.status='active')::int AS active_matches,
       COUNT(DISTINCT ms.id)::int AS sessions_90d,
       ROUND(AVG(mentee_activity.n), 1)::float AS avg_mentee_events_30d,
       COUNT(DISTINCT ump.milestone_id)::int AS mentee_milestones_90d
     FROM mentorship_matches m
     JOIN users u ON u.id = m.mentor_id
     LEFT JOIN mentor_sessions ms ON ms.match_id = m.id
       AND ms.occurred_at > now() - interval '90 days'
     LEFT JOIN LATERAL (
       SELECT COUNT(*)::int AS n FROM journey_events je
       WHERE je.user_id = m.mentee_id AND je.created_at > now() - interval '30 days') mentee_activity ON true
     LEFT JOIN user_milestone_progress ump ON ump.user_id = m.mentee_id
       AND ump.status='completed' AND ump.completed_at > now() - interval '90 days'
     WHERE m.org_id=$1
     GROUP BY m.mentor_id, u.display_name
     ORDER BY sessions_90d DESC`,
    [req.user.org_id]);
  res.json({
    note: 'Observational associations. Higher mentee activity alongside frequent sessions is a signal to explore, not proof of causation.',
    mentors: rows,
  });
});

// ============ Donor resonance tracking ============
// Resonance = engagement depth with communications, per stakeholder,
// plus alignment between their polled topics and what they engage with.
// Honest framing: a proxy built from observable actions.
router.get('/resonance', requireRole('admin'), async (req, res) => {
  const { rows } = await query(
    `SELECT s.id, s.name, s.kind,
       COUNT(ce.id) FILTER (WHERE ce.action='sent')::int AS sent,
       COUNT(ce.id) FILTER (WHERE ce.action='opened')::int AS opened,
       COUNT(ce.id) FILTER (WHERE ce.action IN ('clicked','replied','shared'))::int AS engaged,
       COUNT(ce.id) FILTER (WHERE ce.action='gave_after')::int AS gave_after,
       MAX(ce.occurred_at) AS last_touch,
       cp.polled_at AS preferences_polled_at
     FROM stakeholders s
     LEFT JOIN communication_engagement ce ON ce.stakeholder_id = s.id
       AND ce.occurred_at > now() - interval '365 days'
     LEFT JOIN comm_preferences cp ON cp.stakeholder_id = s.id
     WHERE s.org_id=$1
     GROUP BY s.id, s.name, s.kind, cp.polled_at
     ORDER BY engaged DESC`,
    [req.user.org_id]);
  const scored = rows.map(r => ({
    ...r,
    resonance_score: r.sent === 0 ? null
      : Math.round(100 * (r.opened * 1 + r.engaged * 3 + r.gave_after * 6) / (r.sent * 6)),
  }));
  res.json({
    note: 'Resonance is a proxy score from observable engagement (open=1, engage=3, gave_after=6, normalized). Null = nothing sent yet.',
    stakeholders: scored,
  });
});

// ============ Readiness measures (AI adoption & other constructs) ============
// Pulse-based: construct averages over time from the polling engine.
router.get('/readiness', async (req, res) => {
  const { rows } = await query(
    `SELECT t.name AS construct,
            date_trunc('month', pr.created_at) AS month,
            ROUND(AVG(pr.scale_value),2)::float AS avg_score,
            COUNT(*)::int AS n
     FROM poll_responses pr
     JOIN poll_questions pq ON pq.id = pr.question_id
     JOIN polls pl ON pl.id = pq.poll_id
     JOIN ontology_terms t ON t.id = pq.construct
     WHERE pl.org_id=$1 AND pr.scale_value IS NOT NULL
     GROUP BY t.name, 2 ORDER BY t.name, 2`,
    [req.user.org_id]);
  res.json({
    note: `Construct scores from pulse polls (1-5). Cells with n<${MIN_N} are directional only.`,
    series: rows.map(r => ({ ...r, low_sample: r.n < MIN_N })),
  });
});

// ============ Intervention outcome measurement ============
// Before/after activity deltas around interventions (mentor sessions,
// support resolutions, next-steps completed). Correlational by design.
router.get('/interventions', async (req, res) => {
  const days = 14; // window each side
  const { rows } = await query(
    `WITH interventions AS (
       SELECT je.user_id, je.created_at AS at, je.event_type AS kind
       FROM journey_events je JOIN users u ON u.id=je.user_id
       WHERE u.org_id=$1
         AND je.event_type IN ('session_logged','check_in_logged','support_resolved','next_step_done')
         AND je.created_at BETWEEN now() - interval '120 days' AND now() - ($2 || ' days')::interval)
     SELECT i.kind, COUNT(*)::int AS n,
       ROUND(AVG(before.n), 1)::float AS avg_events_before,
       ROUND(AVG(after.n), 1)::float AS avg_events_after,
       ROUND(AVG(after.n - before.n), 1)::float AS avg_delta
     FROM interventions i
     LEFT JOIN LATERAL (
       SELECT COUNT(*)::int AS n FROM journey_events je2
       WHERE je2.user_id=i.user_id
         AND je2.created_at BETWEEN i.at - ($2 || ' days')::interval AND i.at) before ON true
     LEFT JOIN LATERAL (
       SELECT COUNT(*)::int AS n FROM journey_events je3
       WHERE je3.user_id=i.user_id
         AND je3.created_at BETWEEN i.at AND i.at + ($2 || ' days')::interval) after ON true
     GROUP BY i.kind`,
    [req.user.org_id, days]);
  res.json({
    note: `Activity ${days} days before vs after each intervention. Positive deltas are associations worth investigating — regression to the mean and seasonality are NOT controlled here.`,
    window_days: days,
    by_intervention: rows.map(r => ({ ...r, low_sample: r.n < MIN_N })),
  });
});

// ============ Predictive model readiness ============
// The honest version of "predictive models": measure whether the data
// could support one yet. Reports sample depth, feature coverage, consent
// coverage, and time span per candidate outcome — and what's missing.
router.get('/model-readiness', requireRole('admin'), async (req, res) => {
  const org = req.user.org_id;
  const [members, consented, timespan, milestoneOutcomes, pulseCoverage, sessionCoverage] =
    await Promise.all([
      query(`SELECT COUNT(*)::int AS n FROM users WHERE org_id=$1`, [org]),
      query(`SELECT COUNT(DISTINCT c.user_id)::int AS n FROM consents c
             JOIN users u ON u.id=c.user_id
             WHERE u.org_id=$1 AND c.granted=true AND c.revoked_at IS NULL`, [org]),
      query(`SELECT EXTRACT(DAY FROM now() - MIN(je.created_at))::int AS days
             FROM journey_events je JOIN users u ON u.id=je.user_id WHERE u.org_id=$1`, [org]),
      query(`SELECT COUNT(*)::int AS n FROM user_milestone_progress ump
             JOIN users u ON u.id=ump.user_id
             WHERE u.org_id=$1 AND ump.status='completed'`, [org]),
      query(`SELECT COUNT(DISTINCT pq.construct)::int AS n FROM poll_responses pr
             JOIN poll_questions pq ON pq.id=pr.question_id
             JOIN polls pl ON pl.id=pq.poll_id WHERE pl.org_id=$1`, [org]),
      query(`SELECT COUNT(*)::int AS n FROM mentor_sessions ms
             JOIN mentorship_matches m ON m.id=ms.match_id WHERE m.org_id=$1`, [org]),
    ]);

  const checks = [
    { requirement: 'Consented participants (features usable)', have: consented.rows[0].n,
      need: 100, why: 'Models may only train on consented data.' },
    { requirement: 'Milestone outcomes (labels)', have: milestoneOutcomes.rows[0].n,
      need: 200, why: 'Outcome prediction needs labeled completions.' },
    { requirement: 'Data time span (days)', have: timespan.rows[0].days || 0,
      need: 180, why: 'Trajectories need at least two quarters of history.' },
    { requirement: 'Constructs with pulse data', have: pulseCoverage.rows[0].n,
      need: 4, why: 'Human-factor features (trust, belonging...) come from pulses.' },
    { requirement: 'Logged mentor sessions', have: sessionCoverage.rows[0].n,
      need: 100, why: 'Intervention features require session records.' },
  ].map(c => ({ ...c, ready: c.have >= c.need,
                gap: c.have >= c.need ? 0 : c.need - c.have }));

  res.json({
    members: members.rows[0].n,
    overall_ready: checks.every(c => c.ready),
    checks,
    guidance: checks.every(c => c.ready)
      ? 'Data thresholds met. Next step: export a feature snapshot to the warehouse and run baseline models with a holdout — thresholds are necessary, not sufficient.'
      : 'Not yet ready for predictive modeling. The gaps above are your collection roadmap — publish honest descriptive analytics meanwhile.',
  });
});

export default router;
