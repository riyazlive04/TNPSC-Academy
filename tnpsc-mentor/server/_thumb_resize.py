# Downscale one thumbnail to WebP. Mirrors src/lib/imageResize.ts (800px, q82).
import json, sys
from PIL import Image

MAX_PX, QUALITY = 800, 82
src, dst = sys.argv[1], sys.argv[2]
im = Image.open(src)
w, h = im.size
im = im.convert("RGB")
scale = min(1.0, MAX_PX / max(w, h))
nw, nh = max(1, round(w * scale)), max(1, round(h * scale))
if scale < 1.0:
    im = im.resize((nw, nh), Image.LANCZOS)
im.save(dst, "WEBP", quality=QUALITY, method=6)
print(json.dumps({"w": w, "h": h, "nw": nw, "nh": nh}))
