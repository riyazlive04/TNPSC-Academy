#!/usr/bin/env python3
"""
Scraper for TNPSC Thervu Pettagam — Monthly Quiz Documents
(Shankar IAS Academy TNPSC current-affairs quizzes).

Extracts bilingual (English + Tamil) current-affairs MCQs from the
Monthly Quiz Document PDFs and writes them to thervupettagam_questions.json
in the schema expected by the TNPSC Mentor app DB.

Stack: python3 + requests + PyMuPDF (fitz).
"""

import sys
import re
import json
import time
import html
import os

import requests
import fitz  # PyMuPDF

# Windows cp1252 console safety
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

BASE = "https://www.tnpscthervupettagam.com"
CATEGORY_URL = BASE + "/downloads-category/monthly-quiz-documents"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 Chrome/120"
    )
}

POLITE_SLEEP = 1.0  # seconds

OUTPUT_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                           "thervupettagam_questions.json")

# Tamil Unicode block
TAMIL_RE = re.compile(r"[஀-௿]")

MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
]
MONTH_SET = {m.lower() for m in MONTHS}


def get(url, **kw):
    """Polite GET with shared headers."""
    kw.setdefault("headers", HEADERS)
    kw.setdefault("timeout", 60)
    r = requests.get(url, **kw)
    r.raise_for_status()
    time.sleep(POLITE_SLEEP)
    return r


def absolutize(href):
    if not href:
        return None
    href = html.unescape(href.strip())
    if href.startswith("http"):
        return href
    if href.startswith("//"):
        return "https:" + href
    if href.startswith("/"):
        return BASE + href
    return BASE + "/" + href


def collect_detail_links():
    """
    Walk the category page (and any pagination) and collect every
    downloads-detail URL pointing at a monthly quiz document.
    """
    detail_links = []
    seen = set()
    page = 1
    while True:
        url = CATEGORY_URL if page == 1 else f"{CATEGORY_URL}?page={page}"
        try:
            r = get(url)
        except Exception as e:
            print(f"[category] page {page} fetch failed: {e}", flush=True)
            break

        html_text = r.text
        # Find detail links on this page
        hrefs = re.findall(r'href=["\']([^"\']*downloads-detail[^"\']*)["\']',
                           html_text, flags=re.I)
        page_links = []
        for h in hrefs:
            full = absolutize(h)
            if not full:
                continue
            if full in seen:
                continue
            seen.add(full)
            page_links.append(full)

        # Keep only ones that look like monthly quiz docs
        monthly = [h for h in page_links
                   if "monthly-quiz" in h.lower() or "quiz" in h.lower()]
        # Fall back to all detail links if the slug naming differs
        chosen = monthly if monthly else page_links
        detail_links.extend(chosen)

        print(f"[category] page {page}: {len(page_links)} detail links "
              f"({len(chosen)} quiz)", flush=True)

        # Detect "next page" pagination: a link to ?page=N+1 (or page-N)
        has_next = bool(re.search(
            rf'href=["\'][^"\']*[?&]page={page + 1}\b', html_text)) \
            or bool(re.search(rf'\bpage[-/]{page + 1}\b', html_text))

        if not page_links:
            # No detail links on this page -> end of listing
            break
        if not has_next:
            break
        page += 1
        if page > 30:  # hard safety cap
            break

    # Dedupe preserving order
    out, s = [], set()
    for h in detail_links:
        if h not in s:
            s.add(h)
            out.append(h)
    return out


def extract_pdf_url(detail_url):
    """Scrape the single PDF href from a detail page."""
    try:
        r = get(detail_url)
    except Exception as e:
        print(f"[detail] fetch failed {detail_url}: {e}", flush=True)
        return None
    # Find a .pdf link
    m = re.findall(r'href=["\']([^"\']+\.pdf)["\']', r.text, flags=re.I)
    if not m:
        # sometimes the asset path appears without href attr quotes
        m = re.findall(r'(https?://[^\s"\']+\.pdf)', r.text, flags=re.I)
    if not m:
        print(f"[detail] no pdf on {detail_url}", flush=True)
        return None
    # Prefer one under assets/.../doc/
    for cand in m:
        if "/doc/" in cand.lower() or "quiz" in cand.lower():
            return absolutize(cand)
    return absolutize(m[0])


