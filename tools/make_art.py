#!/usr/bin/env python3
"""Bloom Bubbles — all art drawn in code with PIL. No AI images, no downloads.
Original garden theme: glossy flower-bud bubbles, blossom shooter, garden sky.
Outputs PNGs into art/ (project root is the parent of tools/).
"""
import math
import os
import random

from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ART = os.path.join(os.path.dirname(HERE), "art")
os.makedirs(ART, exist_ok=True)

rng = random.Random(20261122)

# ---------------------------------------------------------------- helpers --

def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def circle(d, cx, cy, r, fill):
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=fill)


def save(img, name):
    p = os.path.join(ART, name)
    img.save(p, "PNG")
    print("wrote", p, img.size)


# -------------------------------------------------------------- bubbles --

# color name -> (base, light, dark, petal)
BUBBLES = {
    "red":    ((232, 74, 95),  (255, 150, 165), (150, 20, 40),  (255, 205, 212)),
    "yellow": ((245, 180, 40), (255, 225, 130), (180, 115, 10), (255, 242, 190)),
    "green":  ((86, 190, 90),  (170, 235, 175), (30, 120, 45),  (205, 245, 210)),
    "blue":   ((70, 150, 240), (150, 205, 255), (25, 80, 180),  (205, 232, 255)),
    "purple": ((165, 95, 210), (215, 165, 245), (95, 40, 150),  (232, 205, 250)),
    "pink":   ((240, 110, 185), (255, 175, 225), (170, 45, 125), (255, 215, 240)),
}

S = 128  # bubble canvas


def make_bubble(name, base, light, dark, petal):
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cx = cy = S // 2
    r = 56
    # soft drop shadow
    sh = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(sh).ellipse([cx - r + 3, cy - r + 7, cx + r + 3, cy + r + 7],
                               fill=(0, 0, 0, 70))
    sh = sh.filter(ImageFilter.GaussianBlur(4))
    img.alpha_composite(sh)
    d = ImageDraw.Draw(img)
    # body: vertical gradient bands
    for i in range(2 * r):
        t = i / (2 * r)
        col = lerp(light, base, min(1.0, t * 1.35))
        y = cy - r + i
        d.line([(cx - r, y), (cx + r, y)], fill=col + (255,))
    # clip to circle
    mask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(mask).ellipse([cx - r, cy - r, cx + r, cy + r], fill=255)
    body = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    body.paste(img, (0, 0), mask)
    img = body
    d = ImageDraw.Draw(img)
    # rim
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=dark + (255,), width=4)
    # bottom shade arc
    d.arc([cx - r + 8, cy - r + 14, cx + r - 8, cy + r - 6], 20, 160,
          fill=dark + (140,), width=10)
    # five-petal flower in the middle
    for k in range(5):
        a = -math.pi / 2 + k * (2 * math.pi / 5)
        px, py = cx + int(20 * math.cos(a)), cy + int(20 * math.sin(a))
        d.ellipse([px - 11, py - 11, px + 11, py + 11], fill=petal + (255,))
    circle(d, cx, cy, 12, (255, 255, 255, 255))
    circle(d, cx, cy, 6, base + (255,))
    # glossy highlight
    d.ellipse([cx - 34, cy - 40, cx - 6, cy - 14], fill=(255, 255, 255, 210))
    d.ellipse([cx + 12, cy + 22, cx + 30, cy + 38], fill=(255, 255, 255, 110))
    save(img, f"bubble_{name}.png")


for _n, _c in BUBBLES.items():
    make_bubble(_n, *_c)

# -------------------------------------------------------------- shooter --

def make_shooter():
    W = H = 200
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cx, cy = W // 2, H // 2 + 18
    # barrel (points up from centre)
    d.rounded_rectangle([cx - 17, 18, cx + 17, cy + 10], radius=14,
                        fill=(90, 140, 70, 255), outline=(45, 90, 35, 255), width=4)
    d.rounded_rectangle([cx - 11, 26, cx + 11, cy], radius=8,
                        fill=(140, 200, 110, 255))
    # petals around centre
    for k in range(8):
        a = k * (math.pi / 4)
        px, py = cx + int(52 * math.cos(a)), cy + int(52 * math.sin(a))
        d.ellipse([px - 26, py - 26, px + 26, py + 26],
                  fill=(255, 255, 255, 255), outline=(240, 180, 60, 255), width=4)
    # centre
    circle(d, cx, cy, 34, (255, 200, 60, 255))
    d.ellipse([cx - 34, cy - 34, cx + 34, cy + 34],
              outline=(220, 150, 20, 255), width=4)
    # face dots
    circle(d, cx - 12, cy - 4, 4, (90, 60, 20, 255))
    circle(d, cx + 12, cy - 4, 4, (90, 60, 20, 255))
    d.arc([cx - 12, cy + 2, cx + 12, cy + 18], 15, 165,
          fill=(90, 60, 20, 255), width=4)
    save(img, "shooter.png")


