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

# slug -> (aptitude_type, topic_name) — names match the frontend constants.
TOPIC_MAP = {
    "simplification": ("numerics", "Simplification"),
    "profit-and-loss": ("numerics", "Profit and Loss"),
    "percentage": ("numerics", "Percentage"),
    "ratio-and-proportion": ("numerics", "Ratio and Proportion"),
    "problems-on-hcf-and-lcm": ("numerics", "LCM & HCF"),
    "area": ("numerics", "Area and Volume"),
    "volume-and-surface-area": ("numerics", "Area and Volume"),
    "simple-interest": ("numerics", "Simple Interest & Compound Interest"),
    "compound-interest": ("numerics", "Simple Interest & Compound Interest"),
    "time-and-work": ("numerics", "Time and Work"),
    "progressions": ("numerics", "A.P & G.P"),
    "square-root-and-cube-root": ("numerics", "Square Root & Cube Root"),
    "surds-and-indices": ("numerics", "Surds"),
    "logarithm": ("numerics", "Logs and Exponents"),
    # Reasoning
    "number-series": ("reasoning", "Logical Number Series"),
    "letter-and-symbol-series": ("reasoning", "Logical Alphabet Series"),
    "analogizing": ("reasoning", "Analogy"),
    "analogy": ("reasoning", "Analogy"),
    "cube-and-dice": ("reasoning", "Dice"),
    "number-puzzles": ("reasoning", "Puzzles"),
    "mathematical-operations": ("reasoning", "Mathematical Operators"),
}


def _clean(text: str) -> str:
    return " ".join((text or "").split())


def scrape_indiabix_topic(slug, aptitude_type, topic_name, max_pages=5):
    base_url = f"https://www.indiabix.com/aptitude/{slug}/"
    questions = []

    for page in range(1, max_pages + 1):
        # IndiaBix paginates as /aptitude/{slug}/0{page}0 (e.g. 020, 030 ...).
        url = base_url if page == 1 else f"{base_url}0{page}0"
        try:
            resp = requests.get(url, headers=HEADERS, timeout=15)
            if resp.status_code != 200:
                break
            soup = BeautifulSoup(resp.content, "lxml")

            blocks = soup.select(".bix-div-container")
            if not blocks:
                break

            for block in blocks:
                try:
                    q_el = block.select_one(".bix-td-qtxt")
                    if not q_el:
                        continue
                    q_text = _clean(q_el.get_text(" ", strip=True))

                    option_els = block.select(".bix-td-option .bix-td-option-val")
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
            print(f"  Error fetching page {page} of {slug}: {e}")
            break

    return questions


def scrape_all_aptitude():
    all_questions = []
    for slug, (apt_type, topic_name) in TOPIC_MAP.items():
        print(f"Scraping {topic_name} ({slug})...")
        questions = scrape_indiabix_topic(slug, apt_type, topic_name)
        print(f"  Found {len(questions)} questions")
        all_questions.extend(questions)
        time.sleep(2)

    with open("aptitude_questions.json", "w", encoding="utf-8") as f:
        json.dump(all_questions, f, ensure_ascii=False, indent=2)

    print(f"\nTotal aptitude questions: {len(all_questions)}")
    return all_questions


if __name__ == "__main__":
    scrape_all_aptitude()
