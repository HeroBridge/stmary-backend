// ============================================================
// Verification engine — the Claims Ledger's enforcement layer.
// ============================================================
// Principles:
//  1. A claim is verified by RECOMPUTING its evidence from live data,
//     never by trusting the text.
//  2. Story evidence requires the subject's recorded external-use
//     consent AND approved status. No consent -> unverifiable, and a
//     gap is filed to go get consent (or find another story).
//  3. Metrics below the sample floor are unverifiable — small numbers
//     make claims that data can't support. A gap is filed to collect more.
//  4. Every unverifiable claim produces a data_gap with a suggested
//     collection action: the system's ignorance becomes a work queue.

import { query } from '../db/pool.js';

const SAMPLE_FLOOR = 5;         // minimum n for an aggregate claim
const METRIC_TOLERANCE = 0.15;  // recomputed value may drift ±15% (data moves)
const PREF_STALE_DAYS = 365;    // preferences older than this trigger re-poll gaps

// ---------- Supported metric kinds (recomputable) ----------
// Each returns { value, n } from live data. Adding a kind = adding a
// verifiable vocabulary item for MEERKAT.
const METRIC_KINDS = {
  async event_count(orgId, p) {
    const { rows } = await query(
      `SELECT COUNT(*)::int AS value, COUNT(DISTINCT je.user_id)::int AS n
       FROM journey_events je JOIN users u ON u.id = je.user_id
       WHERE u.org_id=$1 AND je.event_type=$2
         AND je.created_at > now() - ($3 || ' days')::interval`,
      [orgId, p.event_type, p.window_days || 90]);
    return rows[0];
  },
  async active_members(orgId, p) {
    const { rows } = await query(
      `SELECT COUNT(DISTINCT je.user_id)::int AS value, COUNT(DISTINCT je.user_id)::int AS n
       FROM journey_events je JOIN users u ON u.id = je.user_id
       WHERE u.org_id=$1 AND je.created_at > now() - ($2 || ' days')::interval`,
      [orgId, p.window_days || 90]);
    return rows[0];
  },
  async resource_completion_rate(orgId, p) {
    const { rows } = await query(
      `SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE rp.status='completed') / NULLIF(COUNT(*),0))::int AS value,
              COUNT(*)::int AS n
       FROM resource_progress rp JOIN resources r ON r.id = rp.resource_id
       WHERE r.org_id=$1 ${p.resource_id ? 'AND r.id=$2' : ''}`,
      p.resource_id ? [orgId, p.resource_id] : [orgId]);
    return rows[0];
  },
  async badges_earned(orgId, p) {
    const { rows } = await query(
      `SELECT COUNT(*)::int AS value, COUNT(DISTINCT ub.user_id)::int AS n
       FROM user_badges ub JOIN users u ON u.id = ub.user_id
       WHERE u.org_id=$1 AND ub.earned_at > now() - ($2 || ' days')::interval`,
      [orgId, p.window_days || 90]);
    return rows[0];
  },
  async milestone_completions(orgId, p) {
    const { rows } = await query(
      `SELECT COUNT(*)::int AS value, COUNT(DISTINCT ump.user_id)::int AS n
       FROM user_milestone_progress ump JOIN users u ON u.id = ump.user_id
       WHERE u.org_id=$1 AND ump.status='completed'
         AND ump.completed_at > now() - ($2 || ' days')::interval`,
      [orgId, p.window_days || 90]);
    return rows[0];
  },
  async construct_pulse(orgId, p) {
    // Average pulse score for an ontology construct (e.g. trust) in a window
    const { rows } = await query(
      `SELECT ROUND(AVG(pr.scale_value), 2)::float AS value, COUNT(*)::int AS n
       FROM poll_responses pr
       JOIN poll_questions pq ON pq.id = pr.question_id
       JOIN polls pl ON pl.id = pq.poll_id
       WHERE pl.org_id=$1 AND pq.construct=$2 AND pr.scale_value IS NOT NULL
         AND pr.created_at > now() - ($3 || ' days')::interval`,
      [orgId, p.construct_id, p.window_days || 90]);
    return rows[0];
  },
};

export function supportedMetricKinds() { return Object.keys(METRIC_KINDS); }