make_shooter()

# ------------------------------------------------- particles / aim dot --

def make_dot(name, size, color):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    circle(d, size // 2, size // 2, size // 2 - 1, color)
    save(img, name)


make_dot("particle.png", 32, (255, 255, 255, 255))
make_dot("aimdot.png", 24, (255, 255, 255, 230))


def make_star():
    S2 = 96
    img = Image.new("RGBA", (S2, S2), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cx = cy = S2 // 2
    pts = []
    for k in range(10):
        r = 42 if k % 2 == 0 else 18
        a = -math.pi / 2 + k * math.pi / 5
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    d.polygon(pts, fill=(255, 200, 60, 255), outline=(220, 150, 20, 255))
    d.polygon([(cx + 8 * math.cos(-math.pi / 2 + k * math.pi / 5),
                cy + 8 * math.sin(-math.pi / 2 + k * math.pi / 5))
               for k in range(10)], fill=(255, 225, 130, 255))
    save(img, "star.png")


def make_lock():
    W2, H2 = 64, 80
    img = Image.new("RGBA", (W2, H2), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([10, 34, 54, 72], radius=8,
                        fill=(90, 100, 120, 255), outline=(50, 60, 80, 255), width=3)
    d.arc([18, 10, 46, 44], 180, 360, fill=(50, 60, 80, 255), width=7)
    circle(d, 32, 50, 7, (255, 220, 90, 255))
    d.rectangle([29, 50, 35, 62], fill=(255, 220, 90, 255))
    save(img, "lock.png")


make_star()
make_lock()

# ------------------------------------------------------------ background --

def make_bg():
    W, H = 720, 1280
    img = Image.new("RGB", (W, H))
    d = ImageDraw.Draw(img)
    # sky gradient: soft blue -> pale mint
    for y in range(H):
        t = y / H
        if t < 0.55:
            col = lerp((135, 205, 250), (200, 240, 220), t / 0.55)
        else:
            col = lerp((200, 240, 220), (150, 220, 150), (t - 0.55) / 0.45)
        d.line([(0, y), (W, y)], fill=col)
    # sun
    circle(d, 590, 130, 62, (255, 225, 120))
    circle(d, 590, 130, 48, (255, 240, 170))
    # clouds
    for (x, y, s) in [(110, 150, 1.0), (300, 90, 0.7), (520, 260, 0.85),
                      (150, 330, 0.75), (430, 420, 0.6)]:
        for (dx, dy, r) in [(0, 0, 34), (34, 8, 26), (-34, 10, 24), (12, -14, 24)]:
            circle(d, int(x + dx * s), int(y + dy * s), int(r * s),
                   (255, 255, 255))
    # distant hills
    d.ellipse([-220, 880, 420, 1180], fill=(140, 205, 130))
    d.ellipse([300, 920, 940, 1220], fill=(120, 195, 120))
    # grass band
    d.rectangle([0, 1080, W, H], fill=(105, 185, 95))
    d.rectangle([0, 1080, W, 1096], fill=(125, 205, 115))
    # flowers in the grass
    for _ in range(46):
        x = rng.randint(15, W - 15)
        y = rng.randint(1105, H - 15)
        col = rng.choice([(255, 120, 160), (255, 210, 80), (255, 255, 255),
                          (200, 140, 240)])
        for k in range(5):
            a = k * (2 * math.pi / 5)
            px, py = x + int(7 * math.cos(a)), y + int(7 * math.sin(a))
            circle(d, px, py, 5, col)
        circle(d, x, y, 4, (255, 220, 60))
    # butterflies
    for (x, y, c) in [(90, 480, (255, 150, 200)), (640, 620, (150, 200, 255)),
                      (180, 760, (255, 200, 90))]:
        d.ellipse([x - 12, y - 6, x, y + 6], fill=c)
        d.ellipse([x, y - 6, x + 12, y + 6], fill=c)
        d.line([(x, y - 8), (x, y + 8)], fill=(60, 60, 60), width=2)
    save(img.convert("RGBA"), "background.png")


make_bg()
print("art done")
