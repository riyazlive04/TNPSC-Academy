#!/usr/bin/env python3
"""Faithfully recreate the original figures for the 2022/2025 Group 1 aptitude
questions and write clean PNGs into _imgcache/ for bucket upload + docx embed.

  cubes.png  -> 2022 Q153 & 2025 Q200 (identical four cubes)
  circle.png -> 2022 Q54
  grid.png   -> 2022 Q152
"""
import os, math
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Circle

os.makedirs("_imgcache", exist_ok=True)
FS = 15  # number font size


# ---------------------------------------------------------------- cubes ------
def draw_cube(ax, cx, top, left, right, s=1.0):
    """Isometric cube at horizontal offset cx; numbers on top/left/right faces."""
    def P(ang):
        r = math.radians(ang)
        return (cx + s * math.cos(r), s * math.sin(r))
    p90, p150, p210 = P(90), P(150), P(210)
    p270, p330, p30 = P(270), P(330), P(30)
    C = (cx, 0.0)
    # outline hexagon
    hexp = [p90, p30, p330, p270, p210, p150]
    ax.add_patch(plt.Polygon(hexp, fill=False, lw=1.6, closed=True))
    # three internal edges from centre
    for pt in (p90, p210, p330):
        ax.plot([C[0], pt[0]], [C[1], pt[1]], color="black", lw=1.4)
    # face numbers
    ax.text(cx, 0.52 * s, str(top), ha="center", va="center", fontsize=FS)
    ax.text(cx - 0.42 * s, -0.20 * s, str(left), ha="center", va="center", fontsize=FS)
    ax.text(cx + 0.42 * s, -0.20 * s, str(right), ha="center", va="center", fontsize=FS)


def gen_cubes(path):
    cubes = [("I", 5, 4, 6), ("II", 3, 6, 5), ("III", 2, 1, 4), ("IV", 4, 1, 5)]
    fig, ax = plt.subplots(figsize=(6.2, 1.9), dpi=200)
    step = 2.4
    for i, (lbl, t, l, r) in enumerate(cubes):
        cx = i * step
        draw_cube(ax, cx, t, l, r)
        ax.text(cx, -1.45, lbl, ha="center", va="center", fontsize=13)
    ax.set_xlim(-1.4, (len(cubes) - 1) * step + 1.4)
    ax.set_ylim(-1.8, 1.3)
    ax.set_aspect("equal"); ax.axis("off")
    fig.tight_layout(pad=0.1)
    fig.savefig(path, bbox_inches="tight")
    plt.close(fig)
    print("wrote", path)


# --------------------------------------------------------------- circle ------
def gen_circle(path):
    # outer ring: (mid-angle -> value), inner: (quadrant-centre -> value)
    outer = {22.5: 2, 67.5: 7, 112.5: 4, 157.5: 5,
             202.5: 11, 247.5: 8, 292.5: 3, 337.5: 9}
    inner = {45: "125", 135: "1", 225: "27", 315: "?"}
    R_out, R_in = 1.0, 0.5

    fig, ax = plt.subplots(figsize=(3.8, 3.8), dpi=200)
    ax.add_patch(Circle((0, 0), R_out, fill=False, lw=1.6))
    ax.add_patch(Circle((0, 0), R_in, fill=False, lw=1.4))
    # full vertical + horizontal diameters (through both circles)
    for a in (0, 90, 180, 270):
        r = math.radians(a)
        ax.plot([0, R_out * math.cos(r)], [0, R_out * math.sin(r)],
                color="black", lw=1.2)
    # diagonal separators in the OUTER ring only
    for a in (45, 135, 225, 315):
        r = math.radians(a)
        ax.plot([R_in * math.cos(r), R_out * math.cos(r)],
                [R_in * math.sin(r), R_out * math.sin(r)], color="black", lw=1.2)
    # numbers
    for a, v in outer.items():
        r = math.radians(a)
        ax.text(0.75 * math.cos(r), 0.75 * math.sin(r), str(v),
                ha="center", va="center", fontsize=13)
    for a, v in inner.items():
        r = math.radians(a)
        ax.text(0.28 * math.cos(r), 0.28 * math.sin(r), v,
                ha="center", va="center", fontsize=13,
                fontweight="bold" if v == "?" else "normal")
    ax.set_xlim(-1.15, 1.15); ax.set_ylim(-1.15, 1.15)
    ax.set_aspect("equal"); ax.axis("off")
    fig.tight_layout(pad=0.1)
    fig.savefig(path, bbox_inches="tight")
    plt.close(fig)
    print("wrote", path)


# ----------------------------------------------------------------- grid ------
def gen_grid(path):
    data = [["1", "2", "3"], ["4", "5", "6"], ["7", "8", "9"], ["27", "38", "?"]]
    nr, nc = len(data), len(data[0])
    fig, ax = plt.subplots(figsize=(1.9, 2.5), dpi=200)
    for r in range(nr):
        for c in range(nc):
            y = nr - 1 - r
            ax.add_patch(plt.Rectangle((c, y), 1, 1, fill=False, lw=1.4))
            ax.text(c + 0.5, y + 0.5, data[r][c], ha="center", va="center", fontsize=15)
    ax.set_xlim(-0.1, nc + 0.1); ax.set_ylim(-0.1, nr + 0.1)
    ax.set_aspect("equal"); ax.axis("off")
    fig.tight_layout(pad=0.1)
    fig.savefig(path, bbox_inches="tight")
    plt.close(fig)
    print("wrote", path)


gen_cubes("_imgcache/cubes.png")
gen_circle("_imgcache/circle.png")
gen_grid("_imgcache/grid.png")