export async function fileGap(orgId, gapType, description, neededFor, suggestedAction) {
  const { rows } = await query(
    `INSERT INTO data_gaps (org_id, gap_type, description, needed_for, suggested_action)
     VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [orgId, gapType, description, neededFor, suggestedAction]);
  return rows[0].id;
}

// ---------- Verify one claim; file gaps when unverifiable ----------
export async function verifyClaim(orgId, claim) {
  const ref = claim.evidence_ref || {};

  if (claim.evidence_type === 'metric') {
    const fn = METRIC_KINDS[ref.kind];
    if (!fn) return { verified: false, note: `unknown metric kind: ${ref.kind}` };
    const { value, n } = await fn(orgId, ref.params || {});
    if (n != null && n < SAMPLE_FLOOR) {
      await fileGap(orgId, 'small_sample',
        `Claim "${claim.claim_text.slice(0, 80)}" rests on n=${n} (< ${SAMPLE_FLOOR}).`,
        { report_id: claim.report_id, metric: ref.kind },
        `Collect more data before publishing: n=${SAMPLE_FLOOR} minimum. Consider widening the window or running a pulse poll.`);
      return { verified: false, note: `sample too small (n=${n})`, recomputed: value };
    }
    // First computation: the claim was ledgered before its value existed.
    // Stamp the recomputed value into the evidence so future verifications
    // check drift against this baseline.
    if (ref.value == null) {
      await query(
        `UPDATE claims SET evidence_ref = evidence_ref || jsonb_build_object('value', $2::numeric, 'computed_at', now())
         WHERE id=$1`, [claim.id, value]);
      return { verified: true, note: `computed ${value} (n=${n})`, recomputed: value };
    }
    const claimed = Number(ref.value);
    const drift = claimed === 0 ? (value === 0 ? 0 : 1)
      : Math.abs(value - claimed) / Math.abs(claimed);
    if (drift > METRIC_TOLERANCE) {
      return { verified: false,
        note: `recomputed ${value} vs claimed ${claimed} (drift ${(drift * 100).toFixed(0)}% > ${METRIC_TOLERANCE * 100}%)`,
        recomputed: value };
    }
    return { verified: true, note: `recomputed ${value} (n=${n})`, recomputed: value };
  }

  if (claim.evidence_type === 'story') {
    const { rows } = await query(
      `SELECT id, status, consent_external, subject_user_id FROM stories WHERE id=$1 AND org_id=$2`,
      [ref.story_id, orgId]);
    const s = rows[0];
    if (!s) return { verified: false, note: 'story not found' };
    if (s.status !== 'approved') return { verified: false, note: 'story not approved' };
    if (s.subject_user_id && !s.consent_external) {
      await fileGap(orgId, 'no_consented_story',
        `Story ${s.id} is cited externally but its subject has not consented to external use.`,
        { report_id: claim.report_id, story_id: s.id },
        `Request external-use consent from the subject (or their guardian), or substitute a consented story.`);
      return { verified: false, note: 'subject has not consented to external use' };
    }
    return { verified: true, note: 'approved story with recorded consent' };
  }

  if (claim.evidence_type === 'poll') {
    const { rows } = await query(
      `SELECT ROUND(AVG(scale_value),2)::float AS avg, COUNT(*)::int AS n
       FROM poll_responses WHERE question_id=$1 AND scale_value IS NOT NULL`,
      [ref.question_id]);
    const { avg, n } = rows[0];
    if (n < SAMPLE_FLOOR) {
      await fileGap(orgId, 'small_sample',
        `Poll-based claim has only ${n} responses.`,
        { report_id: claim.report_id, question_id: ref.question_id },
        `Re-send the poll or extend its window until n>=${SAMPLE_FLOOR}.`);
      return { verified: false, note: `only ${n} responses` };
    }
    return { verified: true, note: `avg ${avg} across ${n} responses` };
  }

  return { verified: false, note: 'unknown evidence type' };
}

// ---------- Verify a whole communication ----------
export async function verifyReport(orgId, reportId) {
  const { rows: claims } = await query(
    `SELECT * FROM claims WHERE report_id=$1`, [reportId]);
  const results = [];
  for (const c of claims) {
    const r = await verifyClaim(orgId, c);
    await query(`UPDATE claims SET verified=$2, verify_note=$3 WHERE id=$1`,
      [c.id, r.verified, r.note]);
    results.push({ claim_id: c.id, text: c.claim_text, ...r });
  }
  const allVerified = results.length > 0 && results.every(r => r.verified);
  return { all_verified: allVerified, claims: results };
}

// ---------- Proactive gap sweep (staleness, preference re-polling) ----------
export async function sweepGaps(orgId) {
  const filed = [];
  // Stale communication preferences -> re-poll
  const { rows: stale } = await query(
    `SELECT s.id, s.name FROM stakeholders s
     JOIN comm_preferences cp ON cp.stakeholder_id = s.id
     WHERE s.org_id=$1 AND cp.polled_at < now() - ($2 || ' days')::interval`,
    [orgId, PREF_STALE_DAYS]);
  for (const s of stale) {
    filed.push(await fileGap(orgId, 'stale_preferences',
      `${s.name}'s communication preferences were last polled over a year ago.`,
      { stakeholder_id: s.id },
      `Send a preference re-poll (comm_preference purpose) to this stakeholder.`));
  }
  // Constructs with no recent pulse data
  const { rows: cold } = await query(
    `SELECT t.id, t.name FROM ontology_terms t
     WHERE (t.org_id=$1 OR t.org_id IS NULL)
       AND NOT EXISTS (
         SELECT 1 FROM poll_questions pq
         JOIN poll_responses pr ON pr.question_id = pq.id
         JOIN polls pl ON pl.id = pq.poll_id
         WHERE pq.construct = t.id AND pl.org_id=$1
           AND pr.created_at > now() - interval '120 days')`,
    [orgId]);
  for (const t of cold) {
    filed.push(await fileGap(orgId, 'missing_construct',
      `No pulse data for '${t.name}' in 120 days — claims about it cannot be verified.`,
      { construct: t.name },
      `Run a short pulse poll including a '${t.name}' question.`));
  }
  return { gaps_filed: filed.length };
}
