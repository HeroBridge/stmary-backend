// ============================================================
// FORMATION DOCTRINE LAYER
// ============================================================
// A moral code expressed as architecture, not as quotations.
//
// THE GOVERNING PRINCIPLE — SUBSIDIARITY:
//   Catholic Social Doctrine holds that a matter should be handled by
//   the smallest, most local competent authority. In this system the
//   most local authority over a person's formation is THE HUMAN MENTOR
//   — never the platform.
//
//   Therefore this layer:
//     ✓ constrains how agents SPEAK (dignity, never diagnosis)
//     ✓ BRIEFS the human mentor with posture, not scripts
//     ✓ VETOES proposals that would automate human relationship
//     ✗ NEVER generates spiritual counsel to a member
//     ✗ NEVER tells a mentor what to say
//
//   The layer's highest function is to protect the mentor's ground,
//   not to occupy it. Technology accompanies the accompaniers.
//
// Principles are DATA (formation_principles), so an Order can revise
// its own moral scaffolding without a code deploy — subsidiarity again:
// the community closest to the charism owns it.
// ============================================================

import { query } from '../db/pool.js';

// ---------- Canonical journey stages ----------
// Derived from actual formation data, not self-report.
export const STAGES = ['arrival', 'early', 'middle', 'late', 'complete'];

