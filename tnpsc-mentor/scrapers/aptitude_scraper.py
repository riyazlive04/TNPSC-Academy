"""
Scrapes aptitude questions from IndiaBix.

Topics: Simplification, Profit and Loss, Percentage,
        Ratio and Proportion, LCM and HCF, etc.

URL pattern: https://www.indiabix.com/aptitude/{topic}/

IndiaBix renders each question inside a `.bix-div-container` block:
  - question text   -> `.bix-td-qtxt`
  - four options     -> `.bix-td-option`
  - correct answer   -> hidden input `.jq-hdnakq` (value attribute = A/B/C/D)
  - explanation      -> `.bix-ans-description`

Output: aptitude_questions.json
"""

import json
import os
import re
import time

import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv

load_dotenv()

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"
    )
}

# Frontend topic -> (aptitude_type, [(section, slug), ...])
# IndiaBix splits content across four sections; reasoning topics do NOT live
# under /aptitude/. Each frontend topic is sourced from one or more pages
# (verified reachable). Names match src/lib/constants.ts exactly.
TOPIC_SOURCES = {
    # ── Numerics ──────────────────────────────────────────────────────────
    "Simplification": ("numerics", [("aptitude", "simplification")]),
    "Profit and Loss": ("numerics", [("aptitude", "profit-and-loss")]),
    "Percentage": ("numerics", [("aptitude", "percentage")]),
    "Ratio and Proportion": ("numerics", [("aptitude", "ratio-and-proportion")]),
    "LCM & HCF": ("numerics", [("aptitude", "problems-on-hcf-and-lcm")]),
    "Area and Volume": (
        "numerics",
        [("aptitude", "area"), ("aptitude", "volume-and-surface-area")],
    ),
    "Simple Interest & Compound Interest": (
        "numerics",
        [("aptitude", "simple-interest"), ("aptitude", "compound-interest")],
    ),
    "Time and Work": ("numerics", [("aptitude", "time-and-work")]),
    # IndiaBix has no dedicated A.P/G.P page; "numbers" carries numeric
    # sequence problems and is the closest available source.
    "A.P & G.P": ("numerics", [("aptitude", "numbers")]),
    "Square Root & Cube Root": ("numerics", [("aptitude", "square-root-and-cube-root")]),
    "Surds": ("numerics", [("aptitude", "surds-and-indices")]),
    "Logs and Exponents": ("numerics", [("aptitude", "logarithm")]),
    # ── Reasoning ─────────────────────────────────────────────────────────
    "Logical Number Series": ("reasoning", [("logical-reasoning", "number-series")]),
    "Logical Alphabet Series": (
        "reasoning",
        [("logical-reasoning", "letter-and-symbol-series")],
    ),
    "Alpha-Numeric Reasoning": (
        "reasoning",
        [("verbal-reasoning", "series-completion")],
    ),
    "Analogy": (
        "reasoning",
        [("verbal-reasoning", "analogy"), ("non-verbal-reasoning", "analogy")],
    ),
    "Dice": ("reasoning", [("non-verbal-reasoning", "cubes-and-dice")]),
    "Puzzles": (
        "reasoning",
        [
            ("verbal-reasoning", "character-puzzles"),
            ("logical-reasoning", "logical-problems"),
        ],
    ),
    "No of Figures": (
        "reasoning",
        [
            ("non-verbal-reasoning", "classification"),
            ("non-verbal-reasoning", "figure-matrix"),
        ],
    ),
    "Mathematical Operators": (
        "reasoning",
        [("verbal-reasoning", "arithmetic-reasoning")],
    ),
}


def _clean(text: str) -> str:
    return " ".join((text or "").split())


def _discover_page_urls(soup, section, slug):
    """IndiaBix paginates with numeric links like /{section}/{slug}/004002.
    Collect those from the current page so we can follow them."""
    pat = re.compile(rf"/{re.escape(section)}/{re.escape(slug)}/\d{{6}}$")
    urls = []
    for a in soup.select("a[href]"):
        href = a.get("href", "")
        if pat.search(href):
            full = href if href.startswith("http") else f"https://www.indiabix.com{href}"
            if full not in urls:
                urls.append(full)
    return urls


def scrape_indiabix_source(section, slug, aptitude_type, topic_name, max_pages=8):
    """Scrape one IndiaBix section/slug page (following its pagination)."""
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

            # Discover further pages from the first page we load.
            for u in _discover_page_urls(soup, section, slug):
                if u not in visited and u not in queue:
                    queue.append(u)

            blocks = soup.select(".bix-div-container")
            if not blocks:
                continue

            for block in blocks:
                try:
                    q_el = block.select_one(".bix-td-qtxt")
                    if not q_el:
                        continue
                    q_text = _clean(q_el.get_text(" ", strip=True))

                    # The visible option text lives in `.bix-td-option-val`
                    # (the `.bix-td-option` cell itself is an empty wrapper).
                    option_els = block.select(".bix-td-option-val")
                    if not option_els:
                        option_els = block.select(".bix-td-option")
                    option_texts = [_clean(o.get_text(" ", strip=True)) for o in option_els]
                    option_texts = [o for o in option_texts if o][:4]

                    answer_el = block.select_one(".jq-hdnakq")
                    answer_letter = "A"
                    if answer_el and answer_el.get("value"):
                        answer_letter = answer_el["value"].strip().upper()

                    explain_el = block.select_one(".bix-ans-description")
                    explanation = (
                        _clean(explain_el.get_text(" ", strip=True)) if explain_el else ""
                    )

                    if len(option_texts) >= 4 and q_text:
                        questions.append(
                            {
                                "category": "aptitude",
                                "aptitude_type": aptitude_type,
                                "aptitude_topic": topic_name,
                                "subject": "Aptitude",
                                "question_text": q_text,
                                "option_a": option_texts[0],
                                "option_b": option_texts[1],
                                "option_c": option_texts[2],
                                "option_d": option_texts[3],
                                "correct_answer": answer_letter
                                if answer_letter in ["A", "B", "C", "D"]
                                else "A",
                                "explanation": explanation,
                                "difficulty": "medium",
                                "source_url": url,
                            }
                        )
                except Exception as e:  # noqa: BLE001
                    print(f"    Error parsing a question: {e}")
                    continue

            time.sleep(1)
        except Exception as e:  # noqa: BLE001
            print(f"  Error fetching {url}: {e}")
            continue

    return questions


def scrape_all_aptitude():
    all_questions = []
    for topic_name, (apt_type, sources) in TOPIC_SOURCES.items():
        print(f"Scraping {topic_name} [{apt_type}]...")
        topic_questions = []
        for section, slug in sources:
            qs = scrape_indiabix_source(section, slug, apt_type, topic_name)
            print(f"    {section}/{slug}: {len(qs)}")
            topic_questions.extend(qs)
            time.sleep(1)
        print(f"  Found {len(topic_questions)} questions")
        all_questions.extend(topic_questions)
        time.sleep(1)

    with open("aptitude_questions.json", "w", encoding="utf-8") as f:
        json.dump(all_questions, f, ensure_ascii=False, indent=2)

    print(f"\nTotal aptitude questions: {len(all_questions)}")
    return all_questions


if __name__ == "__main__":
    scrape_all_aptitude()
