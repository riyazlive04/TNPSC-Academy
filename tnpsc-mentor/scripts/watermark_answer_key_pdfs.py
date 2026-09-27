# Re-brands the answer-key PDFs under public/downloads/: one large diagonal
# brand watermark behind every page, a slim logo + tagline + site header on
# every answer-key page, a clickable social strip along the bottom of every
# page, then the app-screenshots page and the signup CTA page
# appended at the end, plus TNPSC Mentors metadata. Run from the tnpsc-mentor
# project root:
#
#   python scripts/watermark_answer_key_pdfs.py --from ../../../parser
#       copies every file in SOURCES fresh from the parser workspace, then
#       brands them all (use this after changing the branding itself)
#   python scripts/watermark_answer_key_pdfs.py
#       brands whatever unbranded PDFs are already in public/downloads/
#
# Files already branded by this script (creator = TNPSC Mentors) are skipped,
# so re-running never double-stamps or appends the closing pages twice.
#
# Needs PyMuPDF: pip install pymupdf
import argparse
import glob
import math
import os
import shutil
import sys

sys.path.insert(0, os.path.dirname(__file__))

import fitz  # PyMuPDF

from answer_key_app_screens_page import add_app_screens_page
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
STRENGTH = 0.15
TINT = tuple(1 - STRENGTH * (1 - c) for c in VIOLET)

# The brand line spans this share of the page diagonal; the site line is set
# at SITE_RATIO of its size, one line below.
SPAN = 0.62
SITE_RATIO = 0.42

DOWNLOADS = os.path.join("public", "downloads")

# Published file (under public/downloads/) -> its unbranded original in the
# parser workspace. A `-tamil` file is the same key with Tamil explanations.
SOURCES = {
    "group1-2026/tnpsc-group-1-answer-key-2026.pdf": "Group1/Group1_2026_Prelims_AnswerKey.pdf",
    "group1-2026/tnpsc-group-1-answer-key-2026-tamil.pdf": "Group1/Group1_2026_Prelims_AnswerKey_Tamil.pdf",
    "group1-2026/tnpsc-group-1-question-paper-2026-with-answers.pdf": "Group1/Group1_2026_Prelims_QuestionPaper_Answered.pdf",
    "group1-2025/tnpsc-group-1-answer-key-2025.pdf": "Group1/Group1_2025_Prelims_AnswerKey_v2.pdf",
    "group1-2024/tnpsc-group-1-answer-key-2024.pdf": "Group1/Group1_2024_Prelims_AnswerKey.pdf",
    "group1-2022/tnpsc-group-1-answer-key-2022.pdf": "Group1/Group1_2022_Prelims_AnswerKey.pdf",
    "group2-2025/tnpsc-group-2-answer-key-2025.pdf": "Group2/Group2_2025_Prelims_AnswerKey.pdf",
    "group2-2024/tnpsc-group-2-answer-key-2024.pdf": "Group2/Group2_2024_Prelims_AnswerKey.pdf",
    "group4-2025/tnpsc-group-4-answer-key-2025.pdf": "group4/TNPSC_Group4_2025_AnswerKey.pdf",
    "group4-2025/tnpsc-group-4-answer-key-2025-tamil.pdf": "group4/TNPSC_Group4_2025_AnswerKey_Tamil.pdf",
    "group4-2024/tnpsc-group-4-answer-key-2024.pdf": "group4/TNPSC_Group4_2024_AnswerKey.pdf",
    "group4-2024/tnpsc-group-4-answer-key-2024-tamil.pdf": "group4/TNPSC_Group4_2024_AnswerKey_Tamil.pdf",
    # Group 1 2026 subject-wise keys
    "group1-2026/tnpsc-group-1-2026-general-science-answer-key.pdf": "Group1/subject_2026/Group1_2026_GeneralScience.pdf",
    "group1-2026/tnpsc-group-1-2026-general-science-answer-key-tamil.pdf": "Group1/subject_2026/Group1_2026_GeneralScience_Tamil.pdf",
    "group1-2026/tnpsc-group-1-2026-geography-answer-key.pdf": "Group1/subject_2026/Group1_2026_Geography.pdf",
    "group1-2026/tnpsc-group-1-2026-geography-answer-key-tamil.pdf": "Group1/subject_2026/Group1_2026_Geography_Tamil.pdf",
    "group1-2026/tnpsc-group-1-2026-indian-history-answer-key.pdf": "Group1/subject_2026/Group1_2026_IndianHistory.pdf",
    "group1-2026/tnpsc-group-1-2026-indian-history-answer-key-tamil.pdf": "Group1/subject_2026/Group1_2026_IndianHistory_Tamil.pdf",
    "group1-2026/tnpsc-group-1-2026-indian-polity-answer-key.pdf": "Group1/subject_2026/Group1_2026_IndianPolity.pdf",
    "group1-2026/tnpsc-group-1-2026-indian-polity-answer-key-tamil.pdf": "Group1/subject_2026/Group1_2026_IndianPolity_Tamil.pdf",
    "group1-2026/tnpsc-group-1-2026-economy-answer-key.pdf": "Group1/subject_2026/Group1_2026_Economy_DevAdmin.pdf",
    "group1-2026/tnpsc-group-1-2026-economy-answer-key-tamil.pdf": "Group1/subject_2026/Group1_2026_Economy_DevAdmin_Tamil.pdf",
    "group1-2026/tnpsc-group-1-2026-tamil-nadu-history-answer-key.pdf": "Group1/subject_2026/Group1_2026_TamilNadu_History.pdf",
    "group1-2026/tnpsc-group-1-2026-tamil-nadu-history-answer-key-tamil.pdf": "Group1/subject_2026/Group1_2026_TamilNadu_History_Tamil.pdf",
    "group1-2026/tnpsc-group-1-2026-aptitude-answer-key.pdf": "Group1/subject_2026/Group1_2026_Aptitude.pdf",
    "group1-2026/tnpsc-group-1-2026-aptitude-answer-key-tamil.pdf": "Group1/subject_2026/Group1_2026_Aptitude_Tamil.pdf",
    "group1-2026/tnpsc-group-1-2026-reasoning-answer-key.pdf": "Group1/subject_2026/Group1_2026_Reasoning.pdf",
    "group1-2026/tnpsc-group-1-2026-reasoning-answer-key-tamil.pdf": "Group1/subject_2026/Group1_2026_Reasoning_Tamil.pdf",
}

