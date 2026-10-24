#!/usr/bin/env python3
# Assembles the self-contained interactive demo (demo.html)
import sys; sys.path.insert(0, '/tmp')
from assets import BADGE, MASCOT, HEAD

HTML = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Hero One Eleven — Interactive Demo</title>
<style>
  :root{ --navy:#12123D; --red:#E43024; --light:#F4F4F8; --gray:#6E6E80; --green:#2FA84F; --gold:#C8901E; }
  *{ box-sizing:border-box; margin:0; }
  body{ font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; background:var(--navy); color:var(--light); min-height:100vh; display:flex; flex-direction:column; align-items:center; padding:24px 16px 40px; }
  header{ display:flex; align-items:center; gap:14px; margin-bottom:18px; }
  header img{ width:52px; height:52px; }
  header .wm{ font-weight:800; letter-spacing:.14em; font-size:20px; }
  header .by{ font-size:12px; color:#9FA0C4; letter-spacing:.08em; }
  .stage-wrap{ display:flex; gap:32px; align-items:center; flex-wrap:wrap; justify-content:center; max-width:960px; }
  /* phone */
  .phone{ width:320px; height:660px; background:#16161C; border-radius:44px; padding:10px; box-shadow:0 24px 60px rgba(0,0,0,.45); flex:none; }
  .screen{ position:relative; width:100%; height:100%; background:var(--light); border-radius:36px; overflow:hidden; }
  .notch{ position:absolute; top:8px; left:50%; transform:translateX(-50%); width:110px; height:22px; background:#16161C; border-radius:12px; z-index:50; }
  .view{ position:absolute; inset:0; opacity:0; pointer-events:none; transition:opacity .35s; display:flex; flex-direction:column; }
  .view.on{ opacity:1; pointer-events:auto; }
  .appbar{ background:var(--navy); color:var(--light); padding:40px 16px 12px; display:flex; align-items:center; gap:10px; font-weight:700; font-size:15px; }
  .appbar img{ width:26px; height:26px; }
  .body{ flex:1; overflow:hidden; padding:12px; position:relative; }
  .card{ background:#fff; border-radius:12px; padding:12px; margin-bottom:10px; }
  .kicker{ color:var(--red); font-size:10px; font-weight:800; letter-spacing:.06em; }
  .who{ color:var(--navy); font-weight:700; font-size:13px; margin:2px 0; }
  .txt{ color:#3c3c46; font-size:12.5px; line-height:1.45; }
  .meta{ color:var(--gray); font-size:11px; margin-top:8px; }
  .btn{ background:var(--red); color:var(--light); border:none; border-radius:10px; padding:12px; font-weight:800; font-size:14px; width:100%; cursor:pointer; }
  .btn:active{ transform:scale(.98); }
  /* narration */
  .panel{ max-width:380px; min-width:300px; flex:1; }
  .panel .step{ color:var(--red); font-weight:800; font-size:12px; letter-spacing:.1em; }
  .panel h2{ font-size:26px; margin:8px 0 12px; }
  .panel p{ color:#C9CADF; font-size:15px; line-height:1.6; margin-bottom:12px; }
  .panel .hood{ background:rgba(255,255,255,.06); border-left:3px solid var(--red); padding:10px 14px; font-size:13px; color:#B9BAD4; border-radius:0 8px 8px 0; }
  .controls{ display:flex; align-items:center; gap:16px; margin-top:22px; }
  .nav{ background:transparent; color:var(--light); border:1.5px solid rgba(255,255,255,.35); border-radius:10px; padding:10px 20px; font-weight:700; cursor:pointer; font-size:14px; }
  .nav.primary{ background:var(--red); border-color:var(--red); }
  .nav:disabled{ opacity:.3; cursor:default; }
  .dots{ display:flex; gap:7px; }
  .dot{ width:8px; height:8px; border-radius:50%; background:rgba(255,255,255,.25); }
  .dot.on{ background:var(--red); }
  /* onboarding view */
  .vcenter{ flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:20px; background:var(--navy); }
  .vcenter img.badge{ width:110px; height:110px; margin-bottom:14px; }
  .vcenter .t1{ color:var(--light); font-weight:800; letter-spacing:.1em; font-size:17px; }
  .vcenter .t2{ color:#9FA0C4; font-size:12px; margin:6px 0 22px; text-align:center; }
  .codebox{ background:#fff; border-radius:10px; padding:13px; width:100%; text-align:center; font-weight:800; letter-spacing:.2em; color:var(--navy); font-size:16px; min-height:46px; }
  .cursor{ display:inline-block; width:2px; height:16px; background:var(--navy); animation:blink 1s infinite; vertical-align:-2px; }
  @keyframes blink{ 50%{opacity:0} }
  .preview{ color:#7ED99B; font-size:11.5px; margin:10px 0 16px; opacity:0; transition:opacity .5s; min-height:16px; }
  .preview.show{ opacity:1; }
  /* arrival checklist */
  .chk{ display:flex; align-items:center; gap:10px; background:#fff; border-radius:10px; padding:11px 12px; margin-bottom:8px; opacity:0; transform:translateY(8px); transition:all .4s; }
  .chk.show{ opacity:1; transform:none; }
  .chk .ic{ width:22px; height:22px; border-radius:50%; background:var(--green); color:#fff; font-size:13px; display:flex; align-items:center; justify-content:center; flex:none; }
  .chk .lbl{ color:var(--navy); font-size:12.5px; font-weight:600; }
  /* carousel */
  .caro{ display:flex; gap:12px; padding:4px 2px 10px; }
  .chip{ text-align:center; font-size:9.5px; color:var(--gray); }
  .chip .cir{ width:48px; height:48px; border-radius:50%; background:var(--navy); color:var(--light); display:flex; align-items:center; justify-content:center; font-weight:800; font-size:17px; margin:0 auto 3px; border:2.5px solid transparent; }
  .chip.active .cir{ border-color:var(--red); }
  .chip.new .cir{ border-color:var(--gold); animation:pop .6s; }
  @keyframes pop{ 0%{transform:scale(.4)} 70%{transform:scale(1.15)} 100%{transform:scale(1)} }
  .like{ color:var(--gray); cursor:pointer; user-select:none; }
  .like.on{ color:var(--red); font-weight:700; }
  /* chat */
  .bub{ max-width:78%; border-radius:14px; padding:9px 12px; font-size:12.5px; line-height:1.4; margin-bottom:8px; opacity:0; transform:translateY(6px); transition:all .35s; }
  .bub.show{ opacity:1; transform:none; }
  .bub.them{ background:#fff; color:var(--navy); }
  .bub.me{ background:var(--red); color:var(--light); margin-left:auto; }
  .chatrow{ display:flex; gap:8px; align-items:flex-end; }
  .chatrow img{ width:26px; height:26px; border-radius:50%; flex:none; }
  /* map */
  .mapwrap{ position:relative; flex:1; }
  .pin{ position:absolute; cursor:pointer; transform:translate(-50%,-100%); }
  .pin .drop{ width:26px; height:26px; background:var(--red); border-radius:50% 50% 50% 0; transform:rotate(-45deg); display:flex; align-items:center; justify-content:center; box-shadow:0 3px 8px rgba(0,0,0,.25); animation:pulse 2s infinite; }
  .pin .drop::after{ content:''; width:10px; height:10px; background:#fff; border-radius:50%; transform:rotate(45deg); }
  @keyframes pulse{ 0%,100%{transform:rotate(-45deg) scale(1)} 50%{transform:rotate(-45deg) scale(1.12)} }
  .pincard{ position:absolute; left:50%; transform:translateX(-50%); bottom:14px; width:88%; background:#fff; border-radius:12px; padding:12px; box-shadow:0 8px 24px rgba(0,0,0,.18); display:none; }
  .pincard.show{ display:block; }
  .toast{ position:absolute; left:10px; right:10px; top:52px; background:var(--navy); color:var(--light); border-radius:12px; padding:12px 14px; font-size:12px; opacity:0; transform:translateY(-10px); transition:all .4s; z-index:40; }
  .toast.show{ opacity:1; transform:none; }
  .toast b{ color:#FFD37E; }
  .prog{ height:7px; background:#E4E4EC; border-radius:4px; overflow:hidden; margin-top:8px; }
  .prog>div{ height:100%; background:var(--green); width:0; transition:width 1s ease; }
  .badgechip{ display:inline-flex; align-items:center; gap:7px; background:var(--navy); color:var(--light); border-radius:16px; padding:6px 12px 6px 7px; font-size:11px; font-weight:700; margin:0 6px 6px 0; }
  .badgechip .med{ width:18px; height:18px; border-radius:50%; background:var(--gold); }
  .toggle{ width:40px; height:22px; border-radius:12px; background:#CDCDD4; position:relative; cursor:pointer; flex:none; transition:background .2s; }
  .toggle.on{ background:var(--red); }
  .toggle::after{ content:''; position:absolute; top:2px; left:2px; width:18px; height:18px; border-radius:50%; background:#fff; transition:left .2s; }
  .toggle.on::after{ left:20px; }
  .prow{ display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid #EEEEF2; font-size:12.5px; color:var(--navy); }
  .prow:last-child{ border-bottom:none; }
  .impact-n{ color:var(--red); font-weight:800; }
  @media (max-width:740px){ .stage-wrap{gap:20px} .panel{order:2} }
</style>
</head>
<body>
<header>
  <img class="as-badge" alt="Hero One Eleven badge">
  <div><div class="wm">HERO ONE ELEVEN</div><div class="by">INTERACTIVE PRODUCT DEMO · by HeroBridge</div></div>
</header>

<div class="stage-wrap">
  <div class="phone"><div class="screen"><div class="notch"></div>

    <!-- V0: intro -->
    <div class="view on" id="v0">
      <div class="vcenter">
        <img class="badge as-badge" alt="">
        <div class="t1">HERO ONE ELEVEN</div>
        <div class="t2">A community that meets you where you are.</div>
        <img class="as-mascot" alt="Hero mascot" style="width:150px; margin-top:8px;">
      </div>
    </div>

    <!-- V1: code entry -->
    <div class="view" id="v1">
      <div class="vcenter">
        <img class="badge as-badge" alt="" style="width:84px;height:84px;">
        <div class="t1" style="font-size:14px;">ENTER YOUR COMMUNITY CODE</div>
        <div class="t2">Your mentor or program gave you a code.<br>It sets up everything for you.</div>
        <div class="codebox"><span id="typed"></span><span class="cursor" id="cur"></span></div>
        <div class="preview" id="preview">&#10003; Joining Hero One Eleven — Spring Cohort</div>
        <button class="btn" onclick="go(2)">Build my community</button>
      </div>
    </div>

    <!-- V2: arrival package -->
    <div class="view" id="v2">
      <div class="appbar"><img class="as-badge" alt="">Building your community…</div>
      <div class="body" id="arrival">
        <div class="chk"><div class="ic">&#10003;</div><div class="lbl">Joined Welcome Circle + Spring Pod</div></div>
        <div class="chk"><div class="ic">&#10003;</div><div class="lbl">Mentor matched: Manny (least-loaded)</div></div>
        <div class="chk"><div class="ic">&#10003;</div><div class="lbl">Orientation Track started</div></div>
        <div class="chk"><div class="ic">&#10003;</div><div class="lbl">2 starter goals added</div></div>
        <div class="chk"><div class="ic">&#10003;</div><div class="lbl">Welcome message waiting from Manny</div></div>
        <div style="text-align:center; margin-top:14px;">
          <img class="as-mascot" style="width:110px;" alt="">
        </div>
      </div>
    </div>

    <!-- V3: curated feed -->
    <div class="view" id="v3">
      <div class="appbar"><img class="as-badge" alt="">Hero One Eleven</div>
      <div class="body">
        <div class="caro" id="caro3">
          <div class="chip active"><div class="cir">W</div>Welcome</div>
          <div class="chip"><div class="cir">P</div>Spring Pod</div>
        </div>
        <div class="card"><div class="kicker">ANNOUNCEMENTS</div><div class="who">Ada Admin</div>
          <div class="txt">Town hall Friday 6pm — childcare provided. Bring your questions!</div>
          <div class="meta"><span class="like" onclick="this.classList.toggle('on')">&#9829; 24</span> &nbsp;·&nbsp; 6 comments</div></div>
        <div class="card"><div class="kicker">WELCOME CIRCLE</div><div class="who">Manny Mentor</div>
          <div class="txt">Three members hit their orientation milestone this week. Proud of this group!</div>
          <div class="meta"><span class="like" onclick="this.classList.toggle('on')">&#9829; 18</span> &nbsp;·&nbsp; 4 comments</div></div>
      </div>
    </div>

    <!-- V4: mentorship chat -->
    <div class="view" id="v4">
      <div class="appbar"><img class="as-head" style="border-radius:50%;width:26px;height:26px;" alt="">Manny Mentor</div>
      <div class="body" id="chat">
        <div class="chatrow"><img class="as-head" alt=""><div class="bub them">Welcome, Maria! I'm Manny, your mentor. Excited to walk with you.</div></div>
        <div class="chatrow"><img class="as-head" alt=""><div class="bub them">I set two starter goals — check your profile when you can.</div></div>
        <div class="bub me">Thank you!! Starting the orientation video now.</div>
      </div>
    </div>

    <!-- V5: resources + cascade -->
    <div class="view" id="v5">
      <div class="appbar"><img class="as-badge" alt="">Resources</div>
      <div class="body">
        <div class="toast" id="toast5"><b>&#9733; Milestone complete!</b> Badge earned: First Steps. New group unlocked: Career Pathfinders.</div>
        <div class="caro" id="caro5">
          <div class="chip active"><div class="cir">W</div>Welcome</div>
          <div class="chip"><div class="cir">P</div>Spring Pod</div>
        </div>
        <div class="card"><div class="kicker">FEATURED · VIDEO · 12 MIN</div>
          <div class="who">Orientation Video</div>
          <div class="txt">Start here — your first milestone on the Orientation Track.</div>
          <div class="prog"><div id="prog5"></div></div>
          <button class="btn" id="completeBtn" style="margin-top:10px;" onclick="cascade()">Mark complete</button></div>
        <div class="card"><div class="kicker">COURSE · 4 LESSONS</div><div class="who">Resume Builder Workshop</div>
          <div class="txt">Unlocks with your Career Pathfinders membership.</div></div>
      </div>
    </div>

    <!-- V6: GIS map -->
    <div class="view" id="v6">
      <div class="appbar"><img class="as-badge" alt="">Resource Map</div>
      <div class="mapwrap" id="map">
        <svg viewBox="0 0 300 520" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" style="position:absolute;inset:0;">
          <rect width="300" height="520" fill="#E4E9E4"/>
          <ellipse cx="60" cy="90" rx="55" ry="45" fill="#CEDCCE"/>
          <path d="M0 160 L300 120" stroke="#fff" stroke-width="10"/>
          <path d="M0 320 L300 290" stroke="#fff" stroke-width="8"/>
          <path d="M90 0 L120 520" stroke="#fff" stroke-width="9"/>
          <path d="M225 0 L205 520" stroke="#fff" stroke-width="7"/>
          <path d="M0 440 L300 470" stroke="#fff" stroke-width="6"/>
        </svg>
        <div class="pin" style="left:40%; top:26%;" onclick="pin('Downtown Resource Center','Walk-in support · Mon–Fri · 0.4 mi')"><div class="drop"></div></div>
        <div class="pin" style="left:70%; top:52%;" onclick="pin('Community Food Bank','Open Sat mornings · 1.1 mi')"><div class="drop"></div></div>
        <div class="pin" style="left:28%; top:70%;" onclick="pin('Childcare Co-op','Member families · 1.6 mi')"><div class="drop"></div></div>
        <div class="pincard" id="pincard">
          <div class="kicker">ENTITLED RESOURCE</div>
          <div class="who" id="pinT">Tap a pin</div>
          <div class="txt" id="pinD"></div>
          <button class="btn" style="margin-top:8px;" onclick="event.stopPropagation()">Get directions</button>
        </div>
      </div>
    </div>

    <!-- V7: profile & impact -->
    <div class="view" id="v7">
      <div class="appbar"><img class="as-badge" alt="">Profile</div>
      <div class="body">
        <div class="who" style="font-size:17px;">Maria</div>
        <div class="meta" style="margin:0 0 10px;">Member · joined with SPRING-2026</div>
        <div><span class="badgechip"><span class="med"></span>First Steps</span></div>
        <div class="card" style="margin-top:10px;">
          <div class="kicker">MY IMPACT TRANSCRIPT</div>
          <div class="meta" style="margin:2px 0 6px;">Your record, visible to you. Nothing is collected that you can't see.</div>
          <div class="prow">Resources viewed <span class="impact-n" data-n="12">0</span></div>
          <div class="prow">Milestones completed <span class="impact-n" data-n="1">0</span></div>
          <div class="prow">Posts &amp; comments <span class="impact-n" data-n="7">0</span></div>
          <div class="prow">Mentor check-ins <span class="impact-n" data-n="3">0</span></div>
        </div>
        <div class="card">
          <div class="kicker">PRIVACY — WHAT WE COLLECT &amp; WHY</div>
          <div class="prow">Engagement events <span class="toggle on" onclick="this.classList.toggle('on')"></span></div>
          <div class="prow">Session notes <span class="toggle on" onclick="this.classList.toggle('on')"></span></div>
          <div class="prow">Goal progress <span class="toggle" onclick="this.classList.toggle('on')"></span></div>
        </div>
      </div>
    </div>

  </div></div>

  <div class="panel">
    <div class="step" id="pStep"></div>
    <h2 id="pTitle"></h2>
    <p id="pBody"></p>
    <div class="hood" id="pHood"></div>
    <div class="controls">
      <button class="nav" id="back" onclick="go(cur-1)">Back</button>
      <button class="nav primary" id="next" onclick="go(cur+1)">Next</button>
      <div class="dots" id="dots"></div>
    </div>
  </div>
</div>

<script>
const ASSETS = { badge:'data:image/png;base64,__BADGE__', mascot:'data:image/png;base64,__MASCOT__', head:'data:image/png;base64,__HEAD__' };
document.querySelectorAll('.as-badge').forEach(i=>i.src=ASSETS.badge);
document.querySelectorAll('.as-mascot').forEach(i=>i.src=ASSETS.mascot);
document.querySelectorAll('.as-head').forEach(i=>i.src=ASSETS.head);
const STEPS = [
 { t:"Meet Hero One Eleven", b:"This is a walkthrough of the member experience: how one referral code builds a fully curated community around each person — relationships, resources, mentorship, and a private record of growth.", h:"Everything you'll see is driven by one mechanism: entitlements. A member sees exactly what they've been granted — nothing else." },
 { t:"One code is the whole onboarding", b:"Maria's mentor gave her a code. As she types, the app previews which community she's joining — without revealing anything about what's inside it. She can even join pseudonymously: username, password, code. No email required.", h:"Under the hood: GET /codes/preview returns only validity + label, so secret groups can never be probed. Identity stays minimal by design." },
 { t:"The arrival package", b:"Redeeming the code builds Maria's entire environment in one transaction: her groups, her mentor (picked least-loaded from a pool), her learning track, starter goals, and a welcome message already waiting.", h:"Under the hood: POST /codes/redeem applies the grant bundle, auto-joins groups, matches the mentor, and returns a fresh org-scoped token." },
 { t:"A feed that's only hers", b:"The curated feed merges community announcements with posts from Maria's entitled groups — and nothing else. The carousel across the top is her groups; tapping one filters the feed. Try tapping a heart.", h:"Under the hood: every read is filtered through the entitlement engine. Public, private, and secret visibility are enforced in the query, not the UI." },
 { t:"Relationships, not just accounts", b:"Maria's mentor match came with the code. The welcome DM was waiting on arrival. From here: support requests route to the right responder, sessions get logged with a mentee-visible summary, and check-ins track how she's doing.", h:"Under the hood: mentors see their working notes; mentees see only the shared summary. Every interaction lands in the journey transcript." },
 { t:"Resources that graduate you", b:"The library is entitlement-scoped and searchable. Here's the signature move: press 'Mark complete' on the orientation video and watch what happens.", h:"Under the hood: resource completion cascades into any linked milestone → auto-graduation grants fire → a badge is awarded and a new group appears. One event, whole system responds." },
 { t:"The GIS resource map", b:"The map shows only the resources Maria is entitled to — the food bank, childcare, and resource center relevant to her program. Tap a pin. Nobody sees pins from programs that aren't theirs.", h:"Under the hood: PostGIS radius queries inside the entitlement set. ?on_map=true&lat&lng&radius_m returns nearest-first, permission-filtered pins." },
 { t:"Her record, visible to her", b:"The profile holds badges, goals, track progress — and the Impact Transcript: everything the community tracks about Maria's journey, visible to Maria. Consent toggles control what's collected. This is the anti-surveillance promise made tangible.", h:"Under the hood: the same transcript powers mentor briefings, program analytics, and verified impact reporting — with consent gates at every layer." },
];
let cur = 0;
const N = STEPS.length;
const dots = document.getElementById('dots');
for(let i=0;i<N;i++){ const d=document.createElement('div'); d.className='dot'; dots.appendChild(d); }

function go(n){
  if(n<0||n>=N) return;
  cur = n;
  document.querySelectorAll('.view').forEach((v,i)=>v.classList.toggle('on', i===n));
  document.querySelectorAll('.dot').forEach((d,i)=>d.classList.toggle('on', i===n));
  const s = STEPS[n];
  document.getElementById('pStep').textContent = 'STEP ' + (n+1) + ' OF ' + N;
  document.getElementById('pTitle').textContent = s.t;
  document.getElementById('pBody').textContent = s.b;
  document.getElementById('pHood').textContent = s.h;
  document.getElementById('back').disabled = n===0;
  document.getElementById('next').disabled = n===N-1;
  enter(n);
}
function enter(n){
  if(n===1){ typeCode(); }
  if(n===2){ const rows=document.querySelectorAll('#arrival .chk'); rows.forEach(r=>r.classList.remove('show')); rows.forEach((r,i)=>setTimeout(()=>r.classList.add('show'), 300+i*420)); }
  if(n===4){ const bs=document.querySelectorAll('#chat .bub'); bs.forEach(b=>b.classList.remove('show')); bs.forEach((b,i)=>setTimeout(()=>b.classList.add('show'), 300+i*650)); }
  if(n===7){ document.querySelectorAll('.impact-n').forEach(el=>{ const target=+el.dataset.n; let v=0; el.textContent=0; const iv=setInterval(()=>{ v++; el.textContent=v; if(v>=target) clearInterval(iv); }, 90); }); }
}
let typed=false;
function typeCode(){
  if(typed) return; typed=true;
  const code='SPRING-2026'; const el=document.getElementById('typed');
  let i=0; const iv=setInterval(()=>{ el.textContent=code.slice(0,++i);
    if(i>=code.length){ clearInterval(iv); document.getElementById('cur').style.display='none';
      setTimeout(()=>document.getElementById('preview').classList.add('show'), 350); } }, 110);
}
let cascaded=false;
function cascade(){
  if(cascaded) return; cascaded=true;
  document.getElementById('prog5').style.width='100%';
  const btn=document.getElementById('completeBtn');
  setTimeout(()=>{ btn.textContent='Completed \u2713'; btn.style.background='var(--green)'; }, 900);
  setTimeout(()=>{ document.getElementById('toast5').classList.add('show'); }, 1200);
  setTimeout(()=>{
    const chip=document.createElement('div'); chip.className='chip new';
    chip.innerHTML='<div class="cir">C</div>Career';
    document.getElementById('caro5').appendChild(chip);
    const c2=chip.cloneNode(true); document.getElementById('caro3').appendChild(c2);
  }, 1600);
  setTimeout(()=>{ document.getElementById('toast5').classList.remove('show'); }, 5200);
}
function pin(t, d){
  document.getElementById('pinT').textContent=t;
  document.getElementById('pinD').textContent=d;
  document.getElementById('pincard').classList.add('show');
}
document.getElementById('map').addEventListener('click', e=>{
  if(!e.target.closest('.pin') && !e.target.closest('.pincard'))
    document.getElementById('pincard').classList.remove('show');
});
document.addEventListener('keydown', e=>{
  if(e.key==='ArrowRight') go(cur+1);
  if(e.key==='ArrowLeft') go(cur-1);
});
go(0);
</script>
</body>
</html>
"""

out = HTML.replace('__BADGE__', BADGE).replace('__MASCOT__', MASCOT).replace('__HEAD__', HEAD)
open('demo/hero-one-eleven-demo.html', 'w').write(out)
import os
print('demo written:', os.path.getsize('demo/hero-one-eleven-demo.html')//1024, 'KB')