def month_year_from(text):
    """
    Extract 'Month YYYY' and int year from a slug / filename / url.
    Returns (month_year_str, year_int) or (None, None).
    """
    t = text.replace("_", " ").replace("-", " ")
    m = re.search(
        r'(January|February|March|April|May|June|July|August|'
        r'September|October|November|December)\s+(\d{4})',
        t, flags=re.I)
    if not m:
        return None, None
    mon = m.group(1).capitalize()
    yr = int(m.group(2))
    return f"{mon} {yr}", yr


def pdf_text(pdf_bytes):
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    parts = []
    for page in doc:
        parts.append(page.get_text())
    doc.close()
    return "\n".join(parts)


def build_answer_map(tail_text):
    """
    From the answer-key tail, build {question_number: 'A'..'D'}.
    Pattern: 'N. X' pairs.
    """
    amap = {}
    for m in re.finditer(r'(\d{1,3})\.\s*([A-Da-d])\b', tail_text):
        num = int(m.group(1))
        letter = m.group(2).upper()
        amap[num] = letter
    return amap


def split_question_blocks(text):
    """
    Split the full text into (qnum, block_text) on '\n<number>.\n' style
    markers. Returns list of (int, str).
    """
    # Split keeping the number markers
    parts = re.split(r'\n\s*(\d{1,3})\.\s*', "\n" + text)
    # parts = [pre, num1, body1, num2, body2, ...]
    blocks = []
    for i in range(1, len(parts) - 1, 2):
        try:
            num = int(parts[i])
        except ValueError:
            continue
        body = parts[i + 1]
        blocks.append((num, body))
    return blocks


def parse_block(body):
    """
    Parse one question body into:
      en_stem, [en_a..en_d], ta_stem, [ta_a..ta_d]
    English first, Tamil after first Tamil char appears.
    Returns dict or None.
    """
    lines = [ln.rstrip() for ln in body.splitlines()]

    en_lines, ta_lines = [], []
    in_tamil = False
    for ln in lines:
        if not in_tamil and TAMIL_RE.search(ln):
            in_tamil = True
        (ta_lines if in_tamil else en_lines).append(ln)

    def parse_lang(lns):
        opts = {}
        stem_parts = []
        current_opt = None
        for ln in lns:
            s = ln.strip()
            if not s:
                continue
            mo = re.match(r'^([A-Da-d])\)\s*(.*)$', s)
            if mo:
                current_opt = mo.group(1).upper()
                opts[current_opt] = mo.group(2).strip()
            elif current_opt is not None:
                # continuation of an option
                opts[current_opt] = (opts[current_opt] + " " + s).strip()
            else:
                stem_parts.append(s)
        stem = " ".join(stem_parts).strip()
        return stem, opts

    en_stem, en_opts = parse_lang(en_lines)
    ta_stem, ta_opts = parse_lang(ta_lines)

    return {
        "en_stem": en_stem,
        "en_opts": en_opts,
        "ta_stem": ta_stem or None,
        "ta_opts": ta_opts,
    }


def locate_answer_tail(text):
    """
    Heuristically split off the answer-key tail. The answer key is a dense
    run of 'N. X' pairs near the end. We find the last large region that is
    dominated by such pairs.
    """
    # Find all 'N. X' matches; the tail starts where they become dense.
    matches = list(re.finditer(r'(\d{1,3})\.\s*([A-Da-d])\b', text))
    if not matches:
        return text, ""
    # Use the position of the earliest match that belongs to a long
    # consecutive run at the end.
    # Simple approach: take everything from a point where >= 10 such pairs
    # occur within a small window to end.
    starts = [m.start() for m in matches]
    # Walk backward to find a contiguous dense cluster
    tail_start = starts[-1]
    # extend cluster: include earlier matches if gap small
    for i in range(len(starts) - 1, 0, -1):
        gap = starts[i] - starts[i - 1]
        if gap < 60:  # answer pairs are close together
            tail_start = starts[i - 1]
        else:
            # if we already have a decent cluster, stop
            if len([s for s in starts if s >= tail_start]) >= 10:
                break
            else:
                tail_start = starts[i - 1]
    body = text[:tail_start]
    tail = text[tail_start:]
    return body, tail


