"""
Builds the TNPSC Previous-Year-style question bank for each Group + Subject.

Reliable clean MCQ sources for TNPSC subjects are scarce (Winmeen/tnpscguru
render quizzes via JS and block scrapers). IndiaBix General Knowledge, however,
exposes well-structured, answer + explanation MCQs that map directly onto the
TNPSC Group I/II/IV subjects — and it uses the exact markup parsed in
`indiabix_common`. We therefore source PYQ-style questions from the matching
IndiaBix GK sections and tag them with the TNPSC group_type + subject.

Group -> subject availability mirrors src/lib/constants.ts.
Output: pyq_questions.json
"""

import json
import time

from indiabix_common import scrape_section

# TNPSC subject -> IndiaBix section slug(s). Multiple sources per subject +
# deep pagination push the per-subject volume up toward the 10k target.
SUBJECT_SOURCES = {
    "History and INM": [
        "general-knowledge/indian-history",
        "general-knowledge/world-organisations",
        "general-knowledge/days-and-years",
    ],
    "Polity": [
        "general-knowledge/indian-politics",
        "general-knowledge/basic-general-knowledge",
    ],
    # No TN-specific IndiaBix section exists; Indian history + culture are the
    # closest clean sources for TN history/heritage questions.
    "History Culture Heritage of TN": [
        "general-knowledge/indian-culture",
        "general-knowledge/indian-history",
        "general-knowledge/books-and-authors",
        "general-knowledge/famous-personalities",
    ],
    "Development Administration of TamilNadu": [
        "general-knowledge/indian-politics",
        "general-knowledge/indian-economy",
        "general-knowledge/indian-geography",
    ],
    "Biology": ["general-knowledge/biology", "general-knowledge/general-science"],
    "Physics": ["general-knowledge/physics", "general-knowledge/general-science"],
    "Chemistry": ["general-knowledge/chemistry", "general-knowledge/general-science"],
    "Indian Economy": [
        "general-knowledge/indian-economy",
        "general-knowledge/basic-general-knowledge",
    ],
    "Current Affairs": [
        "general-knowledge/basic-general-knowledge",
        "general-knowledge/honours-and-awards",
        "general-knowledge/sports",
        "general-knowledge/inventions",
        "general-knowledge/technology",
    ],
    "Aptitude": [
        "aptitude/simplification",
        "aptitude/percentage",
        "aptitude/profit-and-loss",
        "aptitude/average",
        "aptitude/numbers",
    ],
}

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


def scrape_subject(group, subject):
    sources = SUBJECT_SOURCES.get(subject, [])
    questions = []
    seen = set()
    for path in sources:
        section, slug = path.split("/", 1)
        rows = scrape_section(section, slug, max_pages=14)
        for r in rows:
            key = r["question_text"][:80]
            if key in seen:
                continue
            seen.add(key)
            r = dict(r)
            r.update(
                {
                    "category": "pyq",
                    "group_type": group,
                    "subject": subject,
                    "topic": subject,
                }
            )
            questions.append(r)
        time.sleep(1)
    return questions


def scrape_all_pyq():
    all_questions = []
    # Scrape each unique subject once, then clone rows per group that uses it,
    # so we don't hammer IndiaBix 3x for the same content.
    subject_cache = {}
    for group, subjects in GROUP_SUBJECTS.items():
        for subject in subjects:
            print(f"Scraping {group} — {subject}...")
            if subject in subject_cache:
                base_rows = subject_cache[subject]
            else:
                base_rows = scrape_subject(group, subject)
                subject_cache[subject] = base_rows
            # Re-tag cached rows for this group.
            rows = []
            for r in base_rows:
                r = dict(r)
                r["group_type"] = group
                rows.append(r)
            print(f"  Found {len(rows)} questions")
            all_questions.extend(rows)

    with open("pyq_questions.json", "w", encoding="utf-8") as f:
        json.dump(all_questions, f, ensure_ascii=False, indent=2)

    print(f"\nTotal PYQ questions: {len(all_questions)}")
    return all_questions


if __name__ == "__main__":
    scrape_all_pyq()
