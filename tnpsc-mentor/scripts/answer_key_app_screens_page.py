# The closing "Inside the TNPSC Mentors app" page of every branded answer-key
# PDF: the eight Google Play store screenshots in a 4 x 2 grid plus a Play
# Store button. Used by watermark_answer_key_pdfs.py.
#
# The screenshots live in answer_key_assets/app-screen-{1..8}.jpg, downscaled
# (540 x 960) from the 1080 x 1920 Play listing images so each PDF grows by
# ~0.5 MB rather than ~9 MB. Replace those files when the listing changes.
import glob
import os

import fitz

from answer_key_signup_page import INK2, VIOLET, WHITE, center_text

PLAY_URL = "https://play.google.com/store/apps/details?id=com.tnpscmentor.app"
SITE_URL = "https://tnpscmentors.in"

ASSET_DIR = os.path.join(os.path.dirname(__file__), "answer_key_assets")
SCREENS = sorted(glob.glob(os.path.join(ASSET_DIR, "app-screen-*.jpg")))
SCREEN_RATIO = 1920 / 1080  # height / width of a store screenshot

COLS, ROWS = 4, 2
GAP = 12
BORDER = (0.86, 0.84, 0.95)

# Space kept clear at the bottom for the social strip every page carries.
FOOTER_CLEARANCE = 30


def add_app_screens_page(doc: "fitz.Document") -> None:
    ref = doc[0]
    w, h = ref.rect.width, ref.rect.height
    page = doc.new_page(width=w, height=h)
    cx = w / 2

    # ── Header band ──────────────────────────────────────────────
    band = 78
    page.draw_rect(fitz.Rect(0, 0, w, band), color=None, fill=VIOLET, overlay=True)
    center_text(page, cx, 38, "Inside the TNPSC Mentors App", 22, "hebo", WHITE)
    center_text(
        page, cx, 60, "Daily current affairs, PYQs with explanations, mock tests and progress tracking", 10.5, "helv", WHITE
    )

    # ── Screenshot grid + Play Store button, one block ───────────
    # The grid takes as much room as the page allows, the button sits right
    # under it, and the block is centred vertically between band and footer.
    btn_w, btn_h = 220, 36
    cta_h = 20 + btn_h + 20  # gap, button, site line
    top, bottom = band + 16, h - FOOTER_CLEARANCE - 12
    side = 36
    cell_h = (bottom - top - cta_h - GAP * (ROWS - 1)) / ROWS
    cell_w = cell_h / SCREEN_RATIO
    max_w = (w - 2 * side - GAP * (COLS - 1)) / COLS
    if cell_w > max_w:
        cell_w, cell_h = max_w, max_w * SCREEN_RATIO
    grid_w = COLS * cell_w + (COLS - 1) * GAP
    grid_h = ROWS * cell_h + (ROWS - 1) * GAP
    x0 = cx - grid_w / 2
    y0 = top + (bottom - top - grid_h - cta_h) / 2

    for i, path in enumerate(SCREENS[: COLS * ROWS]):
        r, c = divmod(i, COLS)
        rect = fitz.Rect(
            x0 + c * (cell_w + GAP),
            y0 + r * (cell_h + GAP),
            x0 + c * (cell_w + GAP) + cell_w,
            y0 + r * (cell_h + GAP) + cell_h,
        )
        page.insert_image(rect, filename=path)
        page.draw_rect(rect, color=BORDER, width=0.8, overlay=True)
    # The whole grid opens the store listing too.
    page.insert_link(
        {"kind": fitz.LINK_URI, "from": fitz.Rect(x0, y0, x0 + grid_w, y0 + grid_h), "uri": PLAY_URL}
    )

    btn_y0 = y0 + grid_h + 20
    btn = fitz.Rect(cx - btn_w / 2, btn_y0, cx + btn_w / 2, btn_y0 + btn_h)
    page.draw_rect(btn, color=VIOLET, fill=VIOLET, radius=0.3, overlay=True)
    center_text(page, cx, btn.y0 + btn_h / 2 + 4.5, "Get it on Google Play", 13, "hebo", WHITE)
    page.insert_link({"kind": fitz.LINK_URI, "from": btn, "uri": PLAY_URL})

    site_y = btn.y1 + 16
    site_text = "or open www.tnpscmentors.in in your browser"
    site_w = fitz.get_text_length(site_text, fontname="helv", fontsize=9)
    center_text(page, cx, site_y, site_text, 9, "helv", INK2)
    page.insert_link(
        {"kind": fitz.LINK_URI, "from": fitz.Rect(cx - site_w / 2, site_y - 10, cx + site_w / 2, site_y + 3), "uri": SITE_URL}
    )
