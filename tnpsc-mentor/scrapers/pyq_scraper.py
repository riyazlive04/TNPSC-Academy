"""
Scrapes TNPSC Previous Year Questions from winmeen.com online-test pages.

Group -> subject mapping mirrors the frontend (src/lib/constants.ts).

Winmeen online tests render questions in blocks; the exact markup varies, so
this scraper tries several common selectors and falls back gracefully. A
question block is expected to contain:
  - question text
  - four option list items
  - a marker for the correct option (class containing 'correct' or a data attr)
  - an optional explanation block

Output: pyq_questions.json
"""

import json
import time

import requests
from bs4 import BeautifulSoup

HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}

GROUP_SUBJECTS = {
    "Group1": [
        "History and INM",
        "Polity",
        "History Culture Heritage of TN",
        "Development Administration of TamilNadu",
        "Biology",
        "Physics",
        "Chemistry",
        "Indian Economy",
        "Current Affairs",
        "Aptitude",
    ],
    "Group2_2A": [
        "History and INM",
        "Polity",
        "History Culture Heritage of TN",
        "Biology",
        "Physics",
        "Chemistry",
        "Indian Economy",
        "Current Affairs",
        "Aptitude",
    ],
    "Group4_VAO": [
        "History and INM",
        "Polity",
        "Biology",
        "Physics",
        "Chemistry",
        "Indian Economy",
        "Current Affairs",
        "Aptitude",
    ],
}


def _clean(text: str) -> str:
    return " ".join((text or "").split())


def _subject_slug(subject: str) -> str:
    return subject.lower().replace("&", "and").replace(" ", "-")


def _group_slug(group: str) -> str:
    # Group1 -> group-1, Group2_2A -> group-2, Group4_VAO -> group-4
    mapping = {"Group1": "group-1", "Group2_2A": "group-2", "Group4_VAO": "group-4"}
    return mapping.get(group, group.lower())


def scrape_tnpsc_winmeen(group, subject):
    group_slug = _group_slug(group)
    subject_slug = _subject_slug(subject)
    # Candidate URL patterns — try each until one yields questions.
    candidate_urls = [
        f"https://www.winmeen.com/tnpsc-{group_slug}-{subject_slug}-online-test/",
        f"https://www.winmeen.com/tnpsc-{subject_slug}-online-test/",
        f"https://www.winmeen.com/{group_slug}-{subject_slug}-questions/",
    ]

    questions = []
    for url in candidate_urls:
        try:
            resp = requests.get(url, headers=HEADERS, timeout=20)
            if resp.status_code != 200:
                continue
            soup = BeautifulSoup(resp.content, "lxml")

            blocks = soup.select(
                ".question-block, .quiz-question, .wp-block-group, li.question"
            )
            for q_block in blocks:
                try:
                    q_el = (
                        q_block.select_one("p.question")
                        or q_block.select_one(".question-text")
                        or q_block.find("p")
                    )
                    if not q_el:
                        continue
                    q_text = _clean(q_el.get_text(" ", strip=True))
                    if len(q_text) < 8:
                        continue

                    option_els = q_block.select("li.option, .answer-option, li")
                    option_texts = [
                        _clean(o.get_text(" ", strip=True)) for o in option_els
                    ]
                    option_texts = [o for o in option_texts if o][:4]
                    if len(option_texts) < 4:
                        continue

                    # Correct option detection.
                    correct_letter = "A"
                    correct_el = q_block.select_one(
                        "li.correct, .option.correct, .answer-option.correct"
                    )
                    if correct_el is not None and correct_el in option_els:
                        idx = option_els.index(correct_el)
                        if idx < 4:
                            correct_letter = ["A", "B", "C", "D"][idx]

                    explain_el = q_block.select_one(
                        ".explanation, .answer-explanation, .ans-desc"
                    )
                    explanation = (
                        _clean(explain_el.get_text(" ", strip=True))
                        if explain_el
                        else ""
                    )

                    questions.append(
                        {
                            "category": "pyq",
                            "group_type": group,
                            "subject": subject,
                            "question_text": q_text,
                            "option_a": option_texts[0],
                            "option_b": option_texts[1],
                            "option_c": option_texts[2],
                            "option_d": option_texts[3],
                            "correct_answer": correct_letter,
                            "explanation": explanation,
                            "difficulty": "medium",
                            "source_url": url,
                        }
                    )
                except Exception as e:  # noqa: BLE001
                    print(f"    Error parsing a question: {e}")
                    continue

            if questions:
                break  # stop trying other URL patterns once we have results
        except Exception as e:  # noqa: BLE001
            print(f"  Error: {url} — {e}")
            continue

    return questions


def scrape_all_pyq():
    all_questions = []
    for group, subjects in GROUP_SUBJECTS.items():
        for subject in subjects:
            print(f"Scraping {group} — {subject}...")
            questions = scrape_tnpsc_winmeen(group, subject)
            print(f"  Found {len(questions)} questions")
            all_questions.extend(questions)
            time.sleep(1.5)

    with open("pyq_questions.json", "w", encoding="utf-8") as f:
        json.dump(all_questions, f, ensure_ascii=False, indent=2)

    print(f"\nTotal PYQ questions: {len(all_questions)}")
    return all_questions


if __name__ == "__main__":
    scrape_all_pyq()
