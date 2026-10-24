#!/usr/bin/env python3
# Augustinian emblem: flaming heart pierced by the arrow of divine love,
# resting on an open book. Rendered with smooth curves.
from PIL import Image, ImageDraw
import math

NAVY=(27,42,94); BURG=(140,29,44); GOLD=(183,138,58); PARCH=(251,247,236)

def bez(p0,p1,p2,p3,n=40):
    pts=[]
    for i in range(n+1):
        t=i/n; mt=1-t
        x=mt**3*p0[0]+3*mt*mt*t*p1[0]+3*mt*t*t*p2[0]+t**3*p3[0]
        y=mt**3*p0[1]+3*mt*mt*t*p1[1]+3*mt*t*t*p2[1]+t**3*p3[1]
        pts.append((x,y))
    return pts

def emblem(size=512, bg=None):
    S=4; W=size*S
    img=Image.new('RGBA',(W,W),(bg+(255,)) if bg else (0,0,0,0))
    d=ImageDraw.Draw(img); u=W/100.0
    def U(pts): return [(x*u,y*u) for x,y in pts]

    # ---- open book ----
    lt=bez((12,73),(25,67),(38,65),(48,67)); lb=bez((48,87),(38,85),(25,85),(12,81))
    d.polygon(U(lt+lb), fill=PARCH, outline=NAVY)
    rt=bez((52,67),(62,65),(75,67),(88,73)); rb=bez((88,81),(75,85),(62,85),(52,87))
    d.polygon(U(rt+rb), fill=PARCH, outline=NAVY)
    for i in range(3):
        y=71+i*4.5
        d.line(U(bez((16,y+1.5),(26,y-0.5),(36,y-1),(44,y-0.3))), fill=NAVY, width=max(1,int(0.3*u)))
        d.line(U(bez((56,y-0.3),(64,y-1),(74,y-0.5),(84,y+1.5))), fill=NAVY, width=max(1,int(0.3*u)))
    d.line(U([(50,66),(50,87)]), fill=NAVY, width=int(1.4*u))
    d.line(U([(10,87),(90,87)]), fill=NAVY, width=int(1.6*u))

    # ---- heart (two lobes + point, smooth) ----
    heart = (bez((50,63),(38,52),(28,46),(28,37)) +
             bez((28,37),(28,29),(36,26),(42,30)) +
             bez((42,30),(46,33),(49,36),(50,39)) +
             bez((50,39),(51,36),(54,33),(58,30)) +
             bez((58,30),(64,26),(72,29),(72,37)) +
             bez((72,37),(72,46),(62,52),(50,63)))
    d.polygon(U(heart), fill=BURG, outline=NAVY)

    # ---- flame (teardrop with inner tongue) ----
    fl = (bez((50,4),(56,14),(58,20),(54,25)) +
          bez((54,25),(51,28),(49,28),(46,25)) +
          bez((46,25),(42,20),(44,14),(50,4)))
    d.polygon(U(fl), fill=GOLD, outline=NAVY)
    inner = (bez((50,11),(53,17),(53,21),(50,25)) +
             bez((50,25),(47,21),(47,17),(50,11)))
    d.polygon(U(inner), fill=BURG)

    # ---- arrow of divine love ----
    d.line(U([(31,27),(64,52)]), fill=GOLD, width=int(1.2*u))
    d.polygon(U([(67,54),(60,52),(62,46)]), fill=GOLD)

    return img.resize((size,size), Image.LANCZOS)

if __name__=='__main__':
    emblem(512).save('mobile/assets/brand/tolle-lege-emblem.png')
    emblem(1024,bg=PARCH).convert('RGB').save('mobile/assets/brand/tolle-lege-icon.png')
    print('emblem v2 written')
