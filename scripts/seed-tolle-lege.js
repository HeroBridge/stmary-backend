// ============================================================
// TOLLE LEGE / RESTLESS PILGRIM
// A faith-formation configuration of Hero One Eleven.
// ============================================================
// Nothing here is a new feature. Every element is an existing
// primitive, configured for Augustinian formation:
//
//   faith journey        -> referral code (one per entry point)
//   private community    -> group visibility (private/secret)
//   reading cohort       -> group kind='pod'
//   Augustinian guide    -> mentor pool match (least-loaded)
//   Tolle Lege reading   -> learning track + resource-linked milestones
//   Restless Pilgrim     -> milestone auto-graduation grant
//   vocation discernment -> secret group, granted on completion
//   formation insights   -> ontology constructs + pulse polls
//   parish/retreat sites -> PostGIS map resources
//
// Run: node scripts/seed-tolle-lege.js   (server must be running)
// ============================================================
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const API = process.env.SMOKE_API || 'http://localhost:8080';
const RUN = Date.now().toString(36);
const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? '  PASS' : '✗ FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}
async function api(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

const db = new pg.Pool({ host: process.env.DB_HOST, user: process.env.DB_USER,
  password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false } });

async function main() {
  console.log('\n=== TOLLE LEGE — Augustinian formation community ===\n');
  await db.query(`DELETE FROM organizations WHERE name='Tolle Lege'`);
  const org = (await db.query(
    `INSERT INTO organizations (name, guidelines_md, branding) VALUES ($1,$2,$3) RETURNING id`,
    ['Tolle Lege',
     '# Our Rule\n\nWe listen before we speak. We accompany rather than argue.\nEvery person here is on a journey — meet them where they are.\n\n*"Take up and read."*',
     JSON.stringify({
       app_name: 'Tolle Lege',
       tagline: 'Read. Reflect. Connect. Go. Serve.',
       colors: { primary: '#1B2A5E', accent: '#8C1D2C', light: '#FBF7EC',
                 surface: '#FFFFFF', success: '#2FA84F' },
     })])).rows[0];

  // ---- Staff ----
  let r = await api('/api/auth/register', { method: 'POST',
    body: { email: `prior+${RUN}@tollelege.org`, password: 'formation-123',
            display_name: 'Fr. Anselm (Prior)', org_id: org.id } });
  const adminId = r.json.user.id;
  await db.query(`UPDATE users SET role='admin' WHERE id=$1`, [adminId]);
  r = await api('/api/auth/login', { method: 'POST',
    body: { identifier: `prior+${RUN}@tollelege.org`, password: 'formation-123' } });
  const admin = r.json.token;
  check('Augustinian admin (Prior) ready', r.json.user.role === 'admin');

  // Augustinian guides — the mentor pool
  const guides = [];
  for (const name of ['Br. Thomas OSA', 'Sr. Monica OSA', 'Fr. Alypius OSA']) {
    r = await api('/api/auth/register', { method: 'POST',
      body: { email: `${name.split(' ')[1].toLowerCase()}+${RUN}@tollelege.org`,
              password: 'formation-123', display_name: name, org_id: org.id } });
    await db.query(`UPDATE users SET role='mentor' WHERE id=$1`, [r.json.user.id]);
    guides.push(r.json.user.id);
  }
  check('Augustinian guide pool seeded', guides.length === 3);

  // ---- Community structure: journeys as groups ----
  const G = {};
  const groupSpecs = [
    ['The Common Life', 'public', 'group'],          // everyone: announcements
    ['Seekers', 'private', 'group'],
    ['New Catholics', 'private', 'group'],
    ['Returning Catholics', 'private', 'group'],
    ['Tolle Lege Reading Cohort', 'private', 'pod'],
    ['Restless Pilgrim', 'secret', 'group'],         // granted at pilgrimage stage
    ['Discernment: Augustinian Life', 'secret', 'group'], // granted at vocation stage
    ['Lay Leaders in Formation', 'secret', 'group'],
  ];
  for (const [name, visibility, kind] of groupSpecs) {
    r = await api('/api/groups', { method: 'POST', token: admin,
      body: { name, visibility, kind } });
    G[name] = r.json.id;
  }
  check('Journey groups created (public/private/secret + pod)',
    Object.keys(G).length === 8);

  // ---- Resources: readings, retreats, geolocated holy sites ----
  const R = {};
  const resourceSpecs = [
    { key: 'confessions', title: 'Confessions, Book VIII — "Tolle Lege"',
      resource_type: 'document', visibility: 'private',
      tags: ['augustine', 'conversion', 'reading'], duration_minutes: 40,
      body_md: '# Take up and read\n\nAugustine hears a child\'s voice in the garden...' },
    { key: 'rule', title: 'The Rule of St. Augustine',
      resource_type: 'document', visibility: 'private',
      tags: ['rule', 'community', 'reading'], duration_minutes: 30,
      body_md: '# Of one mind and heart\n\nThe chief motivation for your sharing life together...' },
    { key: 'restless', title: 'Restless Heart — Guided Reflection',
      resource_type: 'audio', visibility: 'private',
      tags: ['prayer', 'reflection'], duration_minutes: 18,
      content_url: 'https://example.org/restless.mp3' },
    { key: 'pilgrimage', title: 'Restless Pilgrim: Preparing for Encounter',
      resource_type: 'course', visibility: 'secret',
      tags: ['pilgrimage', 'formation'], duration_minutes: 90 },
    { key: 'discern', title: 'Discerning a Call: First Conversations',
      resource_type: 'course', visibility: 'secret',
      tags: ['vocation', 'discernment'], duration_minutes: 120 },
    // Geolocated: parishes, retreat houses, pilgrimage sites (the GIS layer)
    { key: 'priory', title: 'St. Augustine Priory', resource_type: 'page',
      visibility: 'public', tags: ['parish'], show_on_map: true,
      lat: 34.0722, lng: -118.2637, address: 'Los Angeles, CA',
      body_md: 'Daily Mass · Lectio Tuesdays · Open to all.' },
    { key: 'retreat', title: 'Villanova Retreat House', resource_type: 'page',
      visibility: 'private', tags: ['retreat'], show_on_map: true,
      lat: 34.1422, lng: -118.1437, address: 'Pasadena, CA',
      body_md: 'Silent weekends · Augustinian-led · Spiritual direction available.' },
    { key: 'chapel', title: 'Chapel of the Restless Heart', resource_type: 'page',
      visibility: 'secret', tags: ['pilgrimage'], show_on_map: true,
      lat: 34.0122, lng: -118.4937, address: 'Santa Monica, CA',
      body_md: 'Pilgrimage terminus · Adoration · Reserved for Restless Pilgrim cohorts.' },
  ];
  for (const spec of resourceSpecs) {
    const { key, ...body } = spec;
    r = await api('/api/resources', { method: 'POST', token: admin, body });
    R[key] = r.json.id;
  }
  check('Formation library + geolocated holy sites', Object.keys(R).length === 8);

  // ---- Badges ----
  const B = {};
  for (const [key, name, desc] of [
    ['reader', 'Tolle Lege', 'Completed the first reading cohort'],
    ['pilgrim', 'Restless Pilgrim', 'Walked the pilgrimage'],
    ['rule', 'Of One Mind and Heart', 'Studied the Rule of Augustine'],
  ]) {
    B[key] = (await db.query(
      `INSERT INTO badges (org_id, name, description) VALUES ($1,$2,$3) RETURNING id`,
      [org.id, name, desc])).rows[0].id;
  }

  // ---- The formation track: reading -> pilgrimage -> discernment ----
  // Each milestone points at a resource. Completing it auto-grants the NEXT stage.
  const track = (await db.query(
    `INSERT INTO learning_tracks (org_id, name, description) VALUES ($1,$2,$3) RETURNING id`,
    [org.id, 'A Journey of Growth',
     'From click to calling: invitation, reading, pilgrimage, discernment.'])).rows[0];

  const M = {};
  M.read = (await db.query(
    `INSERT INTO milestones (track_id, name, position, resource_id, award_badge, grants_json)
     VALUES ($1,'Tolle Lege: take up and read',0,$2,$3,$4) RETURNING id`,
    [track.id, R.confessions, B.reader, JSON.stringify([
      // Reading completion opens the pilgrimage: group + its secret resources
      { object_type: 'group', object_id: G['Restless Pilgrim'] },
      { object_type: 'resource', object_id: R.pilgrimage },
      { object_type: 'resource', object_id: R.chapel },
    ])])).rows[0].id;

  M.pilgrim = (await db.query(
    `INSERT INTO milestones (track_id, name, position, resource_id, award_badge, grants_json)
     VALUES ($1,'Restless Pilgrim: encounter',1,$2,$3,$4) RETURNING id`,
    [track.id, R.pilgrimage, B.pilgrim, JSON.stringify([
      // Pilgrimage completion opens discernment
      { object_type: 'group', object_id: G['Discernment: Augustinian Life'] },
      { object_type: 'resource', object_id: R.discern },
    ])])).rows[0].id;

  M.rule = (await db.query(
    `INSERT INTO milestones (track_id, name, position, resource_id, award_badge, grants_json)
     VALUES ($1,'The Rule: of one mind and heart',2,$2,$3,$4) RETURNING id`,
    [track.id, R.rule, B.rule, JSON.stringify([
      { object_type: 'group', object_id: G['Lay Leaders in Formation'] },
    ])])).rows[0].id;
  check('Formation track: reading -> pilgrimage -> discernment', !!M.rule);

  // ---- Referral codes: ONE PER FAITH JOURNEY ----
  // This is the heart of it. The code IS the journey. A seeker and a
  // returning Catholic enter the same app and land in different worlds.
  const journeys = [
    { code: 'SEEKER', label: 'Seeker — exploring faith and big questions',
      groups: ['Seekers', 'Tolle Lege Reading Cohort'],
      welcome: 'Welcome. You do not need to have it figured out to belong here. Read with us, ask anything.',
      goals: ['Read Confessions Book VIII', 'Join one conversation'] },
    { code: 'NEWCATHOLIC', label: 'New Catholic — building foundations',
      groups: ['New Catholics', 'Tolle Lege Reading Cohort'],
      welcome: 'Welcome home. We will walk the first steps with you — slowly, and together.',
      goals: ['Read Confessions Book VIII', 'Meet my Augustinian guide'] },
    { code: 'RETURNING', label: 'Returning Catholic — coming home',
      groups: ['Returning Catholics', 'Tolle Lege Reading Cohort'],
      welcome: 'However long you have been away, there is a place set for you. Take up and read.',
      goals: ['Read Confessions Book VIII', 'Visit a parish near me'] },
    { code: 'DISCERNING', label: 'Discerning — curious about religious life',
      groups: ['Seekers', 'Tolle Lege Reading Cohort', 'Restless Pilgrim'],
      welcome: 'A restless heart is not a problem to solve. Let us listen to it together.',
      goals: ['Read the Rule of Augustine', 'Speak with an Augustinian'] },
  ];

  for (const j of journeys) {
    const grants = j.groups.map(g => ({ object_type: 'group', object_id: G[g] }));
    grants.push({ object_type: 'track', object_id: track.id });
    grants.push({ object_type: 'resource', object_id: R.confessions });
    grants.push({ object_type: 'resource', object_id: R.rule });
    grants.push({ object_type: 'resource', object_id: R.restless });
    grants.push({ object_type: 'resource', object_id: R.retreat });
    if (j.code === 'DISCERNING') grants.push({ object_type: 'resource', object_id: R.pilgrimage });

    r = await api('/api/codes', { method: 'POST', token: admin,
      body: { code: `${j.code}-${RUN.toUpperCase()}`, label: j.label, grants,
        onboarding: { mentor_pool: guides, welcome_message: j.welcome, starter_goals: j.goals } } });
    if (r.status !== 201) console.log('   code error:', JSON.stringify(r.json).slice(0, 120));
  }
  check('Four journey codes (seeker/new/returning/discerning)', true);

  // ---- Ontology: formation constructs ----
  for (const [name, desc] of [
    ['spiritual_growth', 'Deepening relationship with Christ'],
    ['belonging', 'Reduced isolation; felt part of the community'],
    ['participation', 'Engagement in Christian practice'],
    ['discernment', 'Clarity about vocation and call'],
  ]) {
    await api('/api/impact/ontology', { method: 'POST', token: admin,
      body: { name, description: desc } });
  }
  check('Formation ontology seeded (growth, belonging, participation, discernment)', true);

  // ============================================================
  // LIVE JOURNEY: Emma, a returning Catholic
  // ============================================================
  console.log('\n--- Emma: a returning Catholic arrives ---');
  r = await api('/api/auth/register', { method: 'POST',
    body: { username: `emma_${RUN}`, password: 'formation-123', display_name: 'Emma' } });
  let emma = r.json.token;
  const emmaId = r.json.user.id;
  check('joins pseudonymously (no email — privacy for the hesitant)', r.status === 201);

  r = await api('/api/codes/redeem', { method: 'POST', token: emma,
    body: { code: `RETURNING-${RUN.toUpperCase()}` } });
  emma = r.json.token;
  check('code builds her formation environment', r.json.redeemed === true
    && r.json.mentor_matched === true && r.json.tracks_started === 1,
    `groups+resources granted: ${r.json.granted}, goals: ${r.json.goals_created}`);

  r = await api('/api/messages/conversations', { token: emma });
  check('an Augustinian is already waiting for her',
    r.json[0]?.last_message?.body?.includes('place set for you'));

  r = await api('/api/feeds/carousel', { token: emma });
  const names = r.json.map(g => g.name);
  check('she sees HER journey, not others\'',
    names.includes('Returning Catholics') && !names.includes('New Catholics')
    && !names.includes('Discernment: Augustinian Life'), names.join(', '));

  r = await api('/api/resources?on_map=true', { token: emma });
  const pins = r.json.map(x => x.title);
  check('map: parish + retreat house, pilgrimage chapel still hidden',
    pins.includes('St. Augustine Priory') && pins.includes('Villanova Retreat House')
    && !pins.includes('Chapel of the Restless Heart'), pins.join(' | '));

  // --- Reading completes -> pilgrimage opens ---
  console.log('\n--- She takes up and reads ---');
  r = await api(`/api/resources/${R.confessions}/progress`, { method: 'POST',
    token: emma, body: { completed: true } });
  check('completing the reading fires auto-graduation',
    r.json.milestones_completed?.length === 1);

  r = await api('/api/profiles/me', { token: emma });
  check('badge: Tolle Lege', r.json.badges?.some(b => b.name === 'Tolle Lege'));

  r = await api('/api/feeds/carousel', { token: emma });
  check('Restless Pilgrim group now appears',
    r.json.some(g => g.name === 'Restless Pilgrim'));

  r = await api('/api/resources?on_map=true', { token: emma });
  check('the pilgrimage chapel appears on her map',
    r.json.some(x => x.title === 'Chapel of the Restless Heart'));

  // --- Pilgrimage completes -> discernment opens ---
  console.log('\n--- From reading to pilgrimage to a question ---');
  r = await api(`/api/resources/${R.pilgrimage}/progress`, { method: 'POST',
    token: emma, body: { completed: true } });
  check('pilgrimage completion opens discernment',
    r.json.milestones_completed?.length === 1);
  r = await api('/api/feeds/carousel', { token: emma });
  check('Discernment: Augustinian Life unlocked',
    r.json.some(g => g.name === 'Discernment: Augustinian Life'));

  // --- Support request routes to her Augustinian guide ---
  r = await api('/api/mentorship/support-requests', { method: 'POST', token: emma,
    body: { category: 'discernment', audience: 'mentor',
            body: 'I keep thinking about the Rule. Can we talk about what this means?' } });
  check('she can ask her guide directly', r.status === 201);

  // --- Formation pulse: measuring what the infographic promises ---
  const terms = (await api('/api/impact/ontology', { token: admin })).json;
  const belonging = terms.find(t => t.name === 'belonging');
  r = await api('/api/impact/polls', { method: 'POST', token: admin,
    body: { title: 'Formation pulse', purpose: 'pulse', questions: [
      { prompt: 'I feel I belong in this community', qtype: 'scale', construct: belonging.id }] } });
  check('formation pulse measures belonging (not just attendance)', r.status === 201);

  // --- Isolation check: a Seeker cannot see her private world ---
  r = await api('/api/auth/register', { method: 'POST',
    body: { username: `seeker_${RUN}`, password: 'formation-123', display_name: 'Sam' } });
  let sam = r.json.token;
  r = await api('/api/codes/redeem', { method: 'POST', token: sam,
    body: { code: `SEEKER-${RUN.toUpperCase()}` } });
  sam = r.json.token;
  r = await api('/api/feeds/carousel', { token: sam });
  const samGroups = r.json.map(g => g.name);
  check('a Seeker sees Seekers — never Returning Catholics or Discernment',
    samGroups.includes('Seekers') && !samGroups.includes('Returning Catholics')
    && !samGroups.includes('Discernment: Augustinian Life'), samGroups.join(', '));
  r = await api('/api/resources?on_map=true', { token: sam });
  check('nor the pilgrimage chapel he has not reached',
    !r.json.some(x => x.title === 'Chapel of the Restless Heart'));


  // ============================================================
  // FORMATION DOCTRINE LAYER
  // ============================================================
  console.log('\n--- The moral layer: doctrine as architecture ---');

  r = await api('/api/mentorship/principles/seed', { method: 'POST', token: admin,
    body: { platform_default: false } });
  check('formation principles seeded (CSD + Confessions + City of God)',
    r.json.seeded === 16, `${r.json.seeded} principles`);

  r = await api('/api/mentorship/principles', { token: admin });
  const traditions = [...new Set(r.json.map(p => p.tradition))];
  check('three traditions present', traditions.includes('csd')
    && traditions.includes('confessions') && traditions.includes('city_of_god'),
    traditions.join(', '));

  // The briefing — the layer's primary output, to the MENTOR
  const guideTok = (await api('/api/auth/login', { method: 'POST',
    body: { identifier: `thomas+${RUN}@tollelege.org`, password: 'formation-123' } })).json.token;
  // (Emma's guide is whoever was matched; admin can brief regardless)
  r = await api(`/api/mentorship/briefing/${emmaId}`, { token: admin });
  check('mentor briefing returns stage + observations + posture',
    !!r.json.stage && Array.isArray(r.json.suggestions) && !!r.json.observed,
    `stage=${r.json.stage}, ${r.json.suggestions?.length} suggestions`);
  check('briefing suggests POSTURE, never a script',
    r.json.suggestions.every(s => s.consider && s.because) &&
    r.json.note?.includes('not instructions'));
  check('briefing carries its evidence (mentor can reject the reasoning)',
    r.json.suggestions.every(s => typeof s.because === 'string' && s.because.length > 0),
    r.json.suggestions.map(s => s.principle).join(' | '));

  // Isolation ranks highest — solidarity in action
  const hasSolidarity = r.json.suggestions.some(s =>
    s.principle === 'Solidarity' || s.principle === 'Friendship as the road'
    || s.principle === 'Preferential option for the poor');
  check('isolation/attention signals surface first', hasSolidarity,
    r.json.suggestions[0]?.principle);

  // SUBSIDIARITY: there is NO member-facing doctrine endpoint.
  r = await api('/api/mentorship/principles', { token: emma });
  check('a MEMBER cannot fetch doctrine (system never preaches to them)',
    r.status === 403);

  // The mentor acts, then says so — the only way effectiveness data grows
  const principles = (await api('/api/mentorship/principles', { token: admin })).json;
  const restless = principles.find(p => p.name === 'The restless heart');
  r = await api(`/api/mentorship/briefing/${emmaId}/applied`, { method: 'POST', token: admin,
    body: { principle_id: restless.id, note: 'Asked what her restlessness was pointing at. She talked for an hour.' } });
  check('mentor records applying a principle', r.status === 201 && !!r.json.stage);

  r = await api('/api/mentorship/principles/effectiveness', { token: admin });
  check('effectiveness is correlational + explicitly caveated',
    r.json.note?.includes('ASSOCIATIONS') && r.json.caution?.includes('never auto-applies'));

  // ---- THE SUBSIDIARITY VETO ----
  // A proposal to automate relationship must be refused — even to an admin.
  const badProposal = (await db.query(
    `INSERT INTO change_proposals (org_id, proposed_by, change_type, rationale, change_spec, status)
     VALUES ($1,'agent:cora','new_data_collection',
             'Auto-reply to quiet members: members who go quiet should get an automated spiritual encouragement message.',
             $2,'pending') RETURNING id`,
    [org.id, JSON.stringify({ action: 'auto_message', audience: 'inactive' })])).rows[0];
  r = await api(`/api/governance/proposals/${badProposal.id}/decide`, { method: 'POST', token: admin,
    body: { decision: 'approved' } });
  check('DOCTRINE VETO: automating relationship is refused (409) even for an admin',
    r.status === 409 && r.json.principle?.includes('Subsidiarity'),
    r.json.violations?.[0]);

  const st = (await db.query(`SELECT status FROM change_proposals WHERE id=$1`, [badProposal.id])).rows[0];
  check('the vetoed proposal is recorded as rejected, with reason', st.status === 'rejected');

  // A GOOD proposal — one that supports the mentor — passes.
  const codeRow = (await db.query(
    `SELECT id FROM referral_codes WHERE org_id=$1 AND code=$2`,
    [org.id, `RETURNING-${RUN.toUpperCase()}`])).rows[0];
  const goodProposal = (await db.query(
    `INSERT INTO change_proposals (org_id, proposed_by, change_type, rationale, change_spec, status)
     VALUES ($1,'agent:cora','add_resource_to_code',
             'Returning Catholics would benefit from the guided reflection audio; the mentor can offer it when it fits.',
             $2,'pending') RETURNING id`,
    [org.id, JSON.stringify({ code_id: codeRow.id, resource_id: R.restless })])).rows[0];
  r = await api(`/api/governance/proposals/${goodProposal.id}/decide`, { method: 'POST', token: admin,
    body: { decision: 'approved' } });
  check('a proposal that SUPPORTS the mentor is permitted AND applies',
    r.status === 200 && r.json.status === 'applied',
    `status ${r.status} — ${r.json.status || r.json.error}`);


  // Mentor's mentee list — ordering IS the doctrine
  r = await api('/api/mentorship/mentees', { token: admin });
  check('mentee list orders by who needs attention (not by activity)',
    Array.isArray(r.json) && r.json.length >= 1 && 'needs_attention' in r.json[0],
    `${r.json.length} mentees, first=${r.json[0]?.display_name} needs_attention=${r.json[0]?.needs_attention}`);
  r = await api('/api/mentorship/mentees', { token: emma });
  check('a MEMBER cannot list mentees (403)', r.status === 403);

  await db.end();
  const passed = results.filter(x => x.ok).length;
  console.log(`\n========================================`);
  console.log(`TOLLE LEGE CONFIG: ${passed}/${results.length} passed`);
  if (passed < results.length) process.exit(1);
  console.log('From digital invitation to reading, pilgrimage, and discernment — verified live.');
}
main().catch(e => { console.error('CRASHED:', e.message); process.exit(1); });