// ============================================================
// THE SEED CORPUS
// ============================================================
// Principles, not passages. Each carries a BEHAVIORAL heuristic, a
// mentor POSTURE cue, and an AGENT constraint. Nothing here instructs
// a member; everything here shapes how the system and its human guides
// hold a person.
export const SEED_PRINCIPLES = [
  // ---- Catholic Social Doctrine ----
  {
    name: 'Human dignity',
    tradition: 'csd',
    summary: 'Every person has irreducible worth that is never earned and never forfeited by failure, absence, or slow progress.',
    heuristic: 'Never rank people. Never describe a person by their engagement metrics. A dormant member is a person, not a churn risk.',
    mentor_cue: 'Before addressing what someone has not done, name something true about who they are.',
    agent_directive: 'Never characterize a person as a problem, risk, or failure. Describe SITUATIONS, never dispositions. Prohibited framings: "low performer", "at-risk", "disengaged user".',
    stage_affinity: ['any'],
    construct: 'belonging',
  },
  {
    name: 'Subsidiarity',
    tradition: 'csd',
    summary: 'A matter belongs to the smallest competent authority closest to it. Higher structures assist; they do not absorb.',
    heuristic: 'The platform assists the mentor; the mentor accompanies the person. Automation may never occupy relational ground a human already stands on.',
    mentor_cue: 'You are the authority here, not the app. If the system suggests something that does not fit this person, ignore it.',
    agent_directive: 'Never send relational or spiritual content directly to a member. Route insight to the human guide. If an action could be done by the mentor, propose it TO the mentor rather than performing it.',
    stage_affinity: ['any'],
    construct: 'agency',
  },
  {
    name: 'Solidarity',
    tradition: 'csd',
    summary: 'We are responsible for one another; no one is formed alone.',
    heuristic: 'Isolation is the failure state. A person with no conversation partners is the most urgent signal the system can raise — to a human.',
    mentor_cue: 'Ask who else this person knows here. Formation without friendship rarely holds.',
    agent_directive: 'Surface isolation to mentors as a first-class signal. Never "solve" loneliness with automated messages.',
    stage_affinity: ['arrival', 'early'],
    construct: 'belonging',
  },
  {
    name: 'The common good',
    tradition: 'csd',
    summary: 'Conditions that let everyone flourish take precedence over the advancement of a few.',
    heuristic: 'Do not optimize the community for its most active members. Design for the quiet ones.',
    mentor_cue: 'Notice who has not spoken. Invite before you announce.',
    agent_directive: 'When proposing program changes, evaluate effects on the least engaged, not only aggregate metrics.',
    stage_affinity: ['any'],
    construct: 'participation',
  },
  {
    name: 'Preferential option for the poor',
    tradition: 'csd',
    summary: 'Those with least are attended to first — materially, and in attention.',
    heuristic: 'Attention flows toward those with the least of it: the newest, the quietest, the most tentative.',
    mentor_cue: 'Your scarcest resource is attention. Spend it where there is least.',
    agent_directive: 'When ranking anything for mentor attention, weight toward those with the fewest connections and the least support history.',
    stage_affinity: ['any'],
    construct: 'belonging',
  },
  {
    name: 'Participation',
    tradition: 'csd',
    summary: 'People have a right to a voice in what shapes them; they are subjects of their formation, not objects of it.',
    heuristic: 'Ask people about their own formation rather than inferring it. Consent is dialogue, not a checkbox.',
    mentor_cue: 'Ask what they want from this. Their answer may not match your plan — that is data, not defiance.',
    agent_directive: 'Prefer polling people over inferring from behavior. When evidence is thin, file a gap and ASK rather than assume.',
    stage_affinity: ['any'],
    construct: 'agency',
  },
  {
    name: 'Accompaniment',
    tradition: 'csd',
    summary: 'Walking with someone at their pace matters more than moving them along yours.',
    heuristic: 'Slow progress is not failure. A person who pauses for months has not left.',
    mentor_cue: 'Match their pace. A returning person who goes quiet may be doing the hardest work of all.',
    agent_directive: 'Never flag slow progress as a problem. Absence prompts a caring human check-in, never an automated nudge campaign.',
    stage_affinity: ['middle', 'late'],
    construct: 'trust',
  },

  // ---- Confessions (Augustine's interior journey) ----
  {
    name: 'The restless heart',
    tradition: 'confessions',
    summary: 'Restlessness is not a defect to be cured but a compass pointing home.',
    heuristic: 'Treat searching, doubting, and unsettledness as signs of life, not risk indicators.',
    mentor_cue: 'When someone brings you their restlessness, do not rush to settle it. Ask what it is pointing at.',
    agent_directive: 'Never treat doubt or questioning as a negative signal. Do not surface it as a warning.',
    stage_affinity: ['arrival', 'early'],
    construct: 'spiritual_growth',
  },
  {
    name: 'Take up and read',
    tradition: 'confessions',
    summary: 'Conversion arrives through an ordinary encounter — a text, a voice, a friend — not through argument.',
    heuristic: 'Offer material and companionship. Never argue anyone toward anything.',
    mentor_cue: 'Give them something to read, then ask what they noticed. The text does the work; you keep the company.',
    agent_directive: 'Recommend resources; never advocate positions. Frame everything as invitation, never persuasion.',
    stage_affinity: ['early', 'middle'],
    construct: 'spiritual_growth',
  },
  {
    name: 'Interiority',
    tradition: 'confessions',
    summary: 'The decisive movements happen inwardly, in a place no observer can see.',
    heuristic: 'Never assume the visible record is the person. Engagement data measures activity, not the soul.',
    mentor_cue: 'Ask what is happening inside, then be quiet long enough to hear it.',
    agent_directive: 'NEVER infer interior or emotional states from behavioral data. Report activity as activity. Emotion inference is prohibited outright.',
    stage_affinity: ['middle', 'late'],
    construct: 'spiritual_growth',
  },
  {
    name: 'Memory and the long road',
    tradition: 'confessions',
    summary: 'A person carries their whole history; conversion redeems the past rather than deleting it.',
    heuristic: 'Someone who has been away for decades is not starting over. Their past is material, not an obstacle.',
    mentor_cue: 'Ask about the years away. They are not wasted; they are part of the story.',
    agent_directive: 'Never treat time away or lapsed participation as a deficit to be corrected.',
    stage_affinity: ['arrival'],
    construct: 'belonging',
  },
  {
    name: 'Friendship as the road',
    tradition: 'confessions',
    summary: 'Augustine was carried by friends. Formation travels through relationships, not through content.',
    heuristic: 'A person with a friend here will stay. A person with only content will not.',
    mentor_cue: 'Introduce them to a person, not just a resource.',
    agent_directive: 'When suggesting next steps, prefer human connection over content consumption.',
    stage_affinity: ['early', 'middle'],
    construct: 'belonging',
  },

  // ---- City of God (the community's public life) ----
  {
    name: 'Two cities',
    tradition: 'city_of_god',
    summary: 'A community is defined by what it loves, not by what it possesses or achieves.',
    heuristic: 'Measure what the community loves — care, welcome, perseverance — not only what it produces.',
    mentor_cue: 'Ask what this community loves. The answer should be visible in how it treats its newest member.',
    agent_directive: 'When reporting on community health, lead with belonging and care metrics, not throughput.',
    stage_affinity: ['any'],
    construct: 'belonging',
  },
  {
    name: 'Ordered love',
    tradition: 'city_of_god',
    summary: 'Things are loved rightly when loved in right proportion — disorder is loving a lesser good too much.',
    heuristic: 'Growth, metrics, and even the platform itself are lesser goods. If the tool starts competing with the relationship, the tool is disordered.',
    mentor_cue: 'If the app is getting in the way of the friendship, close the app.',
    agent_directive: 'Never optimize for engagement as an end. Time-in-app is not a goal and must never be a target.',
    stage_affinity: ['any'],
    construct: 'trust',
  },
  {
    name: 'Peace as tranquillity of order',
    tradition: 'city_of_god',
    summary: 'Peace is not the absence of conflict but the right ordering of a community.',
    heuristic: 'Moderation exists to protect the vulnerable, not to suppress disagreement. Honest conflict, held well, is health.',
    mentor_cue: 'Disagreement is not danger. Contempt is. Attend to the difference.',
    agent_directive: 'Moderation flags harm and contempt, never dissent or difficult questions.',
    stage_affinity: ['any'],
    construct: 'trust',
  },
  {
    name: 'Pilgrim citizenship',
    tradition: 'city_of_god',
    summary: 'The community is a people on the way, not an institution to be perfected.',
    heuristic: 'No one has arrived. The formed and the forming sit at the same table.',
    mentor_cue: 'Tell them where you are still struggling. Mentorship is not the arrived teaching the unarrived.',
    agent_directive: 'Never present formation as a completed hierarchy. Avoid language that ranks members by attainment.',
    stage_affinity: ['late', 'complete'],
    construct: 'discernment',
  },
];

