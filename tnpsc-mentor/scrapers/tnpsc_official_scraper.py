"""
Official TNPSC source — Tamil previous-year papers & answer keys.

Per the research findings:
  * tnpsc.gov.in/tamil/answerkeys.aspx lists 250+ exam PDFs (2009-2026), the
    largest LAWFUL Tamil-language source (government works; verify reuse terms
    before any commercial redistribution).
  * The PDFs are SCANNED raster images (JBIG2/JPEG, NO text layer), so plain
    text extraction (pdfplumber/PyMuPDF .get_text) yields nothing — they must
    be OCR-ed with a Tamil model.

This script does the two reliable, deterministic steps:
  1) scrape the listing page's <a href> PDF links (do NOT guess filenames — the
     research refuted guessed URL patterns) and download them, and
  2) OCR each page to Tamil text IF an OCR backend is available.

OCR backends (auto-detected, in order):
  - pytesseract + Tesseract-OCR installed with the Tamil model 'tam'
    (tessdata: https://github.com/tesseract-ocr/tessdata or indic-ocr/tessdata)
  - else: download only, and print install instructions.

NOTE ON ACCURACY: zero-shot Tesseract on Tamil is ~7.8% char / ~40% word error,
so OCR text needs manual review / post-processing before it becomes clean MCQs.
For production volume, a cloud OCR (Google Document AI / Vision, ~0.8% CER) is
strongly recommended. Turning OCR'd answer-key text into structured MCQs with
the correct option is a separate parsing/QA step that should be reviewed by a
Tamil reader — this script intentionally stops at producing OCR text so nothing
unverified is auto-loaded into the question bank.

Usage:
  python tnpsc_official_scraper.py --list            # list PDF links
  python tnpsc_official_scraper.py --download N       # download first N PDFs
  python tnpsc_official_scraper.py --ocr              # OCR downloaded PDFs (needs Tesseract+tam)
"""

import argparse
import os
import re
import time
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}

LISTING_PAGES = [
    "https://www.tnpsc.gov.in/tamil/answerkeys.aspx",
    "https://www.tnpsc.gov.in/english/answerkeys.aspx",
    "https://tnpsc.gov.in/english/previous-questions.html",
]

PDF_DIR = "tnpsc_official_pdfs"
OCR_DIR = "tnpsc_official_ocr"

# Skip obvious non-paper documents (regulations, rules, annexures, instructions).
SKIP_PAT = re.compile(
    r"(regulation|rules-of-procedure|annexure|instruction|notification|syllabus)",
    re.I,
)


def list_pdf_links():
    """Scrape exam-paper / answer-key PDF hrefs from the official listing pages."""
    links = []
    seen = set()
    for page in LISTING_PAGES:
        try:
            r = requests.get(page, headers=HEADERS, timeout=30)
            if r.status_code != 200:
                print(f"  HTTP {r.status_code} for {page}")
                continue
            soup = BeautifulSoup(r.content, "lxml")
            for a in soup.select("a[href]"):
                href = a.get("href", "")
                if ".pdf" not in href.lower():
                    continue
                full = urljoin(page, href)
                if full in seen or SKIP_PAT.search(full):
                    continue
                seen.add(full)
                label = " ".join(a.get_text(" ", strip=True).split())[:90]
                links.append((full, label))
        except Exception as e:  # noqa: BLE001
            print(f"  Error on {page}: {e}")
    return links


def download(limit=None):
    os.makedirs(PDF_DIR, exist_ok=True)
    links = list_pdf_links()
    if limit:
        links = links[:limit]
    print(f"Downloading {len(links)} PDFs into {PDF_DIR}/ ...")
    ok = 0
    for url, label in links:
        name = re.sub(r"[^A-Za-z0-9._-]+", "_", url.split("/")[-1])
        path = os.path.join(PDF_DIR, name)
        if os.path.exists(path):
            ok += 1
            continue
        try:
            r = requests.get(url, headers=HEADERS, timeout=60)
            if r.status_code == 200 and r.content[:4] == b"%PDF":
                with open(path, "wb") as f:
                    f.write(r.content)
                ok += 1
                print(f"  ✓ {name}  ({len(r.content)//1024} KB)  {label}")
            else:
                print(f"  ✗ {name}  HTTP {r.status_code}")
        except Exception as e:  # noqa: BLE001
            print(f"  ✗ {name}  {e}")
        time.sleep(0.6)
    print(f"Downloaded/cached {ok}/{len(links)} PDFs.")


def _ocr_backend():
    try:
        import pytesseract  # noqa: F401
        from PIL import Image  # noqa: F401

        # Confirm the Tamil model is present.
        langs = pytesseract.get_languages(config="")
        if "tam" not in langs:
            print("⚠️  Tesseract found but 'tam' model missing. Install tessdata 'tam'.")
            return None
        return "pytesseract"
    except Exception:
        return None


def ocr_all():
    backend = _ocr_backend()
    if not backend:
        print(
            "No OCR backend available.\n"
            "Install:  pip install pytesseract pymupdf pillow\n"
            "Then install Tesseract-OCR and the Tamil model 'tam':\n"
            "  - Tesseract: https://github.com/UB-Mannheim/tesseract/wiki (Windows)\n"
            "  - tam model: https://github.com/tesseract-ocr/tessdata (place tam.traineddata\n"
            "    in your tessdata dir, or set TESSDATA_PREFIX)\n"
            "For higher accuracy on Tamil, prefer Google Document AI / Cloud Vision."
        )
        return

    import fitz  # PyMuPDF
    import pytesseract
    from PIL import Image
    import io

    os.makedirs(OCR_DIR, exist_ok=True)
    pdfs = [f for f in os.listdir(PDF_DIR) if f.lower().endswith(".pdf")] if os.path.isdir(PDF_DIR) else []
    print(f"OCR-ing {len(pdfs)} PDFs with Tesseract 'tam+eng' ...")
    for name in pdfs:
        out_path = os.path.join(OCR_DIR, name.rsplit(".", 1)[0] + ".txt")
        if os.path.exists(out_path):
            continue
        try:
            doc = fitz.open(os.path.join(PDF_DIR, name))
            chunks = []
            for page in doc:
                pix = page.get_pixmap(dpi=300)
                img = Image.open(io.BytesIO(pix.tobytes("png")))
                chunks.append(pytesseract.image_to_string(img, lang="tam+eng"))
            with open(out_path, "w", encoding="utf-8") as f:
                f.write("\n".join(chunks))
            print(f"  ✓ {name} -> {out_path}")
        except Exception as e:  # noqa: BLE001
            print(f"  ✗ {name}  {e}")
    print(
        "\nOCR text written to "
        + OCR_DIR
        + "/. Review & post-process into MCQs (Tamil reader QA recommended) "
        "before loading — OCR has ~10-40% word error and answer keys must be "
        "aligned to question text."
    )


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--list", action="store_true", help="list exam PDF links")
    ap.add_argument("--download", type=int, nargs="?", const=0, help="download first N (0=all)")
    ap.add_argument("--ocr", action="store_true", help="OCR downloaded PDFs (needs Tesseract+tam)")
    args = ap.parse_args()

    if args.list:
        for url, label in list_pdf_links():
            print(f"{url}\n    {label}")
    elif args.download is not None:
        download(limit=args.download or None)
    elif args.ocr:
        ocr_all()
    else:
        ap.print_help()
