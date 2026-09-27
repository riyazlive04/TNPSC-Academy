# Re-brands the answer-key PDFs under public/downloads/: one large diagonal
# brand watermark behind every page, the signup CTA page appended at the end,
# and TNPSC Mentors metadata. Run from the tnpsc-mentor project root after
# dropping a fresh, UNWATERMARKED PDF there (e.g. for a new exam year):
#
#   python scripts/watermark_answer_key_pdfs.py
#
# Files already branded by this script (creator = TNPSC Mentors) are skipped,
# so re-running never double-stamps or appends a second signup page.
#
# Needs PyMuPDF: pip install pymupdf
import glob
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

import fitz  # PyMuPDF

from answer_key_signup_page import add_signup_page

BRAND_LINE = "TNPSC MENTORS"
SITE_LINE = "www.tnpscmentors.in"
SITE = "tnpscmentors.in"
CREATOR = "TNPSC Mentors"

# Brand violet (#7C5CFF, VIOLET_CSS in src/lib/pdfWatermark.ts) blended onto
# white at STRENGTH and drawn OPAQUE. Not fill_opacity: PDF transparency is an
# ExtGState soft mask that several Android viewers ignore (see stampWatermark),
# which would paint the mark at full violet. The mark sits BEHIND the page
# content, so an opaque light tint never covers the answers.
VIOLET = (0x7C / 255, 0x5C / 255, 0xFF / 255)
STRENGTH = 0.22
TINT = tuple(1 - STRENGTH * (1 - c) for c in VIOLET)

# The brand line spans this share of the page diagonal; the site line is set
# at SITE_RATIO of its size, one line below.
SPAN = 0.62
SITE_RATIO = 0.42

TARGETS = sorted(glob.glob(os.path.join("public", "downloads", "*", "*.pdf")))


def _centered(page, pivot, text, fontsize, fontname, dy, mat):
    """Draw `text` centred on `pivot`, shifted `dy` along the rotated baseline normal."""
    width = fitz.get_text_length(text, fontname=fontname, fontsize=fontsize)
    origin = fitz.Point(pivot.x - width / 2, pivot.y + dy)
    page.insert_text(
        origin,
        text,
        fontsize=fontsize,
        fontname=fontname,
        color=TINT,
        morph=(pivot, mat),
        overlay=False,  # behind the real page content
    )


def stamp(page) -> None:
    w, h = page.rect.width, page.rect.height
    pivot = fitz.Point(w / 2, h / 2)
    # Bottom-left to top-right, along the page's own diagonal.
    mat = fitz.Matrix(math.degrees(math.atan2(h, w)))

    unit = fitz.get_text_length(BRAND_LINE, fontname="hebo", fontsize=1)
    brand_size = SPAN * math.hypot(w, h) / unit
    site_size = brand_size * SITE_RATIO

    # Baselines chosen so the two-line block is optically centred on the pivot.
    _centered(page, pivot, BRAND_LINE, brand_size, "hebo", brand_size * 0.18, mat)
    _centered(page, pivot, SITE_LINE, site_size, "hebo", brand_size * 0.18 + site_size * 1.45, mat)


def brand(path: str) -> bool:
    doc = fitz.open(path)
    if doc.metadata.get("creator") == CREATOR:
        doc.close()
        return False

    for page in doc:
        stamp(page)

    add_signup_page(doc)

    base = os.path.basename(path)
    doc.set_metadata(
        {
            "title": doc.metadata.get("title") or base.replace(".pdf", "").replace("-", " ").replace("_", " "),
            "author": "TNPSC Mentors",
            "subject": f"Answer key sourced from TNPSC Mentors — https://{SITE}",
            "keywords": "TNPSC Mentors, tnpscmentors.in, TNPSC Answer Key",
            "creator": CREATOR,
            "producer": f"TNPSC Mentors ({SITE})",
        }
    )

    tmp = path + ".tmp"
    doc.save(tmp, garbage=4, deflate=True)
    doc.close()
    os.replace(tmp, path)
    return True


if __name__ == "__main__":
    if not TARGETS:
        print("No PDFs found under public/downloads/*/*.pdf", file=sys.stderr)
        sys.exit(1)
    for p in TARGETS:
        print(("branded: " if brand(p) else "skipped (already branded): ") + p)
