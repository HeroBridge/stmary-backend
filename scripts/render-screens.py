#!/usr/bin/env python3
# Hero One Eleven — App Store screenshot generator
# Renders 5 phone-framed feature screens from the real brand assets.
from PIL import Image, ImageDraw, ImageFont, ImageOps

NAVY = (18, 18, 61); RED = (228, 48, 36); LIGHT = (244, 244, 248)
WHITE = (255, 255, 255); GREEN = (47, 168, 79); GRAY = (110, 110, 128)
GOLD = (200, 144, 30); SOFTNAVY = (159, 160, 196)
W, H = 1080, 2340
FD = '/usr/share/fonts/truetype/dejavu/'
def F(size, bold=False): return ImageFont.truetype(FD + ('DejaVuSans-Bold.ttf' if bold else 'DejaVuSans.ttf'), size)

BADGE = Image.open('mobile/assets/brand/HERO111_2026.png').convert('RGBA')
MASCOT = Image.open('mobile/assets/brand/HERO_AVATAR_OFFICIAL.png').convert('RGBA')

def badge_circle(size):
    # crop the circular badge out of its wide canvas
    bbox = BADGE.getchannel('A').getbbox()
    sq = BADGE.crop(bbox)
    side = max(sq.size)
    canvas = Image.new('RGBA', (side, side), (0,0,0,0))
    canvas.paste(sq, ((side-sq.width)//2, (side-sq.height)//2), sq)
    canvas = canvas.resize((size, size), Image.LANCZOS)
    mask = Image.new('L', (size, size), 0)
    ImageDraw.Draw(mask).ellipse([0,0,size,size], fill=255)
    canvas.putalpha(mask)
    return canvas

def mascot_head(size):
    head = MASCOT.crop((90, 0, 830, 700)).resize((size, size), Image.LANCZOS)
    mask = Image.new('L', (size, size), 0)
    ImageDraw.Draw(mask).ellipse([0,0,size,size], fill=255)
    out = Image.new('RGBA', (size, size), LIGHT + (255,))
    out.paste(head, (0, 0), head)
    out.putalpha(mask)
    return out

def new_screen(bg=LIGHT):
    img = Image.new('RGB', (W, H), bg)
    return img, ImageDraw.Draw(img)

def status_bar(d, dark_bg=True):
    c = LIGHT if dark_bg else NAVY
    d.text((70, 40), "9:41", font=F(40, True), fill=c)
    d.rounded_rectangle([W-140, 48, W-70, 82], 10, outline=c, width=4)
    d.rectangle([W-134, 56, W-92, 74], fill=c)
    d.ellipse([W-200, 52, W-172, 80], outline=c, width=4)

def header(img, d, title, with_badge=True):
    d.rectangle([0, 0, W, 220], fill=NAVY)
    status_bar(d)
    x = 70
    if with_badge:
        b = badge_circle(96)
        img.paste(b, (x, 108), b)
        x += 120
    d.text((x, 128), title, font=F(52, True), fill=LIGHT)

def tabbar(img, d, active):
    top = H - 190
    d.rectangle([0, top, W, H], fill=WHITE)
    d.line([0, top, W, top], fill=(224, 224, 230), width=2)
    tabs = ['Feed', 'Messages', 'Resources', 'Events', 'Profile']
    tw = W // 5
    for i, t in enumerate(tabs):
        cx = i*tw + tw//2
        col = RED if t == active else GRAY
        d.ellipse([cx-26, top+34, cx+26, top+86], outline=col, width=6)
        f = F(30, t == active)
        bb = d.textbbox((0,0), t, font=f)
        d.text((cx-(bb[2]-bb[0])//2, top+104), t, font=f, fill=col)

def card(d, x0, y0, x1, y1, fill=WHITE, r=28):
    d.rounded_rectangle([x0, y0, x1, y1], r, fill=fill)

def frame(img, out_path):
    r = 110; bez = 26
    mask = Image.new('L', (W, H), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, W, H], r, fill=255)
    fw, fh = W + 2*bez, H + 2*bez
    framed = Image.new('RGBA', (fw, fh), (0, 0, 0, 0))
    fd = ImageDraw.Draw(framed)
    fd.rounded_rectangle([0, 0, fw, fh], r + bez, fill=(22, 22, 28, 255))
    framed.paste(img, (bez, bez), mask)
    # camera notch pill
    fd.rounded_rectangle([fw//2-130, bez+18, fw//2+130, bez+64], 24, fill=(22,22,28,255))
    framed.save(out_path)
    print('wrote', out_path, framed.size)

# ============ 1. ARRIVAL — the one-code moment ============
img, d = new_screen(NAVY)
status_bar(d)
b = badge_circle(360)
img.paste(b, (W//2-180, 300), b)
t = "HERO ONE ELEVEN"
bb = d.textbbox((0,0), t, font=F(72, True)); d.text(((W-bb[2])//2, 730), t, font=F(72, True), fill=LIGHT)
t2 = "A community that meets you where you are."
bb = d.textbbox((0,0), t2, font=F(38)); d.text(((W-bb[2])//2, 840), t2, font=F(38), fill=SOFTNAVY)
d.text((110, 1010), "Enter your community code", font=F(40, True), fill=LIGHT)
card(d, 100, 1080, W-100, 1220, fill=WHITE, r=24)
d.text((150, 1128), "S P R I N G - 2 0 2 6", font=F(52, True), fill=NAVY)
t3 = "Joining Hero One Eleven — Spring Cohort"
d.ellipse([120, 1268, 164, 1312], fill=GREEN)
d.text((131, 1272), "✓", font=F(34, True), fill=WHITE)
d.text((186, 1276), t3, font=F(34), fill=(120, 220, 150))
card(d, 100, 1390, W-100, 1530, fill=RED, r=24)
t4 = "Build my community"
bb = d.textbbox((0,0), t4, font=F(46, True)); d.text(((W-bb[2])//2, 1418), t4, font=F(46, True), fill=LIGHT)
t5 = "Your code sets up everything for you —"
t6 = "groups, mentor, resources, and goals."
for i, tt in enumerate([t5, t6]):
    bb = d.textbbox((0,0), tt, font=F(34)); d.text(((W-bb[2])//2, 1596+i*54), tt, font=F(34), fill=SOFTNAVY)
m = MASCOT.resize((500, 500), Image.LANCZOS)
img.paste(m, (W//2-250, H-560), m)
frame(img, 'screens/1-arrival.png')

# ============ 2. CURATED FEED ============
img, d = new_screen()
header(img, d, "Hero One Eleven")
d.text((70, 268), "Your groups", font=F(34, True), fill=GRAY)
groups = [("Welcome", True), ("Career", False), ("Pod: Tues", False), ("Alumni", False)]
x = 70
for name, active in groups:
    ring = RED if active else (210, 210, 218)
    d.ellipse([x, 330, x+150, 480], outline=ring, width=8)
    d.ellipse([x+12, 342, x+138, 468], fill=NAVY)
    d.text((x+55, 372), name[0], font=F(56, True), fill=LIGHT)
    f = F(28, active); bb = d.textbbox((0,0), name, font=f)
    d.text((x+75-(bb[2]-bb[0])//2, 496), name, font=f, fill=NAVY if active else GRAY)
    x += 200
y = 590
card(d, 50, y, W-50, y+330)
d.text((100, y+40), "ANNOUNCEMENTS", font=F(28, True), fill=RED)
d.text((100, y+92), "Ada Admin", font=F(36, True), fill=NAVY)
d.text((100, y+150), "Town hall this Friday at 6pm — childcare", font=F(36), fill=(60,60,70))
d.text((100, y+200), "provided. Bring your questions!", font=F(36), fill=(60,60,70))
d.text((100, y+262), "♥ 24   ·   6 comments", font=F(34), fill=GRAY)
y += 380
card(d, 50, y, W-50, y+420)
d.text((100, y+40), "WELCOME CIRCLE", font=F(28, True), fill=RED)
d.text((100, y+92), "Manny Mentor", font=F(36, True), fill=NAVY)
d.text((100, y+150), "Proud of this group — three members hit", font=F(36), fill=(60,60,70))
d.text((100, y+200), "their orientation milestone this week!", font=F(36), fill=(60,60,70))
card(d, 100, y+256, W-100, y+346, fill=LIGHT, r=20)
d.text((130, y+280), "▶  Orientation Track — Getting Started", font=F(32, True), fill=NAVY)
d.text((100, y+366), "♥ 18   ·   4 comments", font=F(34), fill=GRAY)
y += 470
card(d, 50, y, W-50, y+330)
d.text((100, y+40), "POD: TUESDAY", font=F(28, True), fill=RED)
d.text((100, y+92), "Jordan P.", font=F(36, True), fill=NAVY)
d.text((100, y+150), "Bringing snacks this week. Someone", font=F(36), fill=(60,60,70))
d.text((100, y+200), "claim drinks before Manny does.", font=F(36), fill=(60,60,70))
d.text((100, y+262), "♥ 9   ·   11 comments", font=F(34), fill=GRAY)
d.ellipse([W-220, H-420, W-90, H-290], fill=RED)
d.text((W-176, H-408), "+", font=F(90, True), fill=LIGHT)
tabbar(img, d, 'Feed')
frame(img, 'screens/2-feed.png')

# ============ 3. RESOURCES + MAP ============
img, d = new_screen()
header(img, d, "Resources")
d.rectangle([0, 220, W, 1060], fill=(228, 233, 228))
for coords in [(0, 380, W, 30), (0, 700, W, 26)]:
    d.line([(coords[0], coords[1]), (coords[2], coords[1]-120)], fill=WHITE, width=coords[3])
d.line([(300, 220), (420, 1060)], fill=WHITE, width=26)
d.line([(760, 220), (700, 1060)], fill=WHITE, width=20)
d.ellipse([80, 300, 260, 480], fill=(206, 220, 206))
for px, py, label in [(360, 420, "Resource Center"), (640, 640, "Food Bank"), (250, 800, "Childcare")]:
    d.ellipse([px-16, py-16, px+16, py+16], fill=WHITE)
    d.polygon([(px-34, py-30), (px+34, py-30), (px, py+36)], fill=RED)
    d.ellipse([px-34, py-64, px+34, py+4], fill=RED)
    d.ellipse([px-12, py-42, px+12, py-18], fill=WHITE)
    card(d, px-170, py+50, px+170, py+120, fill=WHITE, r=18)
    f = F(28, True); bb = d.textbbox((0,0), label, font=f)
    d.text((px-(bb[2]-bb[0])//2, py+68), label, font=f, fill=NAVY)
card(d, W-320, 260, W-70, 350, fill=NAVY, r=40)
d.text((W-296, 284), "Map view  ●", font=F(34, True), fill=LIGHT)
d.text((70, 1120), "Featured for you", font=F(40, True), fill=NAVY)
y = 1200
for title, kind, mins in [("Orientation Video", "VIDEO · 12 MIN", 74),
                          ("Resume Builder Workshop", "COURSE · 4 LESSONS", 30),
                          ("Financial Aid Checklist", "DOCUMENT", 0)]:
    card(d, 50, y, W-50, y+220)
    d.rounded_rectangle([90, y+40, 230, y+180], 24, fill=NAVY)
    d.polygon([(140, y+80), (140, y+140), (196, y+110)], fill=RED)
    d.text((270, y+48), kind, font=F(26, True), fill=RED)
    d.text((270, y+94), title, font=F(38, True), fill=NAVY)
    if mins: 
        d.rounded_rectangle([270, y+150, 270+mins*4+120, y+192], 16, fill=LIGHT)
        d.text((290, y+156), f"{mins}% complete", font=F(26, True), fill=GREEN)
    y += 260
tabbar(img, d, 'Resources')
frame(img, 'screens/3-resources-map.png')

# ============ 4. MESSAGES — mentor welcome ============
img, d = new_screen()
d.rectangle([0, 0, W, 220], fill=NAVY)
status_bar(d)
mh = mascot_head(96)
img.paste(mh, (70, 106), mh)
d.text((196, 128), "Manny Mentor", font=F(52, True), fill=LIGHT)
d.text((70, 262), "← All conversations", font=F(32, True), fill=RED)
def bubble(d, img, y, text_lines, mine, avatar=None):
    f = F(34)
    wmax = max(d.textbbox((0,0), t, font=f)[2] for t in text_lines)
    hgt = 44 + len(text_lines)*50
    if mine:
        x1 = W - 70; x0 = x1 - wmax - 70
        card(d, x0, y, x1, y+hgt, fill=RED, r=32)
        col = LIGHT
    else:
        x0 = 190; x1 = x0 + wmax + 70
        card(d, x0, y, x1, y+hgt, fill=WHITE, r=32)
        col = NAVY
        if avatar is not None:
            img.paste(avatar, (70, y+hgt-100), avatar)
    for i, t in enumerate(text_lines):
        d.text((x0+36, y+24+i*50), t, font=f, fill=col)
    return y + hgt + 30
av = mascot_head(92)
y = 360
y = bubble(d, img, y, ["Welcome, Maria! I'm Manny, your", "mentor. Excited to walk with you."], False, av)
y = bubble(d, img, y, ["I set two starter goals for you —", "check your profile when you can."], False, av)
y = bubble(d, img, y, ["Thank you!! Just finished the", "orientation video!"], True)
y = bubble(d, img, y, ["Amazing — that unlocked your", "Career Pathfinders group. See", "you Tuesday at the pod!"], False, av)
card(d, 300, y+10, W-300, y+80, fill=(234, 234, 240), r=30)
d.text((350, y+26), "Manny is typing…", font=F(30), fill=GRAY)
card(d, 50, H-360, W-240, H-230, fill=WHITE, r=48)
d.text((100, H-322), "Message…", font=F(36), fill=(150,150,160))
d.ellipse([W-210, H-360, W-80, H-230], fill=NAVY)
d.text((W-172, H-330), "➤", font=F(56), fill=LIGHT)
tabbar(img, d, 'Messages')
frame(img, 'screens/4-messages.png')

# ============ 5. PROFILE — badges, tracks, impact ============
img, d = new_screen()
header(img, d, "Profile")
d.ellipse([70, 280, 250, 460], fill=NAVY)
d.text((122, 320), "M", font=F(90, True), fill=LIGHT)
d.text((290, 310), "Maria", font=F(56, True), fill=NAVY)
d.text((290, 392), "Member · joined with SPRING-2026", font=F(32), fill=GRAY)
d.text((70, 530), "BADGES", font=F(30, True), fill=RED)
x = 70
for name in ["First Steps", "Goal Getter"]:
    f = F(32, True); bb = d.textbbox((0,0), name, font=f)
    card(d, x, 586, x+bb[2]+120, 666, fill=NAVY, r=40)
    d.ellipse([x+22, 602, x+70, 650], fill=GOLD)
    d.text((x+92, 604), name, font=f, fill=LIGHT)
    x += bb[2] + 160
d.text((70, 730), "LEARNING TRACKS", font=F(30, True), fill=RED)
card(d, 50, 786, W-50, 946)
d.text((100, 820), "Orientation Track", font=F(38, True), fill=NAVY)
d.rounded_rectangle([100, 880, W-100, 916], 18, fill=(230,230,236))
d.rounded_rectangle([100, 880, 100+int((W-200)*0.5), 916], 18, fill=GREEN)
d.text((W-260, 820), "1 of 2", font=F(34, True), fill=GREEN)
d.text((70, 1010), "MY IMPACT TRANSCRIPT", font=F(30, True), fill=RED)
d.text((70, 1062), "Your record, visible to you.", font=F(32), fill=GRAY)
card(d, 50, 1120, W-50, 1520)
rows = [("Resources viewed", "12"), ("Milestones completed", "1"),
        ("Posts & comments", "7"), ("Check-ins with mentor", "3")]
ry = 1160
for label, n in rows:
    d.text((100, ry), label, font=F(36), fill=NAVY)
    f = F(40, True); bb = d.textbbox((0,0), n, font=f)
    d.text((W-110-bb[2], ry-4), n, font=f, fill=RED)
    ry += 92
d.text((70, 1580), "PRIVACY — WHAT WE COLLECT & WHY", font=F(30, True), fill=RED)
card(d, 50, 1636, W-50, 1980)
toggles = [("Engagement events", True), ("Session notes", True), ("Goal progress", False)]
ty = 1680
for label, on in toggles:
    d.text((100, ty), label, font=F(36), fill=NAVY)
    tx = W - 220
    d.rounded_rectangle([tx, ty-6, tx+120, ty+54], 30, fill=RED if on else (205,205,212))
    cx = tx+66 if on else tx+8
    d.ellipse([cx, ty-2, cx+46, ty+50], fill=WHITE)
    ty += 100
tabbar(img, d, 'Profile')
frame(img, 'screens/5-profile.png')
print("all screens rendered")
