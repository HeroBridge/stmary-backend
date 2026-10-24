#!/usr/bin/env python3
import sys; sys.path.insert(0,'/tmp')
from tl_assets import EMBLEM

HTML = r"""<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Mentor Briefing — How It Works</title>
<style>
 :root{--navy:#1B2A5E;--burg:#8C1D2C;--parch:#FBF7EC;--gold:#B78A3A;--green:#2F8A4F;--gray:#6E6C7E;--mute:#9A98A8;}
 *{box-sizing:border-box;margin:0;}
 body{font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:var(--navy);color:var(--parch);min-height:100vh;display:flex;flex-direction:column;align-items:center;padding:24px 16px 50px;}
 header{display:flex;align-items:center;gap:14px;margin-bottom:6px;}
 header img{width:46px;}
 header .wm{font-family:Georgia,serif;font-size:21px;letter-spacing:.08em;}
 header .by{font-size:11px;color:#969EBE;letter-spacing:.06em;}
 .lede{max-width:700px;text-align:center;color:#C9CADF;font-size:15px;line-height:1.6;margin:14px 0 26px;}
 .lede b{color:var(--gold);font-weight:600;}
 .wrap{display:flex;gap:34px;align-items:flex-start;flex-wrap:wrap;justify-content:center;max-width:1000px;}
 .phone{width:330px;background:#16161C;border-radius:44px;padding:10px;box-shadow:0 24px 60px rgba(0,0,0,.5);flex:none;}
 .screen{position:relative;background:var(--parch);border-radius:36px;overflow:hidden;height:680px;display:flex;flex-direction:column;}
 .notch{position:absolute;top:8px;left:50%;transform:translateX(-50%);width:108px;height:22px;background:#16161C;border-radius:12px;z-index:60;}
 .bar{background:var(--navy);color:var(--parch);padding:38px 16px 12px;font-weight:700;font-size:15px;display:flex;align-items:center;gap:8px;}
 .scroll{flex:1;overflow-y:auto;padding:16px;}
 .nm{font-size:26px;font-weight:800;color:var(--navy);}
 .pill{display:inline-block;background:var(--navy);color:var(--parch);border-radius:20px;padding:4px 12px;font-size:10.5px;font-weight:700;letter-spacing:.5px;margin-top:8px;}
 .stagenote{color:var(--gray);font-size:12.5px;font-style:italic;margin-top:9px;line-height:1.5;}
 .lbl{font-size:10px;font-weight:800;color:var(--burg);letter-spacing:1px;margin:20px 0 9px;}
 .facts{background:#fff;border-radius:13px;padding:13px;}
 .fr{display:flex;justify-content:space-between;padding:5px 0;font-size:12px;}
 .fr .k{color:var(--gray);} .fr .v{color:var(--navy);font-weight:700;}
 .fr .v.al{color:var(--burg);}
 .ffoot{color:var(--mute);font-size:10.5px;line-height:1.5;margin-top:9px;padding-top:9px;border-top:1px solid #EFEFF3;}
 .pc{background:#fff;border-radius:15px;padding:16px;margin-bottom:12px;transition:all .4s;}
 .pc.gone{opacity:0;transform:translateX(-40px);height:0;padding:0;margin:0;overflow:hidden;}
 .posture{font-size:17px;line-height:1.45;color:var(--navy);font-weight:600;}
 .bec{display:flex;gap:9px;margin-top:12px;}
 .bec .bar2{width:3px;border-radius:2px;background:var(--burg);flex:none;}
 .bec p{color:var(--gray);font-size:12px;line-height:1.5;}
 .pr{display:flex;align-items:center;gap:7px;margin-top:12px;}
 .pn{color:var(--navy);font-size:10.5px;font-weight:800;letter-spacing:.3px;}
 .tr{color:var(--mute);font-size:10.5px;}
 .acts{display:flex;gap:9px;margin-top:14px;}
 .acts button{flex:1;border-radius:9px;padding:10px;font-weight:700;font-size:12.5px;cursor:pointer;border:1.5px solid transparent;}
 .ghost{background:#fff;border-color:#DCDCE4 !important;color:var(--gray);}
 .solid{background:var(--navy);color:var(--parch);}
 .ghost:hover{border-color:var(--gray) !important;}
 .notebox{margin-top:12px;background:var(--parch);border-radius:10px;padding:11px;}
 .notebox label{color:var(--gray);font-size:11.5px;display:block;margin-bottom:7px;}
 .notebox textarea{width:100%;border:none;border-radius:7px;padding:9px;font-size:12.5px;min-height:58px;resize:none;font-family:inherit;color:var(--navy);}
 .na{display:flex;justify-content:flex-end;align-items:center;gap:14px;margin-top:9px;}
 .na a{color:var(--mute);font-size:12px;cursor:pointer;font-weight:600;}
 .na button{background:var(--burg);color:var(--parch);border:none;border-radius:7px;padding:8px 18px;font-weight:800;font-size:12px;cursor:pointer;}
 .done{margin-top:12px;background:#EAF7EE;border-radius:9px;padding:10px;text-align:center;color:var(--green);font-weight:700;font-size:12px;}
 .empty{background:#fff;border-radius:15px;padding:18px;color:var(--gray);font-size:13.5px;line-height:1.6;text-align:center;}
 .disc{margin-top:12px;background:rgba(0,0,0,.045);border-left:3px solid #C9C7D4;border-radius:0 10px 10px 0;padding:12px;color:var(--gray);font-size:11.5px;font-style:italic;line-height:1.55;}
 .cta{background:var(--burg);color:var(--parch);border:none;border-radius:11px;padding:13px;font-weight:800;font-size:14px;width:100%;margin-top:16px;cursor:pointer;}
 .panel{max-width:400px;min-width:310px;flex:1;}
 .panel h2{font-family:Georgia,serif;font-size:25px;font-weight:400;margin-bottom:12px;}
 .panel p{color:#C9CADF;font-size:14.5px;line-height:1.65;margin-bottom:14px;}
 .rule{border-left:3px solid var(--gold);background:rgba(255,255,255,.06);border-radius:0 8px 8px 0;padding:11px 14px;margin-bottom:10px;}
 .rule b{color:var(--gold);font-size:12.5px;display:block;margin-bottom:3px;}
 .rule span{color:#B9BAD4;font-size:12.5px;line-height:1.5;}
 .try{margin-top:18px;padding:12px 14px;background:rgba(183,138,58,.14);border-radius:10px;color:#E8DCC2;font-size:13px;line-height:1.5;}
 .try b{color:var(--gold);}
 @media(max-width:760px){.panel{order:2}}
</style></head><body>
<header><img src="data:image/png;base64,__EM__" alt="">
 <div><div class="wm">MENTOR BRIEFING</div><div class="by">HOW THE DOCTRINE LAYER SERVES A GUIDE</div></div></header>
<p class="lede">The system knows things about Emma. It tells <b>her guide</b> — never her. And it offers a <b>posture</b>, never a script.</p>

<div class="wrap">
 <div class="phone"><div class="screen"><div class="notch"></div>
  <div class="bar">&#8592;&nbsp; Briefing</div>
  <div class="scroll">
   <div class="nm">Emma</div>
   <div><span class="pill">MID-JOURNEY</span></div>
   <div class="stagenote">The visible record is the least of what is happening.</div>

   <div class="lbl">WHAT WE CAN SEE</div>
   <div class="facts">
    <div class="fr"><span class="k">Active in the last 30 days</span><span class="v">4 times</span></div>
    <div class="fr"><span class="k">People she talks with here</span><span class="v al">Only you</span></div>
    <div class="fr"><span class="k">Readings completed</span><span class="v">2</span></div>
    <div class="fr"><span class="k">Waiting for a reply</span><span class="v al">1 request</span></div>
    <div class="ffoot">This is activity, not interior life. What matters most here is invisible to us.</div>
   </div>

   <div class="lbl" id="plbl">WHAT MIGHT SERVE HER NOW</div>
   <div id="cards">
    <div class="pc" id="c1">
     <div class="posture">Your scarcest resource is attention. Spend it where there is least.</div>
     <div class="bec"><div class="bar2"></div><p>She has an unanswered request for help.</p></div>
     <div class="pr"><span class="pn">PREFERENTIAL OPTION FOR THE POOR</span><span class="tr">· Catholic Social Doctrine</span></div>
     <div class="acts" id="a1">
      <button class="ghost" onclick="dismiss('c1')">Doesn't fit her</button>
      <button class="solid" onclick="use('c1')">I used this</button>
     </div>
     <div class="notebox" id="n1" style="display:none;">
      <label>In your words — what happened? (optional)</label>
      <textarea id="t1" placeholder="I asked what her restlessness was pointing at…"></textarea>
      <div class="na"><a onclick="cancel('c1')">Cancel</a><button onclick="save('c1')">Save</button></div>
     </div>
     <div class="done" id="d1" style="display:none;">&#10003; You noted this</div>
    </div>

    <div class="pc" id="c2">
     <div class="posture">Introduce them to a person, not just a resource.</div>
     <div class="bec"><div class="bar2"></div><p>Completing readings, but few relationships. Content without friendship rarely holds.</p></div>
     <div class="pr"><span class="pn">FRIENDSHIP AS THE ROAD</span><span class="tr">· Confessions</span></div>
     <div class="acts" id="a2">
      <button class="ghost" onclick="dismiss('c2')">Doesn't fit her</button>
      <button class="solid" onclick="use('c2')">I used this</button>
     </div>
     <div class="notebox" id="n2" style="display:none;">
      <label>In your words — what happened? (optional)</label>
      <textarea id="t2" placeholder="Introduced her to the Tuesday cohort…"></textarea>
      <div class="na"><a onclick="cancel('c2')">Cancel</a><button onclick="save('c2')">Save</button></div>
     </div>
     <div class="done" id="d2" style="display:none;">&#10003; You noted this</div>
    </div>
   </div>

   <div class="empty" id="empty" style="display:none;">
    Nothing to suggest. That is not a failure — it usually means she is well.<br><br>Go and be with her.
   </div>

   <div class="disc">Postures to consider, not instructions. You know this person; the system does not. Ignore anything that does not fit.</div>
   <button class="cta">Go talk with her</button>
   <div style="height:14px;"></div>
  </div>
 </div></div>

 <div class="panel">
  <h2>Four rules this screen obeys</h2>
  <div class="rule"><b>The posture is the biggest thing</b><span>Not the metrics. The largest text is what a wise friend would say — the data is small, and deliberately so.</span></div>
  <div class="rule"><b>The evidence sits beside it</b><span>"She has an unanswered request." The mentor can reject the <i>reasoning</i>, not merely the conclusion. A suggestion that hides its basis is a command.</span></div>
  <div class="rule"><b>Refusing is as easy as accepting</b><span>"Doesn't fit her" is the same size as "I used this." A suggestion you cannot decline is an instruction — and instructing a mentor is exactly what we refuse to build.</span></div>
  <div class="rule"><b>No scripts. Ever.</b><span>There is no "send this message" button. No drafted text. The friar speaks in his own voice or the tool has failed.</span></div>
  <p style="margin-top:16px;">And there is <b style="color:var(--gold)">no member-facing version of this screen</b>. Emma never receives doctrine from a machine. The system briefs the human who accompanies her — and then gets out of the way.</p>
  <div class="try"><b>Try it:</b> dismiss both suggestions. The screen does not argue, does not re-rank, does not try again. It simply says: go be with her.</div>
 </div>
</div>
<script>
function dismiss(id){
 const el=document.getElementById(id);
 el.classList.add('gone');
 setTimeout(checkEmpty,420);
}
function use(id){
 const n=id.replace('c','');
 document.getElementById('a'+n).style.display='none';
 document.getElementById('n'+n).style.display='block';
 document.getElementById('t'+n).focus();
}
function cancel(id){
 const n=id.replace('c','');
 document.getElementById('n'+n).style.display='none';
 document.getElementById('a'+n).style.display='flex';
}
function save(id){
 const n=id.replace('c','');
 document.getElementById('n'+n).style.display='none';
 document.getElementById('d'+n).style.display='block';
}
function checkEmpty(){
 const live=[...document.querySelectorAll('#cards .pc')].filter(c=>!c.classList.contains('gone'));
 if(live.length===0){
  document.getElementById('empty').style.display='block';
  document.getElementById('plbl').style.display='none';
 }
}
</script></body></html>
"""
open('demo/mentor-briefing-demo.html','w').write(HTML.replace('__EM__', EMBLEM))
import os; print('demo:', os.path.getsize('demo/mentor-briefing-demo.html')//1024,'KB')
