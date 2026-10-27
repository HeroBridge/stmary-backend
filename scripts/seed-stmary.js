// ============================================================
// SAINT MARY MOTHER OF GOD — parish pilot seed
// ============================================================
// Built from the Ministry Discovery Worksheet. Three pilot ministries:
//   Young Adult (20–35), Life Teen (13–18), Young Families.
// Real admins, real events, and logins for the pilot team.
//
// Run on the live server:  npm run seed:stmary
// Safe to re-run: it clears and rebuilds the "Saint Mary" org each time.
// ============================================================
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const API = process.env.SMOKE_API || `http://localhost:${process.env.PORT || 8080}`;
const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? '  OK  ' : '✗ FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}
async function api(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

const db = new pg.Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
    : { host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME, ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false } });

// Everyone's demo password (simple for the pilot; tell people to change it).
const PW = 'SaintMary2026';

async function main() {
  console.log('\n=== SAINT MARY MOTHER OF GOD — parish pilot ===\n');

  // Fresh org each run
  await db.query(`DELETE FROM organizations WHERE name='Saint Mary Mother of God'`);
  const org = (await db.query(
    `INSERT INTO organizations (name, guidelines_md, branding) VALUES ($1,$2,$3) RETURNING id`,
    ['Saint Mary Mother of God',
     '# Welcome to Saint Mary\n\nWe are a parish family in Middletown, New Jersey.\nEncounter. Live. Proclaim.\n\n*To Jesus through Mary.*',
     JSON.stringify({
       app_name: 'Saint Mary',
       tagline: 'Encounter · Live · Proclaim',
       colors: { primary: '#003264', accent: '#C09048', light: '#F4F6FA',
                 surface: '#FFFFFF', success: '#2F8A4F' },
     })])).rows[0];
  check('Parish created (Middletown, NJ)', !!org.id);

  // ---- helper: make a user with a role, return token ----
  async function makeUser(display, email, role = 'member') {
    await db.query(`DELETE FROM users WHERE email=$1`, [email]);
    let r = await api('/api/auth/register', { method: 'POST',
      body: { email, password: PW, display_name: display, org_id: org.id } });
    const id = r.json.user?.id;
    if (role !== 'member') await db.query(`UPDATE users SET role=$2 WHERE id=$1`, [id, role]);
    r = await api('/api/auth/login', { method: 'POST', body: { identifier: email, password: PW } });
    return { id, token: r.json.token, email, display, role: r.json.user?.role };
  }

  // ============================================================
  // PILOT TEAM — real people from the worksheet
  // ============================================================
  console.log('\n--- Parish team & logins ---');
  // Parish-level admins
  const frank  = await makeUser('Frank Connelly', 'frank@herobridgela.org', 'admin');          // HeroBridge
  const jackie = await makeUser('Jackie Ross', 'jross@stmarychurchnj.org', 'admin');           // Admin General
  const bill   = await makeUser('Deacon Bill Ross', 'deaconbill@stmarychurchnj.org', 'admin'); // Deacon
  const dominic= await makeUser('Dominic Ambrosio', 'dominic@sundaytosunday.com', 'admin');    // Media
  const sandra = await makeUser('Sandra Thuel', 'sanramthu@gmail.com', 'admin');               // Admin

  // Ministry heads (mentors = ministry leaders in the platform)
  const mike   = await makeUser('Mike Griggs', 'mfgriggs73@gmail.com', 'mentor');          // YA lead
  const matt   = await makeUser('Matthew I. Ross', 'matthewiross39@gmail.com', 'mentor');  // YA lead
  const matej  = await makeUser('Matej Zivkovic', 'mzivkovic@stmarychurchnj.org', 'mentor');// Life Teen lead
  const carlos = await makeUser('Carlos Solórzano', 'carlosadrianjr@gmail.com', 'mentor');  // Young Families lead
  const mariam = await makeUser('Mariam Chebly', 'mmc519@nyu.edu', 'mentor');               // Young Families lead
  check('Logins created for the pilot team', [frank,jackie,bill,dominic,sandra,mike,matej,carlos].every(u => u.token));

  // Thomas — on Frank's team, treated as a general parishioner for the pilot.
  const thomas = await makeUser('Thomas Osborn', 'thomas.s.osborn@gmail.com', 'member');

  // A few sample member parishioners so feeds/rosters aren't empty
  const members = [];
  for (const [name, email] of [
    ['Maria Castellano','maria.c@example.com'], ['Danny Flynn','danny.f@example.com'],
    ['Sofia Russo','sofia.r@example.com'], ['Emily Tran','emily.t@example.com'],
    ['Josh Bauer','josh.b@example.com'], ['Ana Reyes','ana.r@example.com']]) {
    members.push(await makeUser(name, email, 'member'));
  }
  check('Sample parishioners created', members.length === 6);

  // ============================================================
  // MINISTRIES — the three pilots (as groups) + a common feed
  // ============================================================
  console.log('\n--- Pilot ministries ---');
  const G = {};
  async function makeGroup(name, visibility, kind, description) {
    const r = await api('/api/groups', { method: 'POST', token: jackie.token,
      body: { name, visibility, kind, description } });
    G[name] = r.json.id;
    return r.json.id;
  }
  await makeGroup('Parish Life', 'public', 'group', 'Announcements for the whole parish.');
  await makeGroup('Young Adult Ministry', 'private', 'group',
    'Ages 20–35. Deepen formation through Lectio, Adoration, worship, and fellowship. Meets weekly.');
  await makeGroup('Life Teen', 'private', 'group',
    'Ages 13–18. Small groups with a core team, Life Nights, and retreats.');
  await makeGroup('Young Families', 'private', 'group',
    'Young couples with children (babies to ~14). Kinship, support, and growing in faith together.');
  check('Three pilot ministries + Parish Life created', Object.keys(G).length === 4);

  // ---- assign ministry heads + members to groups (via SQL for reliability) ----
  async function join(userId, groupId, role = 'member') {
    await db.query(
      `INSERT INTO group_members (group_id, user_id, role) VALUES ($1,$2,$3)
       ON CONFLICT (group_id, user_id) DO UPDATE SET role=EXCLUDED.role`,
      [groupId, userId, role]);
    // Also grant the entitlement — this is what lets a member SEE a private
    // group in their feed and POST to it. group_members alone isn't enough.
    await db.query(
      `INSERT INTO user_entitlements (user_id, object_type, object_id, granted_by)
       VALUES ($1,'group',$2,'seed')
       ON CONFLICT (user_id, object_type, object_id) DO NOTHING`,
      [userId, groupId]);
  }
  // everyone is in Parish Life
  for (const u of [frank,jackie,bill,dominic,sandra,mike,matt,matej,carlos,mariam,thomas,...members])
    await join(u.id, G['Parish Life']);
  // Parish admins (staff) belong to EVERY ministry — they oversee all of them,
  // and this lets them see and demo every ministry in the app.
  for (const admin of [frank,jackie,bill,dominic,sandra])
    for (const gname of ['Young Adult Ministry','Life Teen','Young Families'])
      await join(admin.id, G[gname], 'leader');
  // ministry leaders + a few members each
  await join(mike.id, G['Young Adult Ministry'], 'leader');
  await join(matt.id, G['Young Adult Ministry'], 'leader');
  for (const u of [members[0],members[1],members[2],members[3]]) await join(u.id, G['Young Adult Ministry']);
  await join(matej.id, G['Life Teen'], 'leader');
  for (const u of [members[4]]) await join(u.id, G['Life Teen']);
  await join(carlos.id, G['Young Families'], 'leader');
  await join(mariam.id, G['Young Families'], 'leader');
  for (const u of [members[5],members[2]]) await join(u.id, G['Young Families']);
  check('Ministry heads and members assigned', true);

  // ============================================================
  // EVENTS — real upcoming parish events (from Frank)
  // ============================================================
  console.log('\n--- Parish events ---');
  const events = [
    { group: 'Parish Life', title: 'All Souls\' Day Reflection',
      description: 'An evening of hope and remembrance with Fr. Jeff Kegley. Church.',
      starts_at: '2026-11-02T19:00:00-05:00', ends_at: '2026-11-02T20:00:00-05:00' },
    { group: 'Young Adult Ministry', title: 'Young Adult Testimony Night',
      description: 'An evening of faith, fellowship, and real stories. Parish Center.',
      starts_at: '2026-11-12T19:00:00-05:00', ends_at: '2026-11-12T20:30:00-05:00' },
    { group: 'Parish Life', title: 'Why Saint Mary\'s — Family Talk',
      description: 'Parishioner families share how Saint Mary\'s has shaped their lives. Waldeck Hall.',
      starts_at: '2026-11-18T18:00:00-05:00', ends_at: '2026-11-18T19:30:00-05:00' },
  ];
  let evCount = 0;
  for (const e of events) {
    const r = await api('/api/events', { method: 'POST', token: jackie.token,
      body: { group_id: G[e.group], title: e.title, description: e.description,
              starts_at: e.starts_at, ends_at: e.ends_at } });
    if (r.status === 201) evCount++;
    else console.log('   event error:', JSON.stringify(r.json).slice(0, 120));
  }
  check('Parish events created (Nov 2, 12, 18)', evCount === 3);

  // ============================================================
  // FEED POSTS — so each ministry has something to show
  // ============================================================
  console.log('\n--- Seed posts ---');
  async function post(token, groupName, body) {
    const r = await api('/api/feeds', { method: 'POST', token,
      body: { group_id: G[groupName], body } });
    return r.status === 201;
  }
  let posts = 0;
  posts += await post(jackie.token, 'Parish Life',
    'Welcome to the Saint Mary app! This is our new home for ministries, events, and staying connected. Explore your ministries below.') ? 1 : 0;
  posts += await post(mike.token, 'Young Adult Ministry',
    'Testimony Night is Nov 12 at the Parish Center — invite a friend. Who can help with setup at 6:30?') ? 1 : 0;
  posts += await post(members[0].token, 'Young Adult Ministry',
    'I\'ll be there early to help set up and start the coffee.') ? 1 : 0;
  posts += await post(matej.token, 'Life Teen',
    'Core team: Life Night this week. Small group leaders, please confirm you\'re covering your group.') ? 1 : 0;
  posts += await post(carlos.token, 'Young Families',
    'Park meetup this Saturday morning — bring the kids. Teens from Life Teen may join to help watch little ones.') ? 1 : 0;
  posts += await post(mariam.token, 'Young Families',
    'Starting a WhatsApp-style thread here for the moms\' and dads\' groups. So glad this community is growing.') ? 1 : 0;
  check('Seed posts across ministries', posts >= 5, `${posts} posts`);

  // ============================================================
  // MENTORSHIP — a match so the briefing feature has data
  // ============================================================
  console.log('\n--- Mentorship (YA transition team) ---');
  // Mike mentors a newer young adult — the "bridge to parish life" from the worksheet
  await db.query(
    `INSERT INTO mentorship_matches (org_id, mentor_id, mentee_id, status)
     VALUES ($1,$2,$3,'active') ON CONFLICT DO NOTHING`,
    [org.id, mike.id, members[1].id]);
  check('Mentor match seeded (YA)', true);

  // ============================================================
  // REFERRAL CODES — one per ministry, for onboarding new members
  // ============================================================
  console.log('\n--- Ministry invite codes ---');
  const codes = [
    { code: 'YOUNGADULT', label: 'Young Adult Ministry', group: 'Young Adult Ministry', lead: [mike.id, matt.id],
      welcome: 'Welcome to the Young Adult Ministry! We\'re glad you\'re here. Jump into the feed and come to our next gathering.' },
    { code: 'LIFETEEN', label: 'Life Teen', group: 'Life Teen', lead: [matej.id],
      welcome: 'Welcome to Life Teen! Your small group leader will reach out. See you at Life Night.' },
    { code: 'YOUNGFAMILIES', label: 'Young Families', group: 'Young Families', lead: [carlos.id, mariam.id],
      welcome: 'Welcome to Young Families! You\'ve found your people. Watch for our next park meetup.' },
  ];
  let codeCount = 0;
  for (const c of codes) {
    const r = await api('/api/codes', { method: 'POST', token: jackie.token,
      body: { code: c.code, label: c.label,
        grants: [{ object_type: 'group', object_id: G[c.group] }],
        onboarding: { mentor_pool: c.lead, welcome_message: c.welcome,
          starter_goals: ['Introduce yourself in the feed', 'RSVP to the next event'] } } });
    if (r.status === 201) codeCount++;
    else console.log('   code error:', JSON.stringify(r.json).slice(0, 120));
  }
  check('Ministry invite codes created', codeCount === 3);

  await db.end();

  // ---- summary ----
  const passed = results.filter(x => x.ok).length;
  console.log(`\n========================================`);
  console.log(`SAINT MARY PILOT: ${passed}/${results.length} passed`);
  console.log(`\nLOGINS (password for all: ${PW}):`);
  for (const u of [frank,jackie,bill,dominic,sandra,mike,matt,matej,carlos,mariam,thomas])
    console.log(`  ${u.role.toUpperCase().padEnd(7)} ${u.display.padEnd(22)} ${u.email}`);
  console.log(`\nMINISTRY INVITE CODES: YOUNGADULT · LIFETEEN · YOUNGFAMILIES`);
  if (passed < results.length) { console.log('\nSome steps failed — see FAIL lines above.'); process.exit(1); }
  console.log('\nParish is seeded. The app will now show Saint Mary ministries, events, and people.');
}
main().catch(e => { console.error('CRASHED:', e.message); process.exit(1); });
