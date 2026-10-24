// ============================================================
// Agent layer — HERO, TILLY, CORA, EDDI, RITA, MEERKAT
// ============================================================
// Design rules (the guardrails, enforced structurally):
//  1. Agents READ the journey transcript, profiles, and insights.
//  2. Agents WRITE ONLY: agent_insights, agent_tasks, stakeholder_reports
//     (as drafts), and change_proposals. They NEVER mutate groups,
//     entitlements, tracks, or user data directly.
//  3. Any change to the community framework goes through change_proposals
//     and requires human (admin) approval before it is applied.
//  4. Analysis of a user requires active consent for the data categories
//     involved. No consent -> the agent run is refused.
//  5. Every run is logged in agent_runs for auditability.
//
// LLM calls go to AWS Bedrock. If Bedrock credentials/SDK are absent
// (local dev), a deterministic fallback summarizer runs instead so the
// pipeline stays testable end to end.

import { query } from '../db/pool.js';
import { moralContext } from './doctrine.js';

const BEDROCK_MODEL = process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-5-sonnet-20241022-v2:0';

// ---------- Consent gate ----------
export async function hasConsent(userId, categories) {
  const { rows } = await query(
    `SELECT p.category
     FROM consents c
     JOIN data_collection_policies p ON p.id = c.policy_id
     WHERE c.user_id = $1 AND c.granted = true AND c.revoked_at IS NULL
       AND p.is_active = true AND p.category = ANY($2)`,
    [userId, categories]
  );
  const granted = new Set(rows.map(r => r.category));
  return categories.every(c => granted.has(c));
}

// ---------- LLM invocation (Bedrock with local fallback) ----------
async function invokeLLM(systemPrompt, userPrompt, orgId = null) {
  // FORMATION DOCTRINE: the moral layer binds every agent utterance.
  // Loaded fresh from the DB so an Order can revise its own moral
  // scaffolding without a code deploy (subsidiarity applied to itself).
  if (orgId) {
    const doctrine = await moralContext(orgId);
    if (doctrine) systemPrompt = `${doctrine}\n\n---\n\n${systemPrompt}`;
  }
  try {
    // Lazy import so local dev without the SDK still works.
    const { BedrockRuntimeClient, InvokeModelCommand } = await import('@aws-sdk/client-bedrock-runtime');
    const client = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'us-west-2' });
    const res = await client.send(new InvokeModelCommand({
      modelId: BEDROCK_MODEL,
      contentType: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 1500,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    }));
    const payload = JSON.parse(new TextDecoder().decode(res.body));
    return { text: payload.content?.[0]?.text || '', model: BEDROCK_MODEL };
  } catch (err) {
    // Fallback: deterministic, no-LLM summary so the pipeline is testable.
    console.warn('Bedrock unavailable, using local fallback:', err.message);
    return { text: null, model: 'local-fallback' };
  }
}

// ---------- Shared: pull a user's recent transcript ----------
async function getTranscript(userId, limit = 200) {
  const { rows } = await query(
    `SELECT event_type, object_type, metadata, created_at
     FROM journey_events WHERE user_id=$1
     ORDER BY created_at DESC LIMIT $2`,
    [userId, limit]
  );
  return rows;
}

async function recordRun(agent, orgId, subjectUser, input, output, modelId, status = 'completed') {
  const { rows } = await query(
    `INSERT INTO agent_runs (agent, org_id, subject_user, input_summary, output_summary, model_id, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [agent, orgId, subjectUser, input, output, modelId, status]
  );
  return rows[0].id;
}

async function saveInsight(runId, agent, subjectUser, insightType, content, confidence = null) {
  const { rows } = await query(
    `INSERT INTO agent_insights (run_id, agent, subject_user, insight_type, content, confidence)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [runId, agent, subjectUser, insightType, content, confidence]
  );
  return rows[0].id;
}

