"""
Scrapes monthly current affairs MCQs from GKToday.

Months: August 2025 -> June 2026
URL pattern: https://www.gktoday.in/current-affairs-mcq/{month-slug}/

Each MCQ on GKToday lives inside a `.wp-block-group` (or article) and contains:
  - a question paragraph
  - an <ol>/<ul> of options (<li>)
  - an "Answer:" / "Correct Answer:" marker followed by the option letter or text

Output: current_affairs_questions.json
"""

import json
import re
import time

import requests
from bs4 import BeautifulSoup

HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}

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

# Curated topic categories (also surfaced in the frontend as defaults).
TOPIC_CATEGORIES = [
    "Science & Technology",
    "Sports",
    "Economy & Finance",
    "Government Schemes",
    "International Affairs",
    "Awards & Honours",
    "Appointments",
    "Environment",
    "Defence",
    "Tamil Nadu",
]


def _clean(text: str) -> str:
    return " ".join((text or "").split())


def _answer_letter_from(text: str, option_texts):
    """Resolve the correct answer to an A/B/C/D letter."""
    text = text or ""
    # Direct letter, e.g. "Answer: B"
    m = re.search(r"answer[:\s]*\[?([ABCD])\b", text, re.I)
    if m:
        return m.group(1).upper()
    # Otherwise try to match the answer text to one of the options.
    m = re.search(r"answer[:\s]*(.+)", text, re.I)
    if m:
        ans_text = _clean(m.group(1)).lower()
        for idx, opt in enumerate(option_texts):
            if ans_text and (ans_text in opt.lower() or opt.lower() in ans_text):
                return ["A", "B", "C", "D"][idx]
    return "A"


def scrape_gktoday_mcq(month_slug, ca_month, ca_year):
    url = f"https://www.gktoday.in/current-affairs-mcq/{month_slug}/"
    questions = []

    try:
        resp = requests.get(url, headers=HEADERS, timeout=20)
        if resp.status_code != 200:
            print(f"  HTTP {resp.status_code} for {url}")
            return questions
        soup = BeautifulSoup(resp.content, "lxml")

        # Question containers: GKToday wraps each MCQ in a group/article block.
        containers = soup.select(".wp-block-group, article .entry-content > div")
        for q_div in containers:
            try:
                # Question text — first paragraph with reasonable length.
                q_text = ""
                for p in q_div.find_all("p"):
                    candidate = _clean(p.get_text(" ", strip=True))
                    if len(candidate) >= 10:
                        q_text = candidate
                        break
                if not q_text:
                    continue

                option_els = q_div.find_all("li")
                if len(option_els) < 4:
                    continue
                option_texts = [_clean(o.get_text(" ", strip=True)) for o in option_els[:4]]
                if any(not o for o in option_texts):
                    continue

                # Answer marker — search the block text.
                block_text = q_div.get_text(" ", strip=True)
                answer = _answer_letter_from(block_text, option_texts)

                # Explanation — often after "Notes:" or "Explanation:".
                explanation = ""
                em = re.search(r"(notes?|explanation)[:\s]+(.+)", block_text, re.I)
                if em:
                    explanation = _clean(em.group(2))[:1000]

                questions.append(
                    {
                        "category": "current_affairs",
                        "ca_month": ca_month,
                        "ca_year": ca_year,
                        "ca_type": "month_wise",
                        "subject": "Current Affairs",
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
                )
            except Exception as e:  # noqa: BLE001
                print(f"    Error parsing a question: {e}")
                continue
    except Exception as e:  # noqa: BLE001
        print(f"  Error scraping {month_slug}: {e}")

    return questions


def scrape_all_current_affairs():
    all_questions = []
    for slug, month_label, year in MONTHS:
        print(f"Scraping {month_label}...")
        questions = scrape_gktoday_mcq(slug, month_label, year)
        print(f"  Found {len(questions)} questions")
        all_questions.extend(questions)
        time.sleep(2)

    with open("current_affairs_questions.json", "w", encoding="utf-8") as f:
        json.dump(all_questions, f, ensure_ascii=False, indent=2)

    print(f"\nTotal current affairs questions: {len(all_questions)}")
    return all_questions


if __name__ == "__main__":
    scrape_all_current_affairs()