def parse_pdf(pdf_text_str, pdf_url, month_year, year):
    text = pdf_text_str
    body, tail = locate_answer_tail(text)
    amap = build_answer_map(tail)

    rows = []
    blocks = split_question_blocks(body)
    for num, blk in blocks:
        letter = amap.get(num)
        if not letter:
            continue
        parsed = parse_block(blk)
        en_stem = parsed["en_stem"]
        en_opts = parsed["en_opts"]
        if not en_stem:
            continue
        if not all(k in en_opts and en_opts[k] for k in ("A", "B", "C", "D")):
            continue

        ta_opts = parsed["ta_opts"]
        has_ta_opts = all(k in ta_opts and ta_opts[k] for k in
                          ("A", "B", "C", "D"))

        row = {
            "category": "current_affairs",
            "ca_type": "month_wise",
            "ca_month": month_year,
            "ca_year": year,
            "subject": "Current Affairs",
            "question_text": en_stem,
            "option_a": en_opts["A"],
            "option_b": en_opts["B"],
            "option_c": en_opts["C"],
            "option_d": en_opts["D"],
            "correct_answer": letter,
            "explanation": None,
            "question_text_ta": parsed["ta_stem"],
            "option_a_ta": ta_opts.get("A") if has_ta_opts else None,
            "option_b_ta": ta_opts.get("B") if has_ta_opts else None,
            "option_c_ta": ta_opts.get("C") if has_ta_opts else None,
            "option_d_ta": ta_opts.get("D") if has_ta_opts else None,
            "explanation_ta": None,
            "difficulty": "medium",
            "source_url": pdf_url,
        }
        rows.append(row)
    return rows


def main():
    print("Collecting detail links...", flush=True)
    detail_links = collect_detail_links()
    print(f"Found {len(detail_links)} detail pages.", flush=True)

    all_rows = []
    per_month = {}
    pdfs_processed = 0
    failed = []

    for durl in detail_links:
        pdf_url = extract_pdf_url(durl)
        if not pdf_url:
            failed.append((durl, "no pdf url"))
            continue

        month_year, year = month_year_from(pdf_url)
        if not month_year:
            month_year, year = month_year_from(durl)
        if not month_year:
            month_year, year = "Unknown", 0

        try:
            r = get(pdf_url)
            text = pdf_text(r.content)
        except Exception as e:
            failed.append((pdf_url, f"download/parse error: {e}"))
            print(f"[pdf] FAILED {pdf_url}: {e}", flush=True)
            continue

        rows = parse_pdf(text, pdf_url, month_year, year)
        pdfs_processed += 1
        per_month[month_year] = per_month.get(month_year, 0) + len(rows)
        all_rows.extend(rows)
        print(f"[pdf] {month_year}: parsed {len(rows)} questions "
              f"from {pdf_url}", flush=True)

    # Dedupe identical question_text across whole output
    seen_q = set()
    deduped = []
    for row in all_rows:
        q = row["question_text"]
        if q in seen_q:
            continue
        seen_q.add(q)
        deduped.append(row)

    bilingual = sum(1 for r in deduped if r["question_text_ta"])

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(deduped, f, ensure_ascii=False, indent=2)

    print("\n==== SUMMARY ====", flush=True)
    print(f"PDFs processed: {pdfs_processed}", flush=True)
    print(f"Total questions written: {len(deduped)} "
          f"(before dedupe: {len(all_rows)})", flush=True)
    print(f"Bilingual (Tamil stem present): {bilingual}", flush=True)
    print("Per-month counts:", flush=True)
    for k in sorted(per_month):
        print(f"  {k}: {per_month[k]}", flush=True)
    if failed:
        print("Failures:", flush=True)
        for u, why in failed:
            print(f"  {u} -> {why}", flush=True)
    print(f"Output: {OUTPUT_FILE}", flush=True)


if __name__ == "__main__":
    main()
