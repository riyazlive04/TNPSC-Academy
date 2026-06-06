"""
Render the handover + question-bank Markdown files to PDF (keeping the .md files).

Pipeline: Markdown -> HTML (python-markdown) -> PDF (PyMuPDF / fitz Story, which
paginates automatically).

Font: uses PyMuPDF's built-in Helvetica (a standard PDF font that is NOT embedded),
so even the 4,600-question file stays small. Text is sanitised to Helvetica's
character set first — emoji are dropped and common math/currency symbols are
mapped to ASCII (e.g. ₹ -> "Rs.", √ -> "root", × -> "x").

No extra installs needed (markdown + PyMuPDF are already available).

Usage:
    python make_pdfs.py                 # convert all docs
    python make_pdfs.py HANDOVER.md     # convert specific file(s)
"""

import os
import re
import sys

import fitz  # PyMuPDF
import markdown

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

DOCS = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "docs"))
QBANK = os.path.join(DOCS, "question-bank")

TARGETS = [
    (os.path.join(DOCS, "HANDOVER-DEVELOPER.md"), os.path.join(DOCS, "HANDOVER-DEVELOPER.pdf")),
    (os.path.join(DOCS, "HANDOVER-CLIENT.md"), os.path.join(DOCS, "HANDOVER-CLIENT.pdf")),
    (os.path.join(QBANK, "README.md"), os.path.join(QBANK, "README.pdf")),
    (os.path.join(QBANK, "current_affairs.md"), os.path.join(QBANK, "current_affairs.pdf")),
    (os.path.join(QBANK, "aptitude.md"), os.path.join(QBANK, "aptitude.pdf")),
    (os.path.join(QBANK, "samacheer.md"), os.path.join(QBANK, "samacheer.pdf")),
    (os.path.join(QBANK, "pyq.md"), os.path.join(QBANK, "pyq.pdf")),
]

# Map meaningful non-ASCII symbols to readable ASCII before rendering.
SYMBOL_MAP = {
    "✅": "", "✔": "", "✗": "x", "⚠️": "[!] ", "⚠": "[!] ", "⛔": "[X] ",
    "👉": "-> ", "🔜": "", "🤖": "", "📄": "", "📊": "", "⏳": "", "→": "-> ",
    "•": "- ", "🟢": "", "🔴": "", "₹": "Rs.", "√": "root ", "×": "x", "÷": "/",
    "≤": "<=", "≥": ">=", "≠": "!=", "≈": "~", "π": "pi", "²": "^2", "³": "^3",
    "½": "1/2", "¼": "1/4", "¾": "3/4", "α": "alpha", "β": "beta", "γ": "gamma",
    "Δ": "delta", "°": " deg", "—": "-", "–": "-", "“": '"', "”": '"',
    "‘": "'", "’": "'", "…": "...",
}

_STRIP = re.compile(
    "[\U0001F000-\U0001FAFF\U00002600-\U000027BF\U00002B00-\U00002BFF"
    "\U0000FE00-\U0000FE0F\U00002300-\U000023FF]"
)


def sanitize(text):
    for k, v in SYMBOL_MAP.items():
        text = text.replace(k, v)
    text = _STRIP.sub("", text)
    # Drop anything Helvetica (WinAnsi/cp1252) cannot represent.
    return text.encode("cp1252", "ignore").decode("cp1252")


CSS = """
body { font-size: 10px; line-height: 1.45; color: #16213e; }
h1 { font-size: 21px; color: #0D47A1; margin: 6px 0 4px 0; }
h2 { font-size: 15px; color: #0D47A1; margin: 12px 0 4px 0; }
h3 { font-size: 12px; color: #0D1B2A; margin: 8px 0 3px 0; }
p, li { font-size: 10px; }
em { color: #555; }
code { background-color: #eef; font-size: 9px; }
table { border: 1px solid #bbb; border-collapse: collapse; width: 100%; }
th, td { border: 1px solid #bbb; padding: 3px 5px; font-size: 9px; text-align: left; }
th { background-color: #0D47A1; color: #fff; }
a { color: #1565C0; }
blockquote { color: #555; margin-left: 8px; }
"""


def md_to_pdf(md_path, pdf_path):
    with open(md_path, encoding="utf-8") as f:
        text = sanitize(f.read())
    body = markdown.markdown(
        text, extensions=["tables", "fenced_code", "sane_lists", "nl2br"]
    )
    html = f"<html><body>{body}</body></html>"

    story = fitz.Story(html=html, user_css=CSS)
    writer = fitz.DocumentWriter(pdf_path)
    media = fitz.paper_rect("a4")
    where = media + (48, 40, -48, -40)
    more, pages = 1, 0
    while more:
        dev = writer.begin_page(media)
        more, _ = story.place(where)
        story.draw(dev)
        writer.end_page()
        pages += 1
    writer.close()
    return pages


def main():
    wanted = set(sys.argv[1:])
    targets = [t for t in TARGETS if not wanted or os.path.basename(t[0]) in wanted]
    for md_path, pdf_path in targets:
        if not os.path.exists(md_path):
            print(f"skip (missing): {md_path}")
            continue
        print(f"Rendering {os.path.basename(md_path)} "
              f"({os.path.getsize(md_path)/1e6:.1f} MB md)...", flush=True)
        pages = md_to_pdf(md_path, pdf_path)
        print(f"  -> {os.path.basename(pdf_path)}  "
              f"({pages} pages, {os.path.getsize(pdf_path)/1e6:.1f} MB)")


if __name__ == "__main__":
    main()
