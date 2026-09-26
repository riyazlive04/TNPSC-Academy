# Re-brands the answer-key PDFs under public/downloads/: tiles the brand
# watermark behind every page, appends the signup CTA page, and stamps
# metadata. Run from the tnpsc-mentor project root after replacing a PDF
# there with a fresh, unwatermarked one for a new exam year:
#
#   python scripts/watermark_answer_key_pdfs.py
#
# Needs PyMuPDF: pip install pymupdf
import glob
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

import fitz  # PyMuPDF

from answer_key_signup_page import add_signup_page

# Matches BRAND_WATERMARK / VIOLET_CSS in src/lib/pdfWatermark.ts — the same
# mark the app stamps on "published, no single downloader to trace" PDFs
# (CA magazine, question sets). These answer-key PDFs are the same category:
# publicly downloadable, not per-student, so the mark carries the brand.
BRAND_TEXT = "TNPSC MENTORS  ·  WWW.TNPSCMENTORS.IN"
VIOLET = (0x7C / 255, 0x5C / 255, 0xFF / 255)
FONT_SIZE = 12.5
STEP_X = 210
STEP_Y = 100
ANGLE_DEG = 30
OPACITY = 0.40
SITE = "tnpscmentors.in"

TARGETS = sorted(glob.glob(os.path.join("public", "downloads", "*", "*.pdf")))


def watermark(path: str) -> None:
    doc = fitz.open(path)
    for page in doc:
        rect = page.rect
        w, h = rect.width, rect.height
        mat = fitz.Matrix(ANGLE_DEG)

        row = 0
        y = 30.0
        while y < h + STEP_Y:
            x_offset = (row % 2) * (STEP_X / 2)
            x = -STEP_X + x_offset
            while x < w + STEP_X:
                page.insert_text(
                    fitz.Point(x, y),
                    BRAND_TEXT,
                    fontsize=FONT_SIZE,
                    fontname="helv",
                    color=VIOLET,
                    fill_opacity=OPACITY,
                    morph=(fitz.Point(x, y), mat),
                    overlay=False,  # behind the real page content
                )
                x += STEP_X
            y += STEP_Y
            row += 1

    add_signup_page(doc)

    base = os.path.basename(path)
    doc.set_metadata(
        {
            "title": doc.metadata.get("title") or base.replace(".pdf", "").replace("-", " ").replace("_", " "),
            "author": "TNPSC Mentors",
            "subject": f"Answer key sourced from TNPSC Mentors — https://{SITE}",
            "keywords": "TNPSC Mentors, tnpscmentors.in, TNPSC Answer Key",
            "creator": "TNPSC Mentors",
            "producer": f"TNPSC Mentors ({SITE})",
        }
    )

    tmp = path + ".tmp"
    doc.save(tmp, garbage=4, deflate=True)
    doc.close()
    os.replace(tmp, path)


if __name__ == "__main__":
    if not TARGETS:
        print("No PDFs found under public/downloads/*/*.pdf", file=sys.stderr)
        sys.exit(1)
    for p in TARGETS:
        watermark(p)
        print("watermarked:", p)
