#!/usr/bin/env python3
from PIL import Image, ImageDraw, ImageFont
NAVY=(27,42,94); BURG=(140,29,44); PARCH=(251,247,236); GOLD=(183,138,58)
WHITE=(255,255,255); GRAY=(110,108,126); MUTE=(154,152,168); GREEN=(47,138,79)
W,H=1080,2340
FD='/usr/share/fonts/truetype/dejavu/'
def F(s,b=False): return ImageFont.truetype(FD+('DejaVuSans-Bold.ttf' if b else 'DejaVuSans.ttf'), s)
def FI(s): return ImageFont.truetype(FD+'DejaVuSans-Oblique.ttf', s)
EM=Image.open('mobile/assets/brand/tolle-lege-emblem.png').convert('RGBA')

img=Image.new('RGB',(W,H),PARCH); d=ImageDraw.Draw(img)
# header
d.rectangle([0,0,W,220],fill=NAVY)
d.text((70,40),"9:41",font=F(40,True),fill=PARCH)
d.rounded_rectangle([W-140,48,W-70,82],10,outline=PARCH,width=4); d.rectangle([W-134,56,W-92,74],fill=PARCH)
d.text((70,132),"←  Briefing",font=F(46,True),fill=PARCH)

y=270
d.text((70,y),"Emma",font=F(64,True),fill=NAVY); y+=100
d.rounded_rectangle([70,y,330,y+56],28,fill=NAVY)
d.text((104,y+14),"MID-JOURNEY",font=F(26,True),fill=PARCH); y+=84
d.text((70,y),"The visible record is the least of",font=FI(30),fill=GRAY); y+=42
d.text((70,y),"what is happening.",font=FI(30),fill=GRAY); y+=70

d.text((70,y),"WHAT WE CAN SEE",font=F(24,True),fill=BURG); y+=48
d.rounded_rectangle([50,y,W-50,y+360],24,fill=WHITE)
facts=[("Active in the last 30 days","4 times",False),
       ("People she talks with here","Only you",True),
       ("Readings completed","2",False),
       ("Waiting for a reply","1 request",True)]
fy=y+30
for label,val,alert in facts:
    d.text((90,fy),label,font=F(28),fill=GRAY)
    f=F(28,True); bb=d.textbbox((0,0),val,font=f)
    d.text((W-90-bb[2],fy),val,font=f,fill=BURG if alert else NAVY)
    fy+=56
d.line([(90,fy+10),(W-90,fy+10)],fill=(239,239,243),width=2)
d.text((90,fy+30),"This is activity, not interior life. What",font=F(24),fill=MUTE)
d.text((90,fy+64),"matters most here is invisible to us.",font=F(24),fill=MUTE)
y+=396

d.text((70,y),"WHAT MIGHT SERVE HER NOW",font=F(24,True),fill=BURG); y+=46

# --- posture card 1 (the hero element) ---
card_h=490
d.rounded_rectangle([50,y,W-50,y+card_h],28,fill=WHITE)
d.text((90,y+36),"Your scarcest resource is",font=F(42,True),fill=NAVY)
d.text((90,y+92),"attention. Spend it where",font=F(42,True),fill=NAVY)
d.text((90,y+148),"there is least.",font=F(42,True),fill=NAVY)
# evidence, set apart by a red rule
d.rounded_rectangle([90,y+220,96,y+300],3,fill=BURG)
d.text((116,y+220),"She has an unanswered request",font=F(28),fill=GRAY)
d.text((116,y+258),"for help.",font=F(28),fill=GRAY)
d.text((90,y+330),"PREFERENTIAL OPTION FOR THE POOR",font=F(22,True),fill=NAVY)
d.text((90,y+366),"Catholic Social Doctrine",font=F(24),fill=MUTE)
# equal-weight actions
d.rounded_rectangle([90,y+404,510,y+466],14,outline=(220,220,228),width=3)
d.text((150,y+422),"Doesn't fit her",font=F(30,True),fill=GRAY)
d.rounded_rectangle([540,y+404,W-90,y+466],14,fill=NAVY)
d.text((640,y+422),"I used this",font=F(30,True),fill=PARCH)
y+=card_h+26

# --- posture card 2 ---
card_h=430
d.rounded_rectangle([50,y,W-50,y+card_h],28,fill=WHITE)
d.text((90,y+36),"Introduce them to a person,",font=F(42,True),fill=NAVY)
d.text((90,y+92),"not just a resource.",font=F(42,True),fill=NAVY)
d.rounded_rectangle([90,y+164,96,y+244],3,fill=BURG)
d.text((116,y+164),"Completing readings, but few",font=F(28),fill=GRAY)
d.text((116,y+202),"relationships. Content without",font=F(28),fill=GRAY)
d.text((116,y+240),"friendship rarely holds.",font=F(28),fill=GRAY)
d.text((90,y+296),"FRIENDSHIP AS THE ROAD",font=F(22,True),fill=NAVY)
d.text((90,y+332),"Confessions",font=F(24),fill=MUTE)
d.rounded_rectangle([90,y+366,510,y+424],14,outline=(220,220,228),width=3)
d.text((150,y+382),"Doesn't fit her",font=F(30,True),fill=GRAY)
d.rounded_rectangle([540,y+366,W-90,y+424],14,fill=NAVY)
d.text((640,y+382),"I used this",font=F(30,True),fill=PARCH)
y+=card_h+26

# --- permanent disclaimer ---
d.rounded_rectangle([50,y,W-50,y+156],18,fill=(238,236,228))
d.rounded_rectangle([50,y,58,y+156],4,fill=(201,199,212))
lines=["Postures to consider, not instructions.",
       "You know this person; the system does",
       "not. Ignore anything that does not fit."]
ly=y+28
for L in lines:
    d.text((90,ly),L,font=FI(27),fill=GRAY); ly+=42
y+=186

d.rounded_rectangle([50,y,W-50,y+110],20,fill=BURG)
bb=d.textbbox((0,0),"Go talk with her",font=F(38,True))
d.text(((W-bb[2])//2,y+32),"Go talk with her",font=F(38,True),fill=PARCH)

# frame
r=110;bez=26
mask=Image.new('L',(W,H),0); ImageDraw.Draw(mask).rounded_rectangle([0,0,W,H],r,fill=255)
fw,fh=W+2*bez,H+2*bez
out=Image.new('RGBA',(fw,fh),(0,0,0,0)); od=ImageDraw.Draw(out)
od.rounded_rectangle([0,0,fw,fh],r+bez,fill=(22,22,28,255))
out.paste(img,(bez,bez),mask)
od.rounded_rectangle([fw//2-130,bez+18,fw//2+130,bez+64],24,fill=(22,22,28,255))
out.save('screens-tl/6-mentor-briefing.png')
print('briefing screenshot written')
