"""
Shared IndiaBix scraping utilities.

IndiaBix renders MCQs identically across all sections (aptitude, general-
knowledge, logical-reasoning, verbal-reasoning, non-verbal-reasoning). Each
question lives in a `.bix-div-container`:
  - question text -> `.bix-td-qtxt`
  - options       -> `.bix-td-option-val`  (the `.bix-td-option` cell is empty)
  - answer        -> hidden input `.jq-hdnakq` (value = A/B/C/D)
  - explanation   -> `.bix-ans-description`

Pagination uses numeric links like /{section}/{slug}/004002 which we discover
and follow from the page itself.
"""

import re
import time

import requests
from bs4 import BeautifulSoup

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"
    )
}


def clean(text: str) -> str:
    return " ".join((text or "").split())


def _discover_page_urls(soup, section, slug):
    pat = re.compile(rf"/{re.escape(section)}/{re.escape(slug)}/\d{{6}}$")
    urls = []
    for a in soup.select("a[href]"):
        href = a.get("href", "")
        if pat.search(href):
            full = href if href.startswith("http") else f"https://www.indiabix.com{href}"
            if full not in urls:
                urls.append(full)
    return urls


def _parse_block(block, url):
    q_el = block.select_one(".bix-td-qtxt")
    if not q_el:
        return None
    q_text = clean(q_el.get_text(" ", strip=True))

    option_els = block.select(".bix-td-option-val") or block.select(".bix-td-option")
    option_texts = [clean(o.get_text(" ", strip=True)) for o in option_els]
    option_texts = [o for o in option_texts if o][:4]
    if len(option_texts) < 4 or not q_text:
        return None

    answer_el = block.select_one(".jq-hdnakq")
    answer = "A"
    if answer_el and answer_el.get("value"):
        answer = answer_el["value"].strip().upper()
    if answer not in ("A", "B", "C", "D"):
        answer = "A"

    explain_el = block.select_one(".bix-ans-description")
    explanation = clean(explain_el.get_text(" ", strip=True)) if explain_el else ""

    return {
        "question_text": q_text,
        "option_a": option_texts[0],
        "option_b": option_texts[1],
        "option_c": option_texts[2],
        "option_d": option_texts[3],
        "correct_answer": answer,
        "explanation": explanation,
        "difficulty": "medium",
        "source_url": url,
    }


def scrape_section(section, slug, max_pages=8):
    """Scrape one IndiaBix section/slug (following pagination). Returns a list
    of base question dicts (no category-specific fields yet)."""
    base_url = f"https://www.indiabix.com/{section}/{slug}/"
    questions = []
    visited = set()
    queue = [base_url]

    while queue and len(visited) < max_pages:
        url = queue.pop(0)
        if url in visited:
            continue
        visited.add(url)
        try:
            resp = requests.get(url, headers=HEADERS, timeout=15)
            if resp.status_code != 200:
                continue
            soup = BeautifulSoup(resp.content, "lxml")

            for u in _discover_page_urls(soup, section, slug):
                if u not in visited and u not in queue:
                    queue.append(u)

            for block in soup.select(".bix-div-container"):
                try:
                    row = _parse_block(block, url)
                    if row:
                        questions.append(row)
                except Exception as e:  # noqa: BLE001
                    print(f"    Error parsing a question: {e}")
                    continue

            time.sleep(1)
        except Exception as e:  # noqa: BLE001
            print(f"  Error fetching {url}: {e}")
            continue

    return questions