# Social strip: (platform, handle, link, platform colour). Links match the
# footer of the answer-key web pages (src/components/Landing/AnswerKeyChrome.tsx).
SOCIALS = [
    ("YouTube", "@TNPSCMentors4you", "https://www.youtube.com/@TNPSCMentors4you", (0.80, 0.0, 0.0)),
    ("Instagram", "@mentorstnpsc", "https://www.instagram.com/mentorstnpsc/", (0.76, 0.21, 0.52)),
    ("Telegram", "TNPSC Mentors", "https://t.me/+fnGJ6TbCiI8wNTY1", (0.13, 0.55, 0.80)),
    ("Facebook", "TNPSC Mentors", "https://www.facebook.com/profile.php?id=61591260240425", (0.09, 0.40, 0.85)),
]
INK = (0x1F / 255, 0x2A / 255, 0x44 / 255)
INK2 = (0x4B / 255, 0x55 / 255, 0x63 / 255)
VIOLET_DARK = (0x4C / 255, 0x1D / 255, 0x95 / 255)
RULE = (0.80, 0.78, 0.90)

# Header strip: the site's own tagline (footerTagline on the answer-key pages)
# and a 96px copy of public/logo-mark.png, drawn at 14pt.
TAGLINE = "TNPSC exam preparation in Tamil & English"
LOGO = os.path.join(os.path.dirname(__file__), "answer_key_assets", "logo-mark-96.png")
SEP = "   |   "


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


def social_strip(page) -> None:
    """A hairline and one centred line of linked socials in the bottom margin.

    Every source keeps >= 36pt clear at the bottom (checked when this was
    added) and the strip needs 26, so it is drawn on top of the page."""
    w, h = page.rect.width, page.rect.height
    side = 36
    page.draw_line(fitz.Point(side, h - 26), fitz.Point(w - side, h - 26), color=RULE, width=0.6)

    # (text, font, colour, link) runs, laid out left to right.
    runs = [("Follow TNPSC Mentors:  ", "hebo", INK, None)]
    for name, handle, url, colour in SOCIALS:
        runs += [(name, "hebo", colour, url), (" " + handle, "helv", INK2, url), (SEP, "helv", RULE, None)]
    runs.append((SITE_LINE, "hebo", VIOLET_DARK, f"https://{SITE}"))

    size = 7.5
    total = sum(fitz.get_text_length(t, fontname=f, fontsize=size) for t, f, _, _ in runs)
    if total > w - 2 * side:
        size *= (w - 2 * side) / total
        total = w - 2 * side

    x, y = (w - total) / 2, h - 11
    link_start, link_url = x, None
    for text, font, colour, url in runs:
        if url != link_url:
            if link_url:
                page.insert_link({"kind": fitz.LINK_URI, "from": fitz.Rect(link_start, y - size, x, y + 2), "uri": link_url})
            link_start, link_url = x, url
        page.insert_text(fitz.Point(x, y), text, fontsize=size, fontname=font, color=colour)
        x += fitz.get_text_length(text, fontname=font, fontsize=size)
    if link_url:
        page.insert_link({"kind": fitz.LINK_URI, "from": fitz.Rect(link_start, y - size, x, y + 2), "uri": link_url})