// ============================================================
// TILLY — interprets the person. Builds a learner/mentee profile
// from transcript patterns + notes shared WITH CONSENT.
// ============================================================
export async function runTilly(orgId, subjectUserId) {
  const required = ['engagement_events', 'session_notes'];
  if (!(await hasConsent(subjectUserId, required))) {
    return { refused: true, reason: 'missing consent for: ' + required.join(', ') };
  }
  const transcript = await getTranscript(subjectUserId);
  const counts = rollup(transcript);

  const { text, model } = await invokeLLM(
    `You are TILLY, an agent that interprets a person's engagement patterns to help
     mentors serve them better. Output STRICT JSON:
     {"strengths":[], "preferred_modes":[], "engagement_pattern":"", "suggested_supports":[], "confidence":0.0}
     Be conservative. Never diagnose. Describe observed behavior only.`,
    `Event counts for this participant: ${JSON.stringify(counts)}.
     Recent events (most recent first): ${JSON.stringify(transcript.slice(0, 60))}`
  , orgId);

  const profile = text ? safeJson(text) : {
    strengths: topKeys(counts, 3),
    preferred_modes: [],
    engagement_pattern: `Most frequent actions: ${topKeys(counts, 3).join(', ') || 'none yet'}`,
    suggested_supports: [],
    confidence: 0.3,
  };

  const runId = await recordRun('tilly', orgId, subjectUserId, { events: transcript.length }, profile, model);
  await saveInsight(runId, 'tilly', subjectUserId, 'learner_profile', profile, profile.confidence ?? null);
  return { runId, profile };
}

// ============================================================
// CORA — interprets the system. Looks across the org for patterns
// (aggregate, not individual) and may file change_proposals.
// ============================================================
export async function runCora(orgId) {
  const { rows: agg } = await query(
    `SELECT event_type, COUNT(*)::int AS n, COUNT(DISTINCT user_id)::int AS users
     FROM journey_events je JOIN users u ON u.id = je.user_id
     WHERE u.org_id = $1 AND je.created_at > now() - interval '30 days'
     GROUP BY event_type ORDER BY n DESC`,
    [orgId]
  );

  const { text, model } = await invokeLLM(
    `You are CORA, an agent that analyzes program-level patterns for a mentorship org.
     Given 30-day aggregate activity, output STRICT JSON:
     {"observations":[], "proposals":[{"change_type":"adjust_track_sequence|add_resource_to_code|add_milestone_grant",
       "rationale":"", "change_spec":{}}]}
     Only propose from the allowed change_type list. Propose sparingly, with evidence.`,
    `30-day aggregates: ${JSON.stringify(agg)}`
  , orgId);

  const output = text ? safeJson(text) : { observations: agg.slice(0, 5), proposals: [] };
  const runId = await recordRun('cora', orgId, null, { aggregates: agg.length }, output, model);
  await saveInsight(runId, 'cora', null, 'pattern', output);

  // File proposals — pending human approval, never auto-applied here.
  const filed = [];
  for (const p of output.proposals || []) {
    if (!['adjust_track_sequence', 'add_resource_to_code', 'add_milestone_grant'].includes(p.change_type)) continue;
    const { rows } = await query(
      `INSERT INTO change_proposals (org_id, proposed_by, change_type, rationale, evidence, change_spec)
       VALUES ($1,'agent:cora',$2,$3,$4,$5) RETURNING id`,
      [orgId, p.change_type, p.rationale || 'CORA pattern analysis', { run_id: runId }, p.change_spec || {}]
    );
    filed.push(rows[0].id);
  }
  return { runId, observations: output.observations, proposals_filed: filed };
}

