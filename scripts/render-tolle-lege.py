#!/usr/bin/env python3
# Tolle Lege — marketing screenshots (Augustinian palette)
from PIL import Image, ImageDraw, ImageFont

NAVY=(27,42,94); BURG=(140,29,44); PARCH=(251,247,236); GOLD=(183,138,58)
WHITE=(255,255,255); GRAY=(118,116,130); GREEN=(47,138,79); SOFT=(150,158,190)
W,H=1080,2340
FD='/usr/share/fonts/truetype/dejavu/'
def F(s,b=False): return ImageFont.truetype(FD+('DejaVuSans-Bold.ttf' if b else 'DejaVuSans.ttf'), s)
def FS(s): return ImageFont.truetype(FD+'DejaVuSerif.ttf', s)

EM = Image.open('mobile/assets/brand/tolle-lege-emblem.png').convert('RGBA')
def em(size):
    e = EM.resize((size,size), Image.LANCZOS); return e

def screen(bg=PARCH):
    img=Image.new('RGB',(W,H),bg); return img, ImageDraw.Draw(img)

def status(d, dark=True):
    c = PARCH if dark else NAVY
    d.text((70,40),"9:41",font=F(40,True),fill=c)
    d.rounded_rectangle([W-140,48,W-70,82],10,outline=c,width=4)
    d.rectangle([W-134,56,W-92,74],fill=c)

def header(img,d,title,mark=True):
    d.rectangle([0,0,W,220],fill=NAVY); status(d)
    x=70
    if mark:
        e=em(92); img.paste(e,(x,110),e); x+=118
    d.text((x,132),title,font=F(50,True),fill=PARCH)

