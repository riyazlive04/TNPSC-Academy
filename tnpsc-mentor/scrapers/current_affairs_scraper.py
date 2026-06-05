"""
Scrapes current affairs MCQs from GKToday's quizbase.

GKToday exposes quizzes at:
  - Month wise:  https://www.gktoday.in/quizbase/current-affairs-quiz-{month}-{year}
  - Topic wise:  https://www.gktoday.in/quizbase/{topic}-current-affairs

Each quiz page renders 10 MCQs. Per question:
  - `.wp_quiz_question`          -> "1. <question>" (+ inline options)
  - `.wp_quiz_question_options`  -> "[A] .. [B] .. [C] .. [D] .."
  - `.wp_basic_quiz_answer`      -> "Correct Answer: C [text] Notes: <explanation>"
  - `.answer_hint`               -> "Notes: <explanation>"

Output: current_affairs_questions.json
"""

import json
import re
import time

import requests
from bs4 import BeautifulSoup

HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}

BASE = "https://www.gktoday.in/quizbase"

# (url-slug, label, year) — slug appended to current-affairs-quiz-
MONTHS = [
    ("august-2025", "August 2025", 2025),
    ("september-2025", "September 2025", 2025),
    ("october-2025", "October 2025", 2025),
    ("november-2025", "November 2025", 2025),
    ("december-2025", "December 2025", 2025),
    ("january-2026", "January 2026", 2026),
    ("february-2026", "February 2026", 2026),
    ("march-2026", "March 2026", 2026),
    ("april-2026", "April 2026", 2026),
    ("may-2026", "May 2026", 2026),
    ("june-2026", "June 2026", 2026),
]

# GKToday topic quizbase slug -> TNPSC-facing topic label.
TOPIC_SOURCES = {
    "science-technology-current-affairs": "Science & Technology",
    "sports-current-affairs": "Sports",
    "business-economy-banking-current-affairs": "Economy & Finance",
    "government-schemes-current-affairs": "Government Schemes",
    "international-current-affairs": "International Affairs",
    "awards-honours-persons-in-news-current-affairs": "Awards & Honours",
    "environment-biodiversity-current-affairs": "Environment",
    "defence-current-affairs": "Defence",
    "india-government-politics-current-affairs": "Polity & Governance",
    "places-in-news-current-affairs": "Places in News",
}

OPT_RE = re.compile(r"\[\s*([ABCD])\s*\]\s*(.*?)(?=\[\s*[ABCD]\s*\]|$)", re.S)
ANS_RE = re.compile(r"Correct Answer\s*[:\-]?\s*\[?\s*([ABCD])", re.I)


def _clean(text: str) -> str:
    return " ".join((text or "").split())


def parse_quiz_page(soup, common):
    """Parse the 10 MCQs on a GKToday quizbase page into question dicts."""
    questions = []
    blocks = soup.select(".sques_quiz, .wp_quiz_question")
    # `.sques_quiz` wraps a full question (Q + options + answer); fall back to
    # iterating question text nodes if the wrapper class is absent.
    if soup.select(".sques_quiz"):
        wrappers = soup.select(".sques_quiz")
    else:
        wrappers = blocks

    for w in wrappers:
        try:
            q_el = w.select_one(".wp_quiz_question")
            opt_el = w.select_one(".wp_quiz_question_options")
            ans_el = w.select_one(".wp_basic_quiz_answer")
            hint_el = w.select_one(".answer_hint")
            if not q_el or not opt_el:
                continue

            # Question text — strip the leading "N." and any trailing options.
            q_raw = q_el.get_text(" ", strip=True)
            opt_raw = opt_el.get_text(" ", strip=True)
            q_text = q_raw.replace(opt_raw, "").strip()
            q_text = re.sub(r"^\s*\d+\.\s*", "", q_text)
            q_text = _clean(q_text)
            if len(q_text) < 8:
                continue

            # Options — parse the "[A] .. [B] .. [C] .. [D] .." string.
            opts = {m.group(1).upper(): _clean(m.group(2)) for m in OPT_RE.finditer(opt_raw)}
            option_texts = [opts.get(k, "") for k in ["A", "B", "C", "D"]]
            if any(not o for o in option_texts):
                continue

            # Answer letter.
            ans_text = ans_el.get_text(" ", strip=True) if ans_el else ""
            m = ANS_RE.search(ans_text)
            answer = m.group(1).upper() if m else "A"

            # Explanation — prefer the answer_hint "Notes:" content.
            explanation = ""
            if hint_el:
                explanation = _clean(hint_el.get_text(" ", strip=True))
            elif ans_text:
                em = re.search(r"Notes?\s*[:\-]\s*(.+)", ans_text, re.I)
                if em:
                    explanation = _clean(em.group(1))
            explanation = re.sub(r"^Notes?\s*[:\-]\s*", "", explanation)[:1500]

            row = {
                "question_text": q_text,
                "option_a": option_texts[0],
                "option_b": option_texts[1],
                "option_c": option_texts[2],
                "option_d": option_texts[3],
                "correct_answer": answer,
                "explanation": explanation,
                "difficulty": "medium",
            }
            row.update(common)
            questions.append(row)
        except Exception as e:  # noqa: BLE001
            print(f"    Error parsing a question: {e}")
            continue

    return questions


def _fetch(url):
    resp = requests.get(url, headers=HEADERS, timeout=20)
    if resp.status_code != 200:
        print(f"  HTTP {resp.status_code} for {url}")
        return None
    return BeautifulSoup(resp.content, "lxml")


def scrape_month(slug, label, year):
    url = f"{BASE}/current-affairs-quiz-{slug}"
    soup = _fetch(url)
    if soup is None:
        return []
    common = {
        "category": "current_affairs",
        "ca_month": label,
        "ca_year": year,
        "ca_type": "month_wise",
        "subject": "Current Affairs",
        "source_url": url,
    }
    return parse_quiz_page(soup, common)


def scrape_topic(slug, label):
    url = f"{BASE}/{slug}"
    soup = _fetch(url)
    if soup is None:
        return []
    common = {
        "category": "current_affairs",
        "ca_type": "topic_wise",
        "ca_topic": label,
        "subject": "Current Affairs",
        "source_url": url,
    }
    return parse_quiz_page(soup, common)


def scrape_all_current_affairs():
    all_questions = []

    print("=== MONTH WISE ===")
    for slug, label, year in MONTHS:
        print(f"Scraping {label}...")
        qs = scrape_month(slug, label, year)
        print(f"  Found {len(qs)} questions")
        all_questions.extend(qs)
        time.sleep(1.5)

    print("\n=== TOPIC WISE ===")
    for slug, label in TOPIC_SOURCES.items():
        print(f"Scraping {label}...")
        qs = scrape_topic(slug, label)
        print(f"  Found {len(qs)} questions")
        all_questions.extend(qs)
        time.sleep(1.5)

    with open("current_affairs_questions.json", "w", encoding="utf-8") as f:
        json.dump(all_questions, f, ensure_ascii=False, indent=2)

    print(f"\nTotal current affairs questions: {len(all_questions)}")
    return all_questions


if __name__ == "__main__":
    scrape_all_current_affairs()