// ============================================================
// EDDI — evaluates the evidence. Compares a user's trajectory
// against their goals/milestones; flags velocity changes.
// ============================================================
export async function runEddi(orgId, subjectUserId) {
  if (!(await hasConsent(subjectUserId, ['engagement_events', 'goal_progress']))) {
    return { refused: true, reason: 'missing consent' };
  }
  const { rows: weekly } = await query(
    `SELECT date_trunc('week', created_at) AS week, COUNT(*)::int AS events
     FROM journey_events WHERE user_id=$1 AND created_at > now() - interval '8 weeks'
     GROUP BY 1 ORDER BY 1`,
    [subjectUserId]
  );
  const { rows: progress } = await query(
    `SELECT status, COUNT(*)::int FROM user_milestone_progress WHERE user_id=$1 GROUP BY status`,
    [subjectUserId]
  );

  const evaluation = {
    weekly_activity: weekly,
    milestone_status: progress,
    trend: trend(weekly.map(w => w.events)),
    note: 'Velocity evaluation from transcript; flags are intervention variables, not judgments.',
  };
  const runId = await recordRun('eddi', orgId, subjectUserId, {}, evaluation, 'local-analytic');
  await saveInsight(runId, 'eddi', subjectUserId, 'evidence_eval', evaluation);
  return { runId, evaluation };
}

// ============================================================
// RITA — moves the work. Turns insights into operational tasks
// for HUMANS (coordinators, mentors). Does not act on users.
// ============================================================
export async function runRita(orgId) {
  // Example heuristics; extend with real triggers.
  const { rows: inactive } = await query(
    `SELECT u.id, u.display_name FROM users u
     WHERE u.org_id=$1 AND u.role='member'
       AND NOT EXISTS (SELECT 1 FROM journey_events je
                       WHERE je.user_id=u.id AND je.created_at > now() - interval '14 days')
     LIMIT 20`,
    [orgId]
  );
  const created = [];
  for (const u of inactive) {
    const { rows } = await query(
      `INSERT INTO agent_tasks (org_id, task_type, subject_user, payload, due_at)
       VALUES ($1,'follow_up',$2,$3, now() + interval '3 days')
       RETURNING id`,
      [orgId, u.id, { reason: 'No activity in 14 days', suggested: 'Coordinator check-in' }]
    );
    created.push(rows[0].id);
  }
  const runId = await recordRun('rita', orgId, null, { inactive: inactive.length }, { tasks: created.length }, 'local-analytic');
  return { runId, tasks_created: created };
}

