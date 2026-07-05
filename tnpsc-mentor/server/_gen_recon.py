#!/usr/bin/env python3
"""Generate reconstructed figures for Group 1 aptitude questions whose figure
content is fully determined by the question text. Output PNGs into _imgcache/."""
import os, math
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Circle

os.makedirs("_imgcache", exist_ok=True)

# --- 2022 circle puzzle -----------------------------------------------------
# Text: outer ring 4,7,2,9,3,8,11,5 ; inner sections 1,125,27,? (find ?)
# Reconstructed as 4 sectors (quadrants); each sector has 2 outer values near
# the rim and 1 inner value near the centre, taken in the order given.
sectors = [
    {"center": 45,  "outer": (4, 7),  "inner": "1"},
    {"center": 135, "outer": (2, 9),  "inner": "125"},
    {"center": 225, "outer": (3, 8),  "inner": "27"},
    {"center": 315, "outer": (11, 5), "inner": "?"},
]

fig, ax = plt.subplots(figsize=(3.6, 3.6), dpi=200)
ax.add_patch(Circle((0, 0), 1.0, fill=False, lw=1.6))
ax.add_patch(Circle((0, 0), 0.45, fill=False, lw=1.2))
# spokes at 0/90/180/270 dividing the four sectors
for a in (0, 90, 180, 270):
    r = math.radians(a)
    ax.plot([0.45 * math.cos(r), math.cos(r)],
            [0.45 * math.sin(r), math.sin(r)], color="black", lw=1.1)

for s in sectors:
    c = s["center"]
    # two outer numbers, offset +/-22.5 deg from sector centre, on the ring
    for off, val in zip((-22.5, 22.5), s["outer"]):
        r = math.radians(c + off)
        ax.text(0.72 * math.cos(r), 0.72 * math.sin(r), str(val),
                ha="center", va="center", fontsize=13)
    # inner value at sector centre
    r = math.radians(c)
    ax.text(0.24 * math.cos(r), 0.24 * math.sin(r), s["inner"],
            ha="center", va="center", fontsize=13,
            fontweight="bold" if s["inner"] == "?" else "normal")

ax.set_xlim(-1.15, 1.15); ax.set_ylim(-1.15, 1.15)
ax.set_aspect("equal"); ax.axis("off")
fig.tight_layout(pad=0.1)
fig.savefig("_imgcache/recon_circle_2022.png", bbox_inches="tight")
plt.close(fig)
print("wrote _imgcache/recon_circle_2022.png")
