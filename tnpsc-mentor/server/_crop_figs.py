#!/usr/bin/env python3
"""Crop the figure from each screenshot via an explicit top/bottom pre-crop
(removes the question-number line and option text), then a noise-filtered trim
of surrounding whitespace. Outputs into _imgcache/."""
import os
from PIL import Image

os.makedirs("_imgcache", exist_ok=True)
SHOTS = "C:/Users/mas20/Pictures/Screenshots"

# (file, out, top, bottom)  -- top/bottom in pixels to pre-crop before trimming
JOBS = [
    ("Screenshot 2026-07-01 172221.png", "q200_cube.png", 0, 192),    # 2025 Q200
    ("Screenshot 2026-07-01 172313.png", "q54_circle.png", 52, 349),  # 2022 Q54
    ("Screenshot 2026-07-01 172349.png", "q152_grid.png", 60, 312),   # 2022 Q152
    ("Screenshot 2026-07-01 172402.png", "q153_cube.png", 80, 280),   # 2022 Q153
]

INK = 120       # darker than this = ink (ignores faint scan noise)
MINR = 3        # min ink pixels in a row/col to count as real content
PAD = 12


def trim(im):
    g = im.convert("L"); w, h = g.size; px = g.load()
    def row_ink(y): return sum(1 for x in range(0, w, 2) if px[x, y] < INK)
    def col_ink(x): return sum(1 for y in range(0, h, 2) if px[x, y] < INK)
    ys = [y for y in range(h) if row_ink(y) >= MINR]
    xs = [x for x in range(w) if col_ink(x) >= MINR]
    if not ys or not xs:
        return im
    x0, x1 = max(0, min(xs) - PAD), min(w, max(xs) + PAD)
    y0, y1 = max(0, min(ys) - PAD), min(h, max(ys) + PAD)
    return im.crop((x0, y0, x1, y1))


for f, out, top, bot in JOBS:
    im = Image.open(os.path.join(SHOTS, f)).convert("RGB")
    w, h = im.size
    pre = im.crop((0, top, w, min(bot, h)))
    res = trim(pre)
    res.save(os.path.join("_imgcache", out))
    print(f"{f} -> {out}  {res.size}")