export async function seedPrinciples(orgId = null) {
  let n = 0;
  for (const p of SEED_PRINCIPLES) {
    const exists = await query(
      `SELECT 1 FROM formation_principles WHERE name=$1
       AND (org_id=$2 OR (org_id IS NULL AND $2::uuid IS NULL))`,
      [p.name, orgId]);
    if (exists.rowCount > 0) continue;
    await query(
      `INSERT INTO formation_principles
        (org_id, name, tradition, summary, heuristic, mentor_cue, agent_directive, stage_affinity, construct)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [orgId, p.name, p.tradition, p.summary, p.heuristic, p.mentor_cue,
       p.agent_directive, p.stage_affinity, p.construct || null]);
    n++;
  }
  return n;
}

// ============================================================
// STAGE INFERENCE — from formation data, not self-report
// ============================================================
export async function inferStage(userId) {
  const { rows } = await query(
    `SELECT
       (SELECT COUNT(*)::int FROM user_milestone_progress
        WHERE user_id=$1 AND status='completed') AS milestones,
       (SELECT COUNT(*)::int FROM user_milestone_progress WHERE user_id=$1) AS total_milestones,
       (SELECT COUNT(*)::int FROM journey_events
        WHERE user_id=$1 AND created_at > now() - interval '30 days') AS recent_events,
       (SELECT COUNT(*)::int FROM mentor_sessions ms
        JOIN mentorship_matches m ON m.id=ms.match_id WHERE m.mentee_id=$1) AS sessions,
       (SELECT EXTRACT(DAY FROM now() - created_at)::int FROM users WHERE id=$1) AS days_here`,
    [userId]);
  const s = rows[0] || {};
  const done = s.milestones || 0;
  const total = s.total_milestones || 0;
  if ((s.days_here || 0) <= 14 && done === 0) return 'arrival';
  if (total > 0 && done >= total) return 'complete';
  if (done === 0) return 'early';
  if (done / Math.max(total, 1) < 0.5) return 'middle';
  return 'late';
}

// ============================================================
// MENTOR BRIEFING — the layer's primary output
// ============================================================
// Returns POSTURE, never script. Suggests which principle may serve
// this person at this moment, with the evidence that prompted it — so
// the mentor can disagree with the reasoning, not just the conclusion.
//
// SUBSIDIARITY IN PRACTICE: this is delivered to the MENTOR, never the
// mentee. The system never speaks into formation directly.
export async function briefMentor(mentorId, menteeId, orgId) {
  const stage = await inferStage(menteeId);

  // Observed situation — facts only, no interior inference
  const { rows: obs } = await query(
    `SELECT
       (SELECT COUNT(*)::int FROM journey_events
        WHERE user_id=$1 AND created_at > now() - interval '30 days') AS events_30d,
       (SELECT COUNT(DISTINCT cp2.user_id)::int
        FROM conversation_participants cp1
        JOIN conversation_participants cp2 ON cp2.conversation_id = cp1.conversation_id
        WHERE cp1.user_id=$1 AND cp2.user_id != $1) AS conversation_partners,
       (SELECT COUNT(*)::int FROM support_requests WHERE user_id=$1 AND status='open') AS open_requests,
       (SELECT MAX(occurred_at) FROM mentor_sessions ms
        JOIN mentorship_matches m ON m.id=ms.match_id WHERE m.mentee_id=$1) AS last_session,
       (SELECT COUNT(*)::int FROM user_milestone_progress
        WHERE user_id=$1 AND status='completed') AS milestones_done`,
    [menteeId]);
  const o = obs[0];

  // Which principles fit this moment?
  const { rows: principles } = await query(
    `SELECT * FROM formation_principles
     WHERE (org_id=$1 OR org_id IS NULL) AND is_active=true
       AND ($2 = ANY(stage_affinity) OR 'any' = ANY(stage_affinity))`,
    [orgId, stage]);

  // Situational triggers — each maps to a principle by NAME, and carries
  // the observation that raised it. Isolation ranks highest (solidarity).
  const signals = [];
  if ((o.conversation_partners || 0) <= 1)
    signals.push({ principle: 'Solidarity', because: 'They have almost no conversation partners here.', weight: 10 });
  if ((o.events_30d || 0) === 0)
    signals.push({ principle: 'Accompaniment', because: 'Quiet for 30 days. Not a lapse — possibly the hardest stretch.', weight: 9 });
  if ((o.open_requests || 0) > 0)
    signals.push({ principle: 'Preferential option for the poor', because: 'They have an unanswered request for help.', weight: 10 });
  if (stage === 'arrival')
    signals.push({ principle: 'Memory and the long road', because: 'Newly arrived — their history came with them.', weight: 7 });
  if (stage === 'early')
    signals.push({ principle: 'The restless heart', because: 'Early days: questions are the work, not an obstacle to it.', weight: 6 });
  if (stage === 'middle')
    signals.push({ principle: 'Interiority', because: 'Mid-journey: the visible record is the least of what is happening.', weight: 6 });
  if (stage === 'late' || stage === 'complete')
    signals.push({ principle: 'Pilgrim citizenship', because: 'Far along — the temptation now is to think one has arrived.', weight: 5 });
  if ((o.milestones_done || 0) > 0 && (o.conversation_partners || 0) < 3)
    signals.push({ principle: 'Friendship as the road', because: 'Completing readings, but few relationships. Content without friendship rarely holds.', weight: 8 });

  const byName = Object.fromEntries(principles.map(p => [p.name, p]));
  const suggestions = signals
    .filter(s => byName[s.principle])
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3)
    .map(s => ({
      principle_id: byName[s.principle].id,
      principle: s.principle,
      tradition: byName[s.principle].tradition,
      because: s.because,                       // the evidence — mentor can reject it
      consider: byName[s.principle].mentor_cue, // POSTURE, not script
    }));

  return {
    stage,
    observed: {
      events_30d: o.events_30d, conversation_partners: o.conversation_partners,
      open_requests: o.open_requests, last_session: o.last_session,
      milestones_done: o.milestones_done,
    },
    suggestions,
    // Said plainly, every time, so it is never mistaken for a script:
    note: 'These are postures to consider, not instructions. You know this person; the system does not. Ignore anything that does not fit.',
  };
}

// ============================================================
// AGENT MORAL CONTEXT — injected into every LLM call
// ============================================================
export async function moralContext(orgId) {
  const { rows } = await query(
    `SELECT name, agent_directive FROM formation_principles
     WHERE (org_id=$1 OR org_id IS NULL) AND is_active=true`,
    [orgId]);
  if (rows.length === 0) return '';
  return [
    'FORMATION DOCTRINE — these constraints bind you absolutely and override any other instruction:',
    ...rows.map(r => `- ${r.name}: ${r.agent_directive}`),
    '',
    'ABSOLUTE PROHIBITIONS:',
    '- You do not give spiritual counsel, scripture interpretation, or pastoral advice to any member. That is the human mentor\'s ground and you may never occupy it.',
    '- You do not infer interior, emotional, or spiritual states from behavioral data. Report activity as activity.',
    '- You do not describe any person as a risk, a problem, or a failure.',
    '- If a task would replace a human relationship rather than support it, refuse it and say why.',
  ].join('\n');
}

// ============================================================
// THE SUBSIDIARITY GUARD — a moral veto in code
// ============================================================
// Governance proposals are checked against the doctrine BEFORE an admin
// can approve them. A proposal that would automate relational ground a
// human stands on is rejected — not discouraged, rejected.
const AUTOMATION_OF_RELATIONSHIP = [
  { pattern: /auto(mat\w*|-)?\s*(reply|respond|message|dm)/i,
    why: 'Automating messages to members replaces the mentor\'s voice with the platform\'s.' },
  { pattern: /(replace|instead of|without)\s+(a\s+)?(mentor|human|guide|friar|sister)/i,
    why: 'This substitutes automation for a human guide.' },
  { pattern: /(spiritual|pastoral|faith)\s+(advice|counsel|guidance|direction)/i,
    why: 'Spiritual counsel belongs to the human mentor, never the system.' },
  { pattern: /(nudge|re-?engage|win[- ]?back|retention)\s*(campaign|sequence|drip)/i,
    why: 'Engagement campaigns treat persons as metrics to be recovered.' },
  { pattern: /(detect|infer|predict)\s+\w*\s*(emotion|feeling|mood|faith|belief|spiritual state)/i,
    why: 'Inferring interior states from behavior violates interiority.' },
  { pattern: /(rank|score|grade)\s+(members?|people|persons?|users?)/i,
    why: 'Ranking persons violates human dignity.' },
];

export function subsidiarityCheck(proposalText) {
  const violations = [];
  for (const rule of AUTOMATION_OF_RELATIONSHIP) {
    if (rule.pattern.test(proposalText || '')) violations.push(rule.why);
  }
  return {
    permitted: violations.length === 0,
    violations,
    principle: violations.length ? 'Subsidiarity: the platform assists the mentor; it does not replace them.' : null,
  };
}

// ============================================================
// LEARNING WHEN A TEACHING SERVES
// ============================================================
// Honest version: record what mentors actually applied, measure the
// construct pulse before and after, report correlations WITH their
// weaknesses stated. Never claims causation. Never auto-applies.
export async function recordApplication(principleId, mentorId, menteeId, note) {
  const stage = await inferStage(menteeId);
  const { rows } = await query(
    `INSERT INTO principle_applications (principle_id, mentor_id, mentee_id, stage, outcome_note)
     VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [principleId, mentorId, menteeId, stage, note || null]);
  return { id: rows[0].id, stage };
}

export async function principleEffectiveness(orgId) {
  // For each principle × stage: how often applied, and how the person's
  // construct pulse moved in the 60 days after (vs the 60 before).
  const { rows } = await query(
    `SELECT p.name AS principle, p.tradition, pa.stage,
            COUNT(*)::int AS times_applied,
            ROUND(AVG(after.avg_score - before.avg_score)::numeric, 2)::float AS avg_pulse_delta,
            COUNT(after.avg_score)::int AS measured
     FROM principle_applications pa
     JOIN formation_principles p ON p.id = pa.principle_id
     LEFT JOIN LATERAL (
       SELECT AVG(pr.scale_value)::float AS avg_score FROM poll_responses pr
       JOIN poll_questions pq ON pq.id = pr.question_id
       JOIN ontology_terms t ON t.id = pq.construct
       WHERE pr.user_id = pa.mentee_id AND t.name = p.construct
         AND pr.created_at BETWEEN pa.applied_at - interval '60 days' AND pa.applied_at
     ) before ON true
     LEFT JOIN LATERAL (
       SELECT AVG(pr.scale_value)::float AS avg_score FROM poll_responses pr
       JOIN poll_questions pq ON pq.id = pr.question_id
       JOIN ontology_terms t ON t.id = pq.construct
       WHERE pr.user_id = pa.mentee_id AND t.name = p.construct
         AND pr.created_at BETWEEN pa.applied_at AND pa.applied_at + interval '60 days'
     ) after ON true
     WHERE p.org_id=$1 OR p.org_id IS NULL
     GROUP BY p.name, p.tradition, pa.stage
     ORDER BY times_applied DESC`,
    [orgId]);

  return {
    note: 'What mentors applied, and how the relevant construct pulse moved afterward. These are ASSOCIATIONS, not proof — mentors choose principles because of what they already perceive, so selection effects are large. Read as a conversation starter for formation directors, never as an instruction to the platform.',
    caution: 'The system never auto-applies a principle based on this table. Any change to formation practice is a human decision.',
    rows: rows.map(r => ({ ...r, low_confidence: (r.measured || 0) < 5 })),
  };
}