def header_strip(page, logo_xref: int) -> int:
    """Small logo + "TNPSC Mentors · tagline" on the left, the linked site on
    the right, over a hairline — all inside the top 28pt. The tightest source
    starts its content at y≈34 (checked when this was added).

    The logo is embedded once per document: pass 0 the first time, then the
    returned xref so every later page reuses the same image."""
    w = page.rect.width
    side = 36
    logo = fitz.Rect(side, 8, side + 14, 22)
    logo_xref = page.insert_image(logo, filename=LOGO) if not logo_xref else page.insert_image(logo, xref=logo_xref)

    y = 18.5
    x = logo.x1 + 5
    page.insert_text(fitz.Point(x, y), "TNPSC Mentors", fontsize=9, fontname="hebo", color=INK)
    x += fitz.get_text_length("TNPSC Mentors", fontname="hebo", fontsize=9)
    page.insert_text(fitz.Point(x, y), f"  ·  {TAGLINE}", fontsize=8, fontname="helv", color=INK2)
    page.insert_link({"kind": fitz.LINK_URI, "from": fitz.Rect(logo.x0, 6, x, 24), "uri": f"https://{SITE}"})

    site_w = fitz.get_text_length(SITE_LINE, fontname="hebo", fontsize=8.5)
    page.insert_text(fitz.Point(w - side - site_w, y), SITE_LINE, fontsize=8.5, fontname="hebo", color=VIOLET_DARK)
    page.insert_link({"kind": fitz.LINK_URI, "from": fitz.Rect(w - side - site_w, 8, w - side, 22), "uri": f"https://{SITE}"})

    page.draw_line(fitz.Point(side, 28), fitz.Point(w - side, 28), color=RULE, width=0.6)
    return logo_xref


def pdf_title(path: str) -> str:
    """The searchable document title Google shows for the PDF itself, from the
    published file name: tnpsc-group-4-answer-key-2024-tamil.pdf ->
    "TNPSC Group 4 Answer Key 2024 (Tamil explanations) - TNPSC Mentors"."""
    stem = os.path.basename(path)[:-4]
    lang = ""
    if stem.endswith("-tamil"):
        stem, lang = stem[: -len("-tamil")], " (Tamil explanations)"
    words = ["TNPSC" if w == "tnpsc" else w if w == "with" else w.capitalize() for w in stem.split("-")]
    return f"{' '.join(words)}{lang} - TNPSC Mentors"


def brand(path: str) -> bool:
    doc = fitz.open(path)
    if doc.metadata.get("creator") == CREATOR:
        doc.close()
        return False

    # The closing pages added below open with their own brand band, so the
    # header goes on the answer-key pages only.
    logo_xref = 0
    for page in doc:
        stamp(page)
        logo_xref = header_strip(page, logo_xref)

    add_app_screens_page(doc)
    add_signup_page(doc)
    for page in doc:
        social_strip(page)

    doc.set_metadata(
        {
            "title": pdf_title(path),
            "author": "TNPSC Mentors",
            "subject": f"Answer key sourced from TNPSC Mentors - https://{SITE}",
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


def copy_sources(parser_dir: str) -> None:
    for dest, src in SOURCES.items():
        target = os.path.join(DOWNLOADS, dest)
        os.makedirs(os.path.dirname(target), exist_ok=True)
        shutil.copyfile(os.path.join(parser_dir, src), target)
        print(f"copied: {src} -> {target}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--from", dest="parser_dir", help="parser workspace to copy fresh originals from first")
    args = ap.parse_args()
    if args.parser_dir:
        copy_sources(args.parser_dir)

    targets = sorted(glob.glob(os.path.join(DOWNLOADS, "*", "*.pdf")))
    if not targets:
        print("No PDFs found under public/downloads/*/*.pdf", file=sys.stderr)
        sys.exit(1)
    for p in targets:
        print(("branded: " if brand(p) else "skipped (already branded): ") + p)
