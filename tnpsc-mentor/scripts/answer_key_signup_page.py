import fitz

VIOLET = (0x7C / 255, 0x5C / 255, 0xFF / 255)
VIOLET_DARK = (0x4C / 255, 0x1D / 255, 0x95 / 255)
VIOLET_TINT = (0xED / 255, 0xE9 / 255, 0xFE / 255)
INK = (0x1F / 255, 0x2A / 255, 0x44 / 255)
INK2 = (0x4B / 255, 0x55 / 255, 0x63 / 255)
WHITE = (1, 1, 1)

SIGNUP_URL = "https://tnpscmentors.in/register"
SITE = "www.tnpscmentors.in"

FEATURES = [
    "Test Series - full-length mock exams",
    "PYQ Practice - previous year papers with bilingual explanations",
    "Daily Current Affairs - daily quiz plus a monthly magazine",
    "Smart Revision - practice that adapts to your weak topics",
]


def center_text(page, cx, y_baseline, text, fontsize, fontname, color):
    """Insert a single line of text centred on cx, baseline at y_baseline.
    insert_textbox silently drops text if it doesn't fit its box, so every
    single-line label here is placed directly by baseline instead."""
    width = fitz.get_text_length(text, fontname=fontname, fontsize=fontsize)
    page.insert_text(fitz.Point(cx - width / 2, y_baseline), text, fontsize=fontsize, fontname=fontname, color=color)


def wrapped_text(page, rect, text, fontsize, fontname, color, align=fitz.TEXT_ALIGN_CENTER, lineheight=1.3):
    """insert_textbox, but asserts it actually fit (raises instead of silently
    dropping the text, so a bad box shows up immediately during development)."""
    deficit = page.insert_textbox(
        rect, text, fontsize=fontsize, fontname=fontname, color=color, align=align, lineheight=lineheight
    )
    if deficit < 0:
        raise ValueError(f"Text did not fit box {rect}: {text!r} (deficit {deficit:.1f}pt)")


def add_signup_page(doc: "fitz.Document") -> None:
    ref = doc[0]
    w, h = ref.rect.width, ref.rect.height
    page = doc.new_page(width=w, height=h)
    cx = w / 2

    # ── Header band ──────────────────────────────────────────────
    page.draw_rect(fitz.Rect(0, 0, w, 108), color=None, fill=VIOLET, overlay=True)
    center_text(page, cx, 48, "TNPSC MENTORS", 28, "hebo", WHITE)
    center_text(page, cx, 76, "TNPSC Exam Preparation in Tamil & English", 11.5, "helv", WHITE)
    center_text(page, cx, 96, SITE, 10.5, "hebo", WHITE)

    body_w = min(560, w - 80)
    left = cx - body_w / 2
    right = cx + body_w / 2

    # ── Heading + intro ──────────────────────────────────────────
    center_text(page, cx, 148, "You've finished the answer key - keep the momentum going!", 17, "hebo", INK)
    wrapped_text(
        page,
        fitz.Rect(left, 160, right, 200),
        "Everything you need to turn this practice into a rank is already waiting for you "
        "in the TNPSC Mentors app.",
        11.5,
        "helv",
        INK2,
    )

    # ── Feature list ─────────────────────────────────────────────
    fy = 218
    for feat in FEATURES:
        page.insert_text(fitz.Point(left, fy), f"-  {feat}", fontsize=11.5, fontname="helv", color=INK)
        fy += 24

    # ── Credit highlight card ────────────────────────────────────
    card = fitz.Rect(left, fy + 8, right, fy + 70)
    page.draw_rect(card, color=VIOLET, fill=VIOLET_TINT, width=1.1, radius=0.12, overlay=True)
    wrapped_text(
        page,
        fitz.Rect(card.x0 + 16, card.y0 + 8, card.x1 - 16, card.y1 - 6),
        "Sign up free today and get 50 credits instantly, plus 10 more credits every day you log in.",
        13,
        "hebo",
        VIOLET_DARK,
    )

    # ── CTA button ───────────────────────────────────────────────
    btn_w, btn_h = 240, 44
    btn = fitz.Rect(cx - btn_w / 2, card.y1 + 22, cx + btn_w / 2, card.y1 + 22 + btn_h)
    page.draw_rect(btn, color=VIOLET, fill=VIOLET, radius=0.28, overlay=True)
    center_text(page, cx, btn.y0 + btn_h / 2 + 5, "Sign Up Free", 15, "hebo", WHITE)
    page.insert_link({"kind": fitz.LINK_URI, "from": btn, "uri": SIGNUP_URL})

    link_y = btn.y1 + 24
    link_text = "tnpscmentors.in/register"
    link_w = fitz.get_text_length(link_text, fontname="hebo", fontsize=10.5)
    link_rect = fitz.Rect(cx - link_w / 2 - 4, link_y - 12, cx + link_w / 2 + 4, link_y + 4)
    center_text(page, cx, link_y, link_text, 10.5, "hebo", VIOLET_DARK)
    page.insert_link({"kind": fitz.LINK_URI, "from": link_rect, "uri": SIGNUP_URL})

    center_text(page, cx, link_y + 22, "Free to start - no credit card required.", 9, "helv", INK2)
    # No footer here: watermark_answer_key_pdfs.py draws the social strip on
    # every page, this one included.