// ============================================================
// MEERKAT — stakeholder communication. Drafts narrative reports
// grounded in the actual metrics (data_basis kept for traceability).
// Drafts REQUIRE human review before 'sent'.
// ============================================================
export async function runMeerkat(orgId, audience = 'donor') {
  const { rows: metrics } = await query(
    `SELECT event_type, COUNT(*)::int AS n
     FROM journey_events je JOIN users u ON u.id = je.user_id
     WHERE u.org_id=$1 AND je.created_at > now() - interval '90 days'
     GROUP BY event_type ORDER BY n DESC LIMIT 15`,
    [orgId]
  );
  const { rows: badges } = await query(
    `SELECT COUNT(*)::int AS badges FROM user_badges ub
     JOIN users u ON u.id = ub.user_id WHERE u.org_id=$1
       AND ub.earned_at > now() - interval '90 days'`,
    [orgId]
  );

  const dataBasis = { window: '90d', activity: metrics, badges_earned: badges[0].badges };
  const { text, model } = await invokeLLM(
    `You are MEERKAT, drafting a warm, honest impact report for a ${audience}.
     Ground EVERY claim in the provided metrics. No invented numbers or anecdotes.
     Use aggregate program language only — never name or describe an individual
     participant. Output markdown, 300-500 words.`,
    `Program metrics (90 days): ${JSON.stringify(dataBasis)}`
  , orgId);

  const body = text || fallbackReport(dataBasis, audience);
  const { rows } = await query(
    `INSERT INTO stakeholder_reports (org_id, audience, title, body_md, data_basis)
     VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [orgId, audience, `Quarterly impact report (${audience})`, body, dataBasis]
  );
  const runId = await recordRun('meerkat', orgId, null, dataBasis, { report_id: rows[0].id }, model);
  return { runId, report_id: rows[0].id, status: 'draft — requires human review' };
}

// ---------- helpers ----------
function rollup(events) {
  const c = {};
  for (const e of events) c[e.event_type] = (c[e.event_type] || 0) + 1;
  return c;
}
function topKeys(obj, n) {
  return Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k);
}
function trend(series) {
  if (series.length < 2) return 'insufficient_data';
  const half = Math.floor(series.length / 2);
  const a = avg(series.slice(0, half)), b = avg(series.slice(half));
  return b > a * 1.15 ? 'accelerating' : b < a * 0.85 ? 'slowing' : 'steady';
}
const avg = (xs) => xs.reduce((s, x) => s + x, 0) / (xs.length || 1);
function safeJson(text) {
  try { return JSON.parse(text.replace(/```json|```/g, '').trim()); }
  catch { return { parse_error: true, raw: text.slice(0, 500) }; }
}
function fallbackReport(basis, audience) {
  const lines = basis.activity.map(m => `- ${m.event_type.replace(/_/g, ' ')}: ${m.n}`).join('\n');
  return `# Program impact (last 90 days)\n\nThis ${audience} report is generated from the program's activity record.\n\n**Activity summary:**\n${lines}\n\n**Badges earned:** ${basis.badges_earned}\n\n*(Draft generated without LLM narrative — connect Bedrock for the full narrative report.)*`;
}

// ============================================================
// MEERKAT v2 — preference-aware, claims-first composition.
// Order of operations is the point:
//   1. Read the stakeholder segment's POLLED preferences (depth, topics).
//   2. Gather only RECOMPUTABLE metrics + CONSENTED stories for those topics.
//   3. Write the claims ledger FIRST.
//   4. Draft prose constrained to the claims (LLM may phrase, never add facts).
//   5. Verify every claim against live data; file gaps for anything weak.
// A communication whose claims don't all verify stays an unapprovable draft.
// ============================================================
export async function composeCommunication(orgId, opts = {}) {
  const { verifyReport, fileGap, supportedMetricKinds } = await import('./verification.js');
  const { audience = 'donor', comm_type = 'impact_update', campaign_id = null,
          stakeholder_kind = audience, window_days = 90 } = opts;

  // 1) Aggregate the segment's polled preferences
  const { rows: prefs } = await query(
    `SELECT cp.depth, cp.topic_terms FROM comm_preferences cp
     JOIN stakeholders s ON s.id = cp.stakeholder_id
     WHERE s.org_id=$1 AND s.kind=$2`, [orgId, stakeholder_kind]);
  const depthVotes = { story_first: 0, balanced: 0, data_first: 0 };
  const topicCounts = {};
  for (const p of prefs) {
    depthVotes[p.depth] = (depthVotes[p.depth] || 0) + 1;
    for (const t of p.topic_terms || []) topicCounts[t] = (topicCounts[t] || 0) + 1;
  }
  const depth = Object.entries(depthVotes).sort((a, b) => b[1] - a[1])[0][0];
  const topTopics = Object.entries(topicCounts).sort((a, b) => b[1] - a[1])
    .slice(0, 3).map(([id]) => id);
  if (prefs.length === 0) {
    await fileGap(orgId, 'stale_preferences',
      `No polled communication preferences exist for '${stakeholder_kind}' stakeholders; composing with defaults.`,
      { stakeholder_kind },
      `Run a comm_preference poll for this segment so future communications are tailored, not guessed.`);
  }

  // 2) Gather evidence: standard metrics + construct pulses for their topics
  const evidence = [];
  const metricPlan = [
    { kind: 'active_members', params: { window_days } },
    { kind: 'milestone_completions', params: { window_days } },
    { kind: 'badges_earned', params: { window_days } },
    { kind: 'resource_completion_rate', params: {} },
  ];
  for (const m of metricPlan) {
    const fnList = supportedMetricKinds();
    if (!fnList.includes(m.kind)) continue;
    evidence.push({ evidence_type: 'metric', ref: { ...m, window_days } });
  }
  for (const construct of topTopics) {
    evidence.push({ evidence_type: 'metric',
      ref: { kind: 'construct_pulse', params: { construct_id: construct, window_days } } });
  }
  // Consented, approved stories (topic-tagged first, newest otherwise)
  const { rows: storyRows } = await query(
    `SELECT st.id, st.title, LEFT(st.body_md, 400) AS excerpt FROM stories st
     WHERE st.org_id=$1 AND st.status='approved'
       AND (st.subject_user_id IS NULL OR st.consent_external = true)
     ORDER BY (EXISTS (SELECT 1 FROM ontology_tags ot
                WHERE ot.object_type='story' AND ot.object_id=st.id::text
                  AND ot.term_id = ANY($2))) DESC, st.created_at DESC
     LIMIT $3`,
    [orgId, topTopics, depth === 'story_first' ? 3 : 1]);

  // 3) Create the draft + claims ledger
  const { rows: rep } = await query(
    `INSERT INTO stakeholder_reports (org_id, audience, title, body_md, data_basis, comm_type, campaign_id)
     VALUES ($1,$2,$3,'(composing…)',$4,$5,$6) RETURNING id`,
    [orgId, stakeholder_kind, `${comm_type.replace(/_/g, ' ')} — ${new Date().toISOString().slice(0, 10)}`,
     { window_days, depth, topics: topTopics, preference_sample: prefs.length }, comm_type, campaign_id]);
  const reportId = rep[0].id;

  const claimSummaries = [];
  for (const ev of evidence) {
    if (ev.evidence_type === 'metric') {
      try {
        const { rows: c } = await query(
          `INSERT INTO claims (report_id, claim_text, evidence_type, evidence_ref)
           VALUES ($1,$2,'metric',$3) RETURNING id`,
          [reportId, `metric:${ev.ref.kind}`, { kind: ev.ref.kind, params: ev.ref.params, value: null }]);
        claimSummaries.push({ id: c[0].id, kind: ev.ref.kind });
      } catch (e) { console.warn('claim insert failed', e.message); }
    }
  }
  for (const st of storyRows) {
    const { rows: c } = await query(
      `INSERT INTO claims (report_id, claim_text, evidence_type, evidence_ref)
       VALUES ($1,$2,'story',$3) RETURNING id`,
      [reportId, `story: ${st.title}`, { story_id: st.id }]);
    claimSummaries.push({ id: c[0].id, story: st.title, excerpt: st.excerpt });
  }

  // 4) First verification pass fills in recomputed values + files gaps
  const verification = await verifyReport(orgId, reportId);

  // 5) Draft prose constrained to VERIFIED claims only
  const verifiedClaims = verification.claims.filter(c => c.verified);
  const { text, model } = await invokeLLM(
    `You are MEERKAT, drafting a ${comm_type.replace(/_/g, ' ')} for ${stakeholder_kind}s who prefer a
     ${depth.replace('_', '-')} style. HARD RULES: every factual statement must come from the verified
     claims provided; do not invent numbers, names, or anecdotes; aggregate program language only —
     no identifying details beyond what a cited story contains; 300-500 words of warm, honest markdown.`,
    `Verified claims: ${JSON.stringify(verifiedClaims)}\nUnverified (MUST NOT be used): ${JSON.stringify(verification.claims.filter(c => !c.verified).map(c => c.text))}`
  , orgId);
  const body = text || `# ${comm_type.replace(/_/g, ' ')}\n\nVerified basis:\n` +
    verifiedClaims.map(c => `- ${c.text}: ${c.note}`).join('\n') +
    `\n\n*(Connect Bedrock for narrative drafting; claims above are live-verified.)*`;
  await query(`UPDATE stakeholder_reports SET body_md=$2 WHERE id=$1`, [reportId, body]);

  const runId = await recordRun('meerkat', orgId, null,
    { comm_type, stakeholder_kind, preference_sample: prefs.length },
    { report_id: reportId, verified: verifiedClaims.length, unverified: verification.claims.length - verifiedClaims.length },
    model);

  return {
    runId, report_id: reportId,
    all_claims_verified: verification.all_verified,
    verified: verifiedClaims.length,
    unverified: verification.claims.length - verifiedClaims.length,
    status: verification.all_verified
      ? 'draft — verified, awaiting human approval'
      : 'draft — HAS UNVERIFIED CLAIMS; resolve gaps before approval',
  };
}
