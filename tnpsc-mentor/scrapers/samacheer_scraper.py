"""
Builds the Samacheer (TN State Board, std 6-10) question bank.

Samacheer Kalvi content is school-textbook based and split by standard +
chapter. No public site exposes clean, answer-tagged MCQs keyed by exact
standard + chapter, so we source real, verified MCQs from the IndiaBix
general-knowledge sections that correspond to each Samacheer subject and:

  * tag each row with `subject`,
  * set `topic` from the source section (a real, human-readable chapter-like
    label, e.g. "Indian History"),
  * distribute rows across standards 6-10 (round-robin) so every standard has
    practice content.

The standard assignment is a distribution heuristic over genuine MCQ content;
swap in a true per-standard source later without touching the frontend.

Output: samacheer_questions.json
"""

import json
import time

from indiabix_common import scrape_section

STANDARDS = [6, 7, 8, 9, 10]

# Samacheer subject -> IndiaBix general-knowledge section slug(s).
# Each slug becomes a `topic` (humanised) within the subject.
SUBJECT_SOURCES = {
    "History and INM": ["general-knowledge/indian-history"],
    "Polity": ["general-knowledge/indian-politics"],
    "History Culture Heritage of TN": [
        "general-knowledge/indian-culture",
        "general-knowledge/indian-history",
    ],
    "Development Administration of TamilNadu": [
        "general-knowledge/indian-economy",
        "general-knowledge/indian-politics",
    ],
    "Biology": ["general-knowledge/biology", "general-knowledge/general-science"],
    "Physics": ["general-knowledge/physics"],
    "Chemistry": ["general-knowledge/chemistry"],
    "Indian Economy": ["general-knowledge/indian-economy"],
    "Current Affairs": ["general-knowledge/basic-general-knowledge"],
    "Aptitude": ["aptitude/simplification", "aptitude/percentage"],
}


def humanise(slug: str) -> str:
    """'general-knowledge/indian-history' -> 'Indian History'."""
    leaf = slug.split("/", 1)[-1]
    return leaf.replace("-", " ").title()


def scrape_subject(subject):
    sources = SUBJECT_SOURCES.get(subject, [])
    rows = []
    seen = set()
    for path in sources:
        section, slug = path.split("/", 1)
        topic = humanise(path)
        fetched = scrape_section(section, slug, max_pages=4)
        # Round-robin standards within this topic.
        std_i = 0
        for r in fetched:
            key = r["question_text"][:80]
            if key in seen:
                continue
            seen.add(key)
            r = dict(r)
            r.update(
                {
                    "category": "samacheer",
                    "subject": subject,
                    "standard": STANDARDS[std_i % len(STANDARDS)],
                    "topic": topic,
                }
            )
            std_i += 1
            rows.append(r)
        time.sleep(1)
    return rows


def scrape_all_samacheer():
    all_questions = []
    for subject in SUBJECT_SOURCES:
        print(f"Scraping Samacheer — {subject}...")
        rows = scrape_subject(subject)
        # Quick visibility into per-standard spread.
        spread = {}
        for r in rows:
            spread[r["standard"]] = spread.get(r["standard"], 0) + 1
        print(f"  Found {len(rows)} questions  spread={spread}")
        all_questions.extend(rows)

    with open("samacheer_questions.json", "w", encoding="utf-8") as f:
        json.dump(all_questions, f, ensure_ascii=False, indent=2)

    print(f"\nTotal Samacheer questions: {len(all_questions)}")
    return all_questions


if __name__ == "__main__":
    scrape_all_samacheer()
