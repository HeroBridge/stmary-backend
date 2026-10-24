#!/usr/bin/env python3
import sys; sys.path.insert(0,'/tmp')
from tl_assets import EMBLEM

HTML = r"""<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Tolle Lege — Interactive Demo</title>
<style>
 :root{--navy:#1B2A5E;--burg:#8C1D2C;--parch:#FBF7EC;--gold:#B78A3A;--green:#2F8A4F;--gray:#767482;--soft:#969EBE;}
 *{box-sizing:border-box;margin:0;}
 body{font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:var(--navy);color:var(--parch);min-height:100vh;display:flex;flex-direction:column;align-items:center;padding:24px 16px 40px;}
 header{display:flex;align-items:center;gap:14px;margin-bottom:18px;}
 header img{width:48px;}
 header .wm{font-family:Georgia,serif;font-size:22px;letter-spacing:.1em;}
 header .by{font-size:11px;color:var(--soft);letter-spacing:.08em;}
 .wrap{display:flex;gap:32px;align-items:center;flex-wrap:wrap;justify-content:center;max-width:960px;}
 .phone{width:320px;height:660px;background:#16161C;border-radius:44px;padding:10px;box-shadow:0 24px 60px rgba(0,0,0,.5);flex:none;}
 .screen{position:relative;width:100%;height:100%;background:var(--parch);border-radius:36px;overflow:hidden;}
 .notch{position:absolute;top:8px;left:50%;transform:translateX(-50%);width:110px;height:22px;background:#16161C;border-radius:12px;z-index:50;}
 .view{position:absolute;inset:0;opacity:0;pointer-events:none;transition:opacity .35s;display:flex;flex-direction:column;}
 .view.on{opacity:1;pointer-events:auto;}
 .appbar{background:var(--navy);color:var(--parch);padding:40px 16px 12px;display:flex;align-items:center;gap:10px;font-weight:700;font-size:15px;}
 .appbar img{width:26px;}
 .body{flex:1;overflow:hidden;padding:12px;position:relative;}
 .card{background:#fff;border-radius:12px;padding:12px;margin-bottom:10px;}
 .kick{color:var(--burg);font-size:10px;font-weight:800;letter-spacing:.06em;}
 .who{color:var(--navy);font-weight:700;font-size:13px;margin:2px 0;}
 .txt{color:#3c3c46;font-size:12.5px;line-height:1.45;}
 .meta{color:var(--gray);font-size:11px;margin-top:8px;}
 .btn{background:var(--burg);color:var(--parch);border:none;border-radius:10px;padding:12px;font-weight:800;font-size:14px;width:100%;cursor:pointer;}
 .vc{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:18px;background:var(--navy);}
 .vc img.em{width:88px;margin-bottom:10px;}
 .t1{font-family:Georgia,serif;font-size:20px;letter-spacing:.12em;color:var(--parch);}
 .t2{color:var(--soft);font-size:11.5px;margin:5px 0 16px;text-align:center;}
 .door{width:100%;background:#243466;border-radius:10px;padding:10px 12px;margin-bottom:7px;cursor:pointer;border:2px solid transparent;transition:all .25s;}
 .door:hover{border-color:var(--soft);}
 .door.sel{background:var(--burg);border-color:var(--gold);}
 .door .dn{font-weight:800;font-size:13px;color:var(--parch);}
 .door .ds{font-size:10.5px;color:var(--soft);}
 .door.sel .ds{color:#E4D9DE;}
 .codebox{background:#fff;border-radius:8px;padding:10px;width:100%;text-align:center;font-weight:800;letter-spacing:.18em;color:var(--navy);font-size:13px;min-height:38px;margin:10px 0 8px;}
 .chk{display:flex;align-items:center;gap:9px;background:#fff;border-radius:10px;padding:10px;margin-bottom:7px;opacity:0;transform:translateY(8px);transition:all .4s;}
 .chk.show{opacity:1;transform:none;}
 .chk .ic{width:21px;height:21px;border-radius:50%;background:var(--green);color:#fff;font-size:12px;display:flex;align-items:center;justify-content:center;flex:none;}
 .chk .lbl{color:var(--navy);font-size:12px;font-weight:600;}
 .caro{display:flex;gap:12px;padding:4px 2px 10px;}
 .chip{text-align:center;font-size:9.5px;color:var(--gray);}
 .chip .cir{width:46px;height:46px;border-radius:50%;background:var(--navy);display:flex;align-items:center;justify-content:center;margin:0 auto 3px;border:2.5px solid transparent;}
 .chip .cir img{width:30px;}
 .chip.active .cir{border-color:var(--burg);}
 .chip.new .cir{border-color:var(--gold);animation:pop .6s;}
 @keyframes pop{0%{transform:scale(.4)}70%{transform:scale(1.15)}100%{transform:scale(1)}}
 .bub{max-width:80%;border-radius:14px;padding:9px 12px;font-size:12.5px;line-height:1.45;margin-bottom:8px;opacity:0;transform:translateY(6px);transition:all .35s;}
 .bub.show{opacity:1;transform:none;}
 .bub.them{background:#fff;color:var(--navy);}
 .bub.me{background:var(--burg);color:var(--parch);margin-left:auto;}
 .row{display:flex;gap:8px;align-items:flex-end;}
 .row img{width:26px;height:26px;border-radius:50%;background:var(--navy);padding:3px;flex:none;}
 .prog{height:7px;background:#E4E0D4;border-radius:4px;overflow:hidden;margin-top:8px;}
 .prog>div{height:100%;background:var(--green);width:0;transition:width 1.1s ease;}
 .mapw{position:relative;flex:1;}
 .pin{position:absolute;transform:translate(-50%,-100%);cursor:pointer;}
 .drop{width:24px;height:24px;background:var(--burg);border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;}
 .drop::after{content:'';width:9px;height:9px;background:#fff;border-radius:50%;transform:rotate(45deg);}
 .pin.locked{opacity:0;transform:translate(-50%,-100%) scale(.4);transition:all .7s;}
 .pin.locked.show{opacity:1;transform:translate(-50%,-100%) scale(1);}
 .pin.locked .drop{background:var(--gold);}
 .pincard{position:absolute;left:50%;transform:translateX(-50%);bottom:12px;width:88%;background:#fff;border-radius:12px;padding:11px;box-shadow:0 8px 24px rgba(0,0,0,.2);display:none;}
 .pincard.show{display:block;}
 .toast{position:absolute;left:10px;right:10px;top:50px;background:var(--navy);color:var(--parch);border-radius:12px;padding:11px 13px;font-size:11.5px;opacity:0;transform:translateY(-10px);transition:all .4s;z-index:40;line-height:1.4;}
 .toast.show{opacity:1;transform:none;}
 .toast b{color:var(--gold);}
 .stage{display:flex;gap:10px;align-items:flex-start;margin-bottom:9px;}
 .stage .dot{width:20px;height:20px;border-radius:50%;flex:none;display:flex;align-items:center;justify-content:center;font-size:11px;color:#fff;}
 .stage .sn{font-size:12.5px;font-weight:700;color:var(--navy);}
 .stage .ss{font-size:10.5px;}
 .bdg{display:inline-flex;align-items:center;gap:6px;background:var(--navy);color:var(--parch);border-radius:14px;padding:5px 11px 5px 6px;font-size:10.5px;font-weight:700;margin:0 5px 5px 0;}
 .bdg .m{width:15px;height:15px;border-radius:50%;}
 .quote{font-family:Georgia,serif;font-size:11.5px;color:var(--navy);line-height:1.6;background:#F0EADA;border-radius:10px;padding:11px;}
 .panel{max-width:380px;min-width:300px;flex:1;}
 .panel .st{color:var(--gold);font-weight:800;font-size:12px;letter-spacing:.1em;}
 .panel h2{font-family:Georgia,serif;font-size:26px;margin:8px 0 12px;font-weight:400;}
 .panel p{color:#C9CADF;font-size:15px;line-height:1.65;margin-bottom:12px;}
 .hood{background:rgba(255,255,255,.06);border-left:3px solid var(--gold);padding:10px 14px;font-size:13px;color:#B9BAD4;border-radius:0 8px 8px 0;}
 .ctrl{display:flex;align-items:center;gap:16px;margin-top:22px;}
 .nav{background:transparent;color:var(--parch);border:1.5px solid rgba(255,255,255,.35);border-radius:10px;padding:10px 20px;font-weight:700;cursor:pointer;font-size:14px;}
 .nav.p{background:var(--burg);border-color:var(--burg);}
 .nav:disabled{opacity:.3;cursor:default;}
 .dots{display:flex;gap:7px;}
 .dt{width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,.25);}
 .dt.on{background:var(--gold);}
 @media(max-width:740px){.panel{order:2}}
</style></head><body>
<header><img class="as-em" alt="Tolle Lege emblem">
 <div><div class="wm">TOLLE LEGE</div><div class="by">AUGUSTINIAN FORMATION · INTERACTIVE DEMO</div></div></header>
<div class="wrap">
 <div class="phone"><div class="screen"><div class="notch"></div>

  <div class="view on" id="v0"><div class="vc">
   <img class="em as-em" alt="">
   <div class="t1">TOLLE LEGE</div>
   <div class="t2">Read. Reflect. Connect. Go. Serve.</div>
   <div class="quote" style="margin-top:14px;background:rgba(255,255,255,.07);color:var(--parch);">"You have made us for Yourself, O Lord, and our heart is restless until it rests in You."</div>
  </div></div>

  <div class="view" id="v1"><div class="vc">
   <img class="em as-em" alt="" style="width:56px;">
   <div class="t1" style="font-size:14px;">WHERE ARE YOU ON THE JOURNEY?</div>
   <div class="t2">Four doors. One community.</div>
   <div class="door" onclick="pick(this,'SEEKER')"><div class="dn">Seeker</div><div class="ds">Exploring faith and big questions</div></div>
   <div class="door" onclick="pick(this,'NEWCATHOLIC')"><div class="dn">New Catholic</div><div class="ds">Building foundations</div></div>
   <div class="door sel" onclick="pick(this,'RETURNING')"><div class="dn">Returning Catholic</div><div class="ds">Coming home</div></div>
   <div class="door" onclick="pick(this,'DISCERNING')"><div class="dn">Discerning</div><div class="ds">Curious about religious life</div></div>
   <div class="codebox" id="code">RETURNING</div>
   <button class="btn" onclick="go(2)">Take up and read</button>
  </div></div>

  <div class="view" id="v2">
   <div class="appbar"><img class="as-em" alt="">Preparing your place…</div>
   <div class="body" id="arr">
    <div class="chk"><div class="ic">&#10003;</div><div class="lbl" id="a1">Joined Returning Catholics</div></div>
    <div class="chk"><div class="ic">&#10003;</div><div class="lbl">Joined the Tolle Lege reading cohort</div></div>
    <div class="chk"><div class="ic">&#10003;</div><div class="lbl">Guide matched: Br. Thomas OSA</div></div>
    <div class="chk"><div class="ic">&#10003;</div><div class="lbl">Formation track begun</div></div>
    <div class="chk"><div class="ic">&#10003;</div><div class="lbl">A message is waiting for you</div></div>
    <div style="text-align:center;margin-top:12px;"><img class="as-em" style="width:70px;opacity:.5;" alt=""></div>
   </div></div>

  <div class="view" id="v3">
   <div class="appbar"><img class="as-em" alt="">Br. Thomas OSA</div>
   <div class="body" id="chat">
    <div class="row"><img class="as-em" alt=""><div class="bub them">Welcome, Emma. However long you have been away, there is a place set for you here.</div></div>
    <div class="row"><img class="as-em" alt=""><div class="bub them">Take up and read — start with Confessions, Book VIII. Then tell me what you notice.</div></div>
    <div class="bub me">Thank you. I wasn't sure I'd be welcome.</div>
    <div class="row"><img class="as-em" alt=""><div class="bub them">You are. That's the whole point. I'll be here.</div></div>
   </div></div>

  <div class="view" id="v4">
   <div class="appbar"><img class="as-em" alt="">Tolle Lege</div>
   <div class="body">
    <div class="toast" id="t4"><b>&#9733; Tolle Lege</b> — the reading is complete. The Restless Pilgrim cohort is now open to you.</div>
    <div class="caro" id="caro">
     <div class="chip active"><div class="cir"><img class="as-em" alt=""></div>Returning</div>
     <div class="chip"><div class="cir"><img class="as-em" alt=""></div>Reading</div>
    </div>
    <div class="card"><div class="kick">TOLLE LEGE READING COHORT</div><div class="who">Sr. Monica OSA</div>
     <div class="txt">This week: the garden scene. Augustine hears a child's voice — "tolle lege" — and everything turns. What turned for you?</div>
     <div class="meta">&#9829; 31 &nbsp;·&nbsp; 14 reflections</div></div>
    <div class="card"><div class="kick">CONFESSIONS, BOOK VIII &nbsp;·&nbsp; 40 MIN</div>
     <div class="who">"Take up and read"</div>
     <div class="prog"><div id="p4"></div></div>
     <button class="btn" id="rb" style="margin-top:10px;" onclick="finishReading()">I have read it</button></div>
   </div></div>

  <div class="view" id="v5">
   <div class="appbar"><img class="as-em" alt="">Pilgrim Map</div>
   <div class="mapw" id="map">
    <svg viewBox="0 0 300 520" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" style="position:absolute;inset:0;">
     <rect width="300" height="520" fill="#E4E2D6"/>
     <ellipse cx="55" cy="95" rx="52" ry="44" fill="#D4D8C8"/>
     <path d="M0 150 L300 115" stroke="#FBF7EC" stroke-width="11"/>
     <path d="M0 330 L300 300" stroke="#FBF7EC" stroke-width="8"/>
     <path d="M95 0 L125 520" stroke="#FBF7EC" stroke-width="9"/>
     <path d="M220 0 L200 520" stroke="#FBF7EC" stroke-width="7"/>
    </svg>
    <div class="pin" style="left:40%;top:26%" onclick="pin('St. Augustine Priory','Daily Mass · Lectio Tuesdays · open to all','Public — everyone sees this')"><div class="drop"></div></div>
    <div class="pin" style="left:70%;top:52%" onclick="pin('Villanova Retreat House','Silent weekends · spiritual direction','Granted by your code')"><div class="drop"></div></div>
    <div class="pin locked" id="chapel" style="left:28%;top:74%" onclick="pin('Chapel of the Restless Heart','Pilgrimage terminus · Adoration','Unlocked by completing the reading')"><div class="drop"></div></div>
    <div class="pincard" id="pc">
     <div class="kick" id="pk">TAP A PIN</div>
     <div class="who" id="pt">Three kinds of place</div>
     <div class="txt" id="pd">Public, granted, and earned.</div>
    </div>
   </div></div>

  <div class="view" id="v6">
   <div class="appbar"><img class="as-em" alt="">Your Journey</div>
   <div class="body">
    <div class="who" style="font-size:16px;">Emma</div>
    <div class="meta" style="margin:0 0 8px;">Returning Catholic · joined quietly</div>
    <div><span class="bdg"><span class="m" style="background:var(--gold)"></span>Tolle Lege</span><span class="bdg"><span class="m" style="background:var(--burg)"></span>Restless Pilgrim</span></div>
    <div class="card" style="margin-top:8px;">
     <div class="kick">A JOURNEY OF GROWTH</div>
     <div style="margin-top:8px;">
      <div class="stage"><div class="dot" style="background:var(--green)">&#10003;</div><div><div class="sn">Digital invitation</div><div class="ss" style="color:var(--green)">complete</div></div></div>
      <div class="stage"><div class="dot" style="background:var(--green)">&#10003;</div><div><div class="sn">Guided reading cohort</div><div class="ss" style="color:var(--green)">complete</div></div></div>
      <div class="stage"><div class="dot" style="background:var(--gold)">&#8594;</div><div><div class="sn">Augustinian pilgrimage</div><div class="ss" style="color:var(--gold)">in progress</div></div></div>
      <div class="stage"><div class="dot" style="background:#CDC8BC"></div><div><div class="sn" style="color:var(--gray)">Discernment &amp; discipleship</div><div class="ss" style="color:var(--gray)">opens next</div></div></div>
     </div></div>
    <div class="card">
     <div class="kick">WHAT WE ASK, AND WHY</div>
     <div class="meta" style="margin:3px 0 6px;">Your record, visible to you. Nothing is kept that you cannot see.</div>
     <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--navy);padding:4px 0;">Readings completed <b style="color:var(--burg)">2</b></div>
     <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--navy);padding:4px 0;">Reflections shared <b style="color:var(--burg)">9</b></div>
     <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--navy);padding:4px 0;">Conversations with your guide <b style="color:var(--burg)">6</b></div>
    </div>
    <div class="quote">"You have made us for Yourself, O Lord, and our heart is restless until it rests in You."</div>
   </div></div>

 </div></div>

 <div class="panel">
  <div class="st" id="ps"></div><h2 id="pT"></h2><p id="pB"></p><div class="hood" id="pH"></div>
  <div class="ctrl">
   <button class="nav" id="b" onclick="go(cur-1)">Back</button>
   <button class="nav p" id="n" onclick="go(cur+1)">Next</button>
   <div class="dots" id="dd"></div>
  </div>
 </div>
</div>
<script>
const ASSET='data:image/png;base64,__EM__';
document.querySelectorAll('.as-em').forEach(i=>i.src=ASSET);
const S=[
 {t:"A community that meets the restless",b:"Tolle Lege is an Augustinian formation community — for seekers, new Catholics, those coming home, and those quietly wondering about religious life. This is a walkthrough of what a person actually experiences.",h:"Built on the Hero One Eleven community platform. Everything you'll see runs on tested infrastructure — nothing here is a mockup of vapor."},
 {t:"Four doors, one community",b:"Each faith journey has its own invitation code. A seeker and a returning Catholic download the same app, enter different codes, and arrive in genuinely different homes. Try selecting a different door.",h:"Under the hood: a referral code carries a bundle of grants — cohort groups, readings, an Augustinian guide, a welcome written in that journey's voice."},
 {t:"A place already prepared",b:"Redeeming the code builds Emma's whole formation environment at once: her cohorts, her guide matched from the friars and sisters, her reading track, and a message already waiting. She can join with no email at all — a username is enough.",h:"Pseudonymous entry is pastoral, not just technical. Someone not ready to hand a parish their email can still come in. The code carries the context; the person keeps their privacy."},
 {t:"An Augustinian is already there",b:"The welcome is not automated cheer — it's a real message from a real friar, waiting when she arrives. Accompaniment begins before she has done anything to earn it.",h:"Guides are matched least-loaded from the Augustinian pool, so no friar is overwhelmed and no one waits."},
 {t:"Take up and read",b:"The reading cohort is the heart of the thing: shared text, shared reflection, a friar guiding the conversation. Press 'I have read it' and watch what opens.",h:"Under the hood: completing the reading resource completes a milestone, which auto-grants the next stage — the Restless Pilgrim cohort, its resources, and a badge. Nobody hand-promotes anyone."},
 {t:"A map of where you are welcome",b:"Three kinds of place: the priory anyone may enter, the retreat house her code granted, and the pilgrimage chapel that appeared only after she read. Tap the pins.",h:"The map is not a directory. PostGIS filters every pin through the person's entitlements — you cannot browse your way to a place you have not walked toward."},
 {t:"From click to calling",b:"Her journey is visible to her: readings, reflections, conversations, the stages behind and the stage ahead. Discernment opens next — not because someone decided, but because she walked here.",h:"The record that lets a Provincial see whether formation is working is the same record Emma can open herself. Nothing is kept that she cannot see."},
];
let cur=0; const N=S.length;
for(let i=0;i<N;i++){const d=document.createElement('div');d.className='dt';document.getElementById('dd').appendChild(d);}
function go(n){ if(n<0||n>=N)return; cur=n;
 document.querySelectorAll('.view').forEach((v,i)=>v.classList.toggle('on',i===n));
 document.querySelectorAll('.dt').forEach((d,i)=>d.classList.toggle('on',i===n));
 const s=S[n];
 document.getElementById('ps').textContent='STEP '+(n+1)+' OF '+N;
 document.getElementById('pT').textContent=s.t;
 document.getElementById('pB').textContent=s.b;
 document.getElementById('pH').textContent=s.h;
 document.getElementById('b').disabled=n===0;
 document.getElementById('n').disabled=n===N-1;
 if(n===2){const r=document.querySelectorAll('#arr .chk');r.forEach(x=>x.classList.remove('show'));r.forEach((x,i)=>setTimeout(()=>x.classList.add('show'),260+i*400));}
 if(n===3){const b=document.querySelectorAll('#chat .bub');b.forEach(x=>x.classList.remove('show'));b.forEach((x,i)=>setTimeout(()=>x.classList.add('show'),260+i*700));}
}
const DOORS={SEEKER:['Joined Seekers','Seeker'],NEWCATHOLIC:['Joined New Catholics','New Catholic'],
 RETURNING:['Joined Returning Catholics','Returning'],DISCERNING:['Joined Seekers + Restless Pilgrim','Discerning']};
function pick(el,code){
 document.querySelectorAll('.door').forEach(d=>d.classList.remove('sel'));
 el.classList.add('sel');
 document.getElementById('code').textContent=code;
 document.getElementById('a1').textContent=DOORS[code][0];
 document.querySelector('#caro .chip.active').lastChild.textContent=DOORS[code][1];
}
let done=false;
function finishReading(){
 if(done)return; done=true;
 document.getElementById('p4').style.width='100%';
 const b=document.getElementById('rb');
 setTimeout(()=>{b.textContent='Read \u2713';b.style.background='var(--green)';},1000);
 setTimeout(()=>document.getElementById('t4').classList.add('show'),1300);
 setTimeout(()=>{
  const c=document.createElement('div');c.className='chip new';
  c.innerHTML='<div class="cir"><img src="'+ASSET+'"></div>Pilgrim';
  document.getElementById('caro').appendChild(c);
  document.getElementById('chapel').classList.add('show');
 },1700);
 setTimeout(()=>document.getElementById('t4').classList.remove('show'),6000);
}
function pin(t,d,k){
 document.getElementById('pt').textContent=t;
 document.getElementById('pd').textContent=d;
 document.getElementById('pk').textContent=k.toUpperCase();
 document.getElementById('pc').classList.add('show');
}
document.getElementById('map').addEventListener('click',e=>{
 if(!e.target.closest('.pin')&&!e.target.closest('.pincard'))document.getElementById('pc').classList.remove('show');
});
document.addEventListener('keydown',e=>{if(e.key==='ArrowRight')go(cur+1);if(e.key==='ArrowLeft')go(cur-1);});
go(0);
</script></body></html>
"""
open('demo/tolle-lege-demo.html','w').write(HTML.replace('__EM__', EMBLEM))
import os; print('demo:', os.path.getsize('demo/tolle-lege-demo.html')//1024, 'KB')
