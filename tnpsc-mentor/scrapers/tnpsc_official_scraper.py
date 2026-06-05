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

OCR backends (choose with --engine; 'auto' is the default):
  - cloud  : Google Cloud Vision DOCUMENT_TEXT_DETECTION with Tamil hints
             (~0.79% CER — best for Tamil). Needs GOOGLE_VISION_API_KEY in
             scrapers/.env. Pages are rendered with PyMuPDF and sent to Vision.
  - tesseract : local Tesseract-OCR + Tamil model 'tam' (~7.8% CER fallback).
  - auto   : cloud if GOOGLE_VISION_API_KEY is set, otherwise tesseract.

NOTE ON ACCURACY: even cloud OCR has ~12% word error on Tamil (word/space
formation), so OCR text needs review / post-processing before it becomes clean
MCQs. Turning OCR'd answer-key text into structured MCQs with the correct option
is a separate parsing/QA step that a Tamil reader should review — this script
intentionally stops at producing OCR text so nothing unverified is auto-loaded
into the question bank.

Setup for cloud OCR:
  1. Google Cloud Console → enable "Cloud Vision API"
  2. Create an API key → put it in scrapers/.env as GOOGLE_VISION_API_KEY
  3. pip install pymupdf            (page rendering; pillow only for tesseract)

Usage:
  python tnpsc_official_scraper.py --list                     # list PDF links
  python tnpsc_official_scraper.py --download N                # download first N (0=all)
  python tnpsc_official_scraper.py --ocr --engine cloud        # cloud OCR (Vision)
  python tnpsc_official_scraper.py --ocr --engine tesseract    # local OCR
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


# ─── Page rendering ─────────────────────────────────────────────────────────
def _render_pages(pdf_path, dpi=300):
    """Yield (page_index, png_bytes) for every page of a scanned PDF."""
    import fitz  # PyMuPDF

    doc = fitz.open(pdf_path)
    for i, page in enumerate(doc):
        pix = page.get_pixmap(dpi=dpi)
        yield i, pix.tobytes("png")
    doc.close()


# ─── Cloud OCR: Google Cloud Vision (DOCUMENT_TEXT_DETECTION) ────────────────
# Best Tamil accuracy per research (~0.79% CER). Needs a Vision API key in
# scrapers/.env as GOOGLE_VISION_API_KEY (enable the Cloud Vision API and create
# an API key in Google Cloud Console). Billed per page (~1k pages free/month).
VISION_ENDPOINT = "https://vision.googleapis.com/v1/images:annotate"


def ocr_cloud_vision(png_bytes, api_key):
    import base64

    payload = {
        "requests": [
            {
                "image": {"content": base64.b64encode(png_bytes).decode("ascii")},
                "features": [{"type": "DOCUMENT_TEXT_DETECTION"}],
                # Tamil + English hints dramatically improve mixed-script pages.
                "imageContext": {"languageHints": ["ta", "en"]},
            }
        ]
    }
    r = requests.post(
        f"{VISION_ENDPOINT}?key={api_key}", json=payload, timeout=90
    )
    r.raise_for_status()
    resp = r.json()["responses"][0]
    if "error" in resp:
        raise RuntimeError(resp["error"].get("message", "Vision API error"))
    return resp.get("fullTextAnnotation", {}).get("text", "")


# ─── Local OCR: Tesseract 'tam+eng' (fallback) ──────────────────────────────
def ocr_tesseract(png_bytes):
    import io

    import pytesseract
    from PIL import Image

    return pytesseract.image_to_string(Image.open(io.BytesIO(png_bytes)), lang="tam+eng")


def _resolve_engine(engine):
    """Pick the OCR engine. 'auto' = cloud if a Vision key exists, else tesseract."""
    key = os.getenv("GOOGLE_VISION_API_KEY", "").strip()
    if engine in ("auto", "cloud") and key:
        return "cloud", key
    if engine == "cloud" and not key:
        return None, "Set GOOGLE_VISION_API_KEY in scrapers/.env to use cloud OCR."
    # tesseract path
    try:
        import pytesseract

        if "tam" not in pytesseract.get_languages(config=""):
            return None, "Tesseract found but 'tam' model missing (install tessdata 'tam')."
        return "tesseract", None
    except Exception:
        return None, (
            "No OCR backend. Either set GOOGLE_VISION_API_KEY (recommended for Tamil),\n"
            "or: pip install pytesseract pymupdf pillow + install Tesseract-OCR with the\n"
            "'tam' model (https://github.com/tesseract-ocr/tessdata)."
        )


def ocr_all(engine="auto", dpi=300):
    backend, info = _resolve_engine(engine)
    if not backend:
        print(info)
        print("\nFor highest Tamil accuracy use cloud OCR:")
        print("  1. Google Cloud Console → enable 'Cloud Vision API'")
        print("  2. Create an API key, put it in scrapers/.env as GOOGLE_VISION_API_KEY")
        print("  3. pip install pymupdf  (page rendering)")
        print("  4. python tnpsc_official_scraper.py --ocr --engine cloud")
        return

    try:
        import fitz  # noqa: F401
    except Exception:
        print("PyMuPDF is required for page rendering: pip install pymupdf")
        return

    os.makedirs(OCR_DIR, exist_ok=True)
    pdfs = (
        [f for f in os.listdir(PDF_DIR) if f.lower().endswith(".pdf")]
        if os.path.isdir(PDF_DIR)
        else []
    )
    label = "Google Cloud Vision (ta+en)" if backend == "cloud" else "Tesseract tam+eng"
    print(f"OCR-ing {len(pdfs)} PDFs with {label} ...")

    api_key = info if backend == "cloud" else None
    for name in pdfs:
        out_path = os.path.join(OCR_DIR, name.rsplit(".", 1)[0] + ".txt")
        if os.path.exists(out_path):
            continue
        try:
            chunks = []
            for _, png in _render_pages(os.path.join(PDF_DIR, name), dpi=dpi):
                if backend == "cloud":
                    chunks.append(ocr_cloud_vision(png, api_key))
                    time.sleep(0.2)  # stay under Vision rate limits
                else:
                    chunks.append(ocr_tesseract(png))
            with open(out_path, "w", encoding="utf-8") as f:
                f.write("\n\n".join(chunks))
            print(f"  ✓ {name} -> {out_path}")
        except Exception as e:  # noqa: BLE001
            print(f"  ✗ {name}  {e}")

    print(
        f"\nOCR text written to {OCR_DIR}/. Next: post-process into MCQs (a Tamil "
        "reader should QA — even cloud OCR has ~12% word error, and answer-key "
        "tables must be aligned to question text) before loading into the DB."
    )


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--list", action="store_true", help="list exam PDF links")
    ap.add_argument("--download", type=int, nargs="?", const=0, help="download first N (0=all)")
    ap.add_argument("--ocr", action="store_true", help="OCR downloaded PDFs")
    ap.add_argument(
        "--engine",
        choices=["auto", "cloud", "tesseract"],
        default="auto",
        help="OCR engine: auto (cloud if key set, else tesseract), cloud (Google Vision), tesseract",
    )
    ap.add_argument("--dpi", type=int, default=300, help="page render DPI for OCR")
    args = ap.parse_args()

    if args.list:
        for url, label in list_pdf_links():
            print(f"{url}\n    {label}")
    elif args.download is not None:
        download(limit=args.download or None)
    elif args.ocr:
        ocr_all(engine=args.engine, dpi=args.dpi)
    else:
        ap.print_help()