def tabs(img,d,active):
    top=H-190
    d.rectangle([0,top,W,H],fill=WHITE)
    d.line([0,top,W,top],fill=(226,222,208),width=2)
    names=['Feed','Guide','Readings','Journey','Profile']
    tw=W//5
    for i,t in enumerate(names):
        cx=i*tw+tw//2; col=BURG if t==active else GRAY
        d.ellipse([cx-26,top+34,cx+26,top+86],outline=col,width=6)
        f=F(30,t==active); bb=d.textbbox((0,0),t,font=f)
        d.text((cx-(bb[2]-bb[0])//2,top+104),t,font=f,fill=col)

def card(d,x0,y0,x1,y1,fill=WHITE,r=28): d.rounded_rectangle([x0,y0,x1,y1],r,fill=fill)

def frame(img,path):
    r=110;bez=26
    mask=Image.new('L',(W,H),0); ImageDraw.Draw(mask).rounded_rectangle([0,0,W,H],r,fill=255)
    fw,fh=W+2*bez,H+2*bez
    out=Image.new('RGBA',(fw,fh),(0,0,0,0)); od=ImageDraw.Draw(out)
    od.rounded_rectangle([0,0,fw,fh],r+bez,fill=(22,22,28,255))
    out.paste(img,(bez,bez),mask)
    od.rounded_rectangle([fw//2-130,bez+18,fw//2+130,bez+64],24,fill=(22,22,28,255))
    out.save(path); print('wrote',path)

def ctr(d,t,f,y,fill,yoff=0):
    bb=d.textbbox((0,0),t,font=f); d.text(((W-bb[2])//2,y+yoff),t,font=f,fill=fill)

# ---------- 1. The four doors (code entry) ----------
img,d=screen(NAVY); status(d)
e=em(300); img.paste(e,(W//2-150,240),e)
ctr(d,"TOLLE LEGE",FS(70),600,PARCH)
ctr(d,"Read. Reflect. Connect. Go. Serve.",F(36),700,SOFT)
d.text((110,860),"Where are you on the journey?",font=F(40,True),fill=PARCH)
doors=[("Seeker","Exploring faith and big questions",False),
       ("New Catholic","Building foundations",False),
       ("Returning Catholic","Coming home",True),
       ("Discerning","Curious about religious life",False)]
y=940
for name,sub,sel in doors:
    fill=BURG if sel else (36,52,110)
    card(d,90,y,W-90,y+150,fill=fill,r=20)
    d.text((140,y+34),name,font=F(42,True),fill=PARCH)
    d.text((140,y+90),sub,font=F(30),fill=(220,214,230) if sel else SOFT)
    if sel:
        d.ellipse([W-190,y+52,W-140,y+102],fill=GOLD)
        d.text((W-177,y+58),"✓",font=F(38,True),fill=NAVY)
    y+=175
card(d,90,y+30,W-90,y+170,fill=WHITE,r=20)
ctr(d,"R E T U R N I N G",F(48,True),y+72,NAVY)
card(d,90,y+200,W-90,y+340,fill=BURG,r=20)
ctr(d,"Take up and read",F(46,True),y+248,PARCH)
frame(img,'screens-tl/1-doors.png')

# ---------- 2. Arrival / welcome from an Augustinian ----------
img,d=screen()
header(img,d,"Br. Thomas OSA",mark=False)
e=em(92); img.paste(e,(70,110),e)
d.text((196,132),"Br. Thomas OSA",font=F(50,True),fill=PARCH)
d.text((70,262),"← All conversations",font=F(32,True),fill=BURG)
def bub(d,y,lines,mine):
    f=F(34); wmax=max(d.textbbox((0,0),t,font=f)[2] for t in lines); h=44+len(lines)*52
    if mine: x1=W-70;x0=x1-wmax-70; card(d,x0,y,x1,y+h,fill=BURG,r=32); col=PARCH
    else: x0=70;x1=x0+wmax+70; card(d,x0,y,x1,y+h,fill=WHITE,r=32); col=NAVY
    for i,t in enumerate(lines): d.text((x0+36,y+24+i*52),t,font=f,fill=col)
    return y+h+28
y=360
y=bub(d,y,["Welcome, Emma. However long","you have been away, there is a","place set for you here."],False)
y=bub(d,y,["Take up and read — start with","Confessions, Book VIII. Then","tell me what you notice."],False)
y=bub(d,y,["Thank you. I wasn't sure I'd","be welcome."],True)
y=bub(d,y,["You are. That's the whole","point. I'll be here."],False)
card(d,90,y+20,W-90,y+180,fill=(240,234,218),r=24)
d.text((130,y+50),"YOUR STARTER GOALS",font=F(26,True),fill=BURG)
d.text((130,y+96),"○  Read Confessions Book VIII",font=F(32),fill=NAVY)
d.text((130,y+140),"○  Visit a parish near me",font=F(32),fill=NAVY)
tabs(img,d,'Guide')
frame(img,'screens-tl/2-welcome.png')

# ---------- 3. Reading cohort feed ----------
img,d=screen()
header(img,d,"Tolle Lege")
d.text((70,268),"Your cohorts",font=F(34,True),fill=GRAY)
groups=[("Returning",True),("Reading",False),("Common Life",False)]
x=70
for name,act in groups:
    ring=BURG if act else (214,208,192)
    d.ellipse([x,330,x+150,480],outline=ring,width=8)
    d.ellipse([x+12,342,x+138,468],fill=NAVY)
    ee=em(90); img.paste(ee,(x+30,360),ee)
    f=F(28,act); bb=d.textbbox((0,0),name,font=f)
    d.text((x+75-(bb[2]-bb[0])//2,496),name,font=f,fill=NAVY if act else GRAY)
    x+=200
y=590
card(d,50,y,W-50,y+360)
d.text((100,y+40),"TOLLE LEGE READING COHORT",font=F(26,True),fill=BURG)
d.text((100,y+90),"Sr. Monica OSA",font=F(36,True),fill=NAVY)
d.text((100,y+148),"This week: the garden scene. Augustine",font=F(34),fill=(60,60,70))
d.text((100,y+196),"hears a child's voice — \"tolle lege\" —",font=F(34),fill=(60,60,70))
d.text((100,y+244),"and everything turns. What turned for you?",font=F(34),fill=(60,60,70))
d.text((100,y+300),"♥ 31   ·   14 reflections",font=F(32),fill=GRAY)
y+=400
card(d,50,y,W-50,y+300)
d.text((100,y+40),"RETURNING CATHOLICS",font=F(26,True),fill=BURG)
d.text((100,y+90),"Emma",font=F(36,True),fill=NAVY)
d.text((100,y+148),"Twelve years away. Read Book VIII last",font=F(34),fill=(60,60,70))
d.text((100,y+196),"night and cried. Grateful to be here.",font=F(34),fill=(60,60,70))
d.text((100,y+248),"♥ 47   ·   22 reflections",font=F(32),fill=GRAY)
y+=340
card(d,50,y,W-50,y+240,fill=(240,234,218))
d.text((100,y+36),"▶  CONFESSIONS, BOOK VIII",font=F(30,True),fill=NAVY)
d.text((100,y+96),"\"Take up and read\"  ·  40 min",font=F(32),fill=GRAY)
d.rounded_rectangle([100,y+150,W-100,y+190],20,fill=(226,220,204))
d.rounded_rectangle([100,y+150,100+int((W-200)*0.62),y+190],20,fill=GREEN)
d.text((W-260,y+96),"62%",font=F(34,True),fill=GREEN)
tabs(img,d,'Feed')
frame(img,'screens-tl/3-cohort.png')

# ---------- 4. Pilgrimage map (GIS) ----------
img,d=screen()
header(img,d,"Pilgrim Map")
d.rectangle([0,220,W,1180],fill=(228,226,214))
d.line([(0,420),(W,340)],fill=WHITE,width=28)
d.line([(0,820),(W,760)],fill=WHITE,width=22)
d.line([(320,220),(400,1180)],fill=WHITE,width=24)
d.line([(780,220),(720,1180)],fill=WHITE,width=18)
d.ellipse([60,300,280,520],fill=(212,216,200))
pins=[(370,470,"St. Augustine Priory","Daily Mass · open to all",False),
      (700,720,"Villanova Retreat House","Silent weekends",False),
      (260,960,"Chapel of the Restless Heart","Pilgrimage terminus",True)]
for px,py,label,sub,new in pins:
    col=GOLD if new else BURG
    d.polygon([(px-34,py-30),(px+34,py-30),(px,py+38)],fill=col)
    d.ellipse([px-34,py-66,px+34,py+2],fill=col)
    d.ellipse([px-13,py-45,px+13,py-19],fill=WHITE)
    if new:
        d.ellipse([px-56,py-88,px+56,py+24],outline=GOLD,width=5)
card(d,60,1210,W-60,1460,fill=WHITE)
d.text((110,1246),"JUST UNLOCKED",font=F(26,True),fill=GOLD)
d.text((110,1296),"Chapel of the Restless Heart",font=F(40,True),fill=NAVY)
d.text((110,1356),"Pilgrimage terminus · Adoration",font=F(32),fill=GRAY)
d.text((110,1400),"Reserved for Restless Pilgrim cohorts",font=F(32),fill=GRAY)
card(d,60,1500,W-60,1780,fill=(240,234,218))
d.text((110,1536),"HOW YOU REACHED THIS",font=F(26,True),fill=BURG)
steps=[("✓","Read Confessions, Book VIII",GREEN),
       ("✓","Reflected with your cohort",GREEN),
       ("○","Walk the pilgrimage",GOLD)]
sy=1592
for mark,txt,col in steps:
    d.ellipse([110,sy,152,sy+42],fill=col)
    d.text((122,sy+4),mark,font=F(28,True),fill=WHITE)
    d.text((174,sy+4),txt,font=F(32),fill=NAVY)
    sy+=62
tabs(img,d,'Journey')
frame(img,'screens-tl/4-map.png')

# ---------- 5. Formation journey / profile ----------
img,d=screen()
header(img,d,"Your Journey")
d.ellipse([70,280,250,460],fill=NAVY)
d.text((124,320),"E",font=F(90,True),fill=PARCH)
d.text((290,306),"Emma",font=F(56,True),fill=NAVY)
d.text((290,388),"Returning Catholic · joined quietly",font=F(30),fill=GRAY)
d.text((70,530),"FORMATION",font=F(28,True),fill=BURG)
badges=[("Tolle Lege",GOLD),("Restless Pilgrim",BURG)]
x=70
for name,col in badges:
    f=F(30,True); bb=d.textbbox((0,0),name,font=f)
    card(d,x,586,x+bb[2]+110,662,fill=NAVY,r=38)
    d.ellipse([x+20,602,x+64,646],fill=col)
    d.text((x+84,606),name,font=f,fill=PARCH)
    x+=bb[2]+150
d.text((70,730),"A JOURNEY OF GROWTH",font=F(28,True),fill=BURG)
card(d,50,786,W-50,1160)
stages=[("Digital invitation","complete",GREEN),
        ("Guided reading cohort","complete",GREEN),
        ("Augustinian pilgrimage","in progress",GOLD),
        ("Discernment & discipleship","opens next",(205,200,188))]
sy=830
for i,(name,state,col) in enumerate(stages):
    d.ellipse([100,sy,146,sy+46],fill=col)
    if col!=(205,200,188): d.text((112,sy+4),"✓" if state=="complete" else "→",font=F(28,True),fill=WHITE)
    if i<3: d.line([(123,sy+46),(123,sy+82)],fill=(224,218,204),width=5)
    d.text((172,sy+2),name,font=F(36,True),fill=NAVY if col!=(205,200,188) else GRAY)
    d.text((172,sy+48),state,font=F(28),fill=col if col!=(205,200,188) else GRAY)
    sy+=82
d.text((70,1210),"WHAT WE ASK, AND WHY",font=F(28,True),fill=BURG)
d.text((70,1258),"Your record, visible to you. Nothing is",font=F(30),fill=GRAY)
d.text((70,1300),"kept that you cannot see.",font=F(30),fill=GRAY)
card(d,50,1360,W-50,1700)
rows=[("Readings completed","2"),("Reflections shared","9"),
      ("Conversations with your guide","6"),("Pilgrimages walked","1")]
ry=1400
for label,n in rows:
    d.text((100,ry),label,font=F(34),fill=NAVY)
    f=F(40,True); bb=d.textbbox((0,0),n,font=f)
    d.text((W-110-bb[2],ry-4),n,font=f,fill=BURG)
    ry+=78
card(d,50,1740,W-50,1900,fill=(240,234,218))
d.text((100,1776),"“You have made us for Yourself, O Lord,",font=FS(30),fill=NAVY)
d.text((100,1822),"and our heart is restless until it rests",font=FS(30),fill=NAVY)
d.text((100,1862),"in You.”",font=FS(30),fill=NAVY)
tabs(img,d,'Profile')
frame(img,'screens-tl/5-journey.png')
print('all tolle lege screens rendered')
