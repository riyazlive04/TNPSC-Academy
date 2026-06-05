"""
Loads real Tamil TNPSC MCQs from the Hugging Face dataset
`snegha24/Tamil_tnpscExam` (516 previous-year questions, Tamil text + 4 Tamil
options + answer index). No OCR/translation — these are genuine Tamil exam
questions pulled straight from past papers.

Fetched via the HF datasets-server REST API (no `datasets`/`pyarrow` install
needed). Mapped into our `questions` schema as Tamil-language PYQ rows:
  - question_text / option_* hold the Tamil text (so they always render)
  - group_type inferred from the source file name
  - subject distributed round-robin across that group's subjects (the dataset
    is mixed "general studies", so we spread it so every subject pill gets some
    Tamil practice content)

Output: tamil_questions.json
"""

import json
import time

import requests

DATASET = "snegha24/Tamil_tnpscExam"
BASE = "https://datasets-server.huggingface.co/rows"
HEADERS = {"User-Agent": "Mozilla/5.0"}

ANSWER_MAP = {"1": "A", "2": "B", "3": "C", "4": "D", "A": "A", "B": "B", "C": "C", "D": "D"}

GROUP_SUBJECTS = {
    "Group1": [
        "History and INM", "Polity", "History Culture Heritage of TN",
        "Development Administration of TamilNadu", "Biology", "Physics",
        "Chemistry", "Indian Economy", "Current Affairs", "Aptitude",
    ],
    "Group2_2A": [
        "History and INM", "Polity", "History Culture Heritage of TN", "Biology",
        "Physics", "Chemistry", "Indian Economy", "Current Affairs", "Aptitude",
    ],
    "Group4_VAO": [
        "History and INM", "Polity", "Biology", "Physics", "Chemistry",
        "Indian Economy", "Current Affairs", "Aptitude",
    ],
}


def infer_group(file_name: str) -> str:
    f = (file_name or "").lower()
    if "group-1" in f or "group1" in f:
        return "Group1"
    if "group-2" in f or "group2" in f:
        return "Group2_2A"
    return "Group4_VAO"  # group-4 / VAO / default


def fetch_all_rows():
    rows = []
    offset = 0
    page = 100
    while True:
        url = f"{BASE}?dataset={DATASET}&config=default&split=train&offset={offset}&length={page}"
        r = requests.get(url, headers=HEADERS, timeout=30)
        r.raise_for_status()
        data = r.json()
        batch = data.get("rows", [])
        if not batch:
            break
        rows.extend(x["row"] for x in batch)
        total = data.get("num_rows_total", 0)
        offset += page
        print(f"  fetched {len(rows)}/{total}")
        if offset >= total:
            break
        time.sleep(0.5)
    return rows


def build():
    print(f"Fetching {DATASET} ...")
    raw = fetch_all_rows()
    out = []
    counters = {g: 0 for g in GROUP_SUBJECTS}

    for r in raw:
        q = (r.get("question") or "").strip()
        opts = r.get("options") or []
        ans = ANSWER_MAP.get(str(r.get("answer", "")).strip(), None)
        if not q or len(opts) < 4 or ans is None:
            continue
        opts = [str(o).strip() for o in opts[:4]]
        if any(not o for o in opts):
            continue

        group = infer_group(r.get("file_name", ""))
        subjects = GROUP_SUBJECTS[group]
        subject = subjects[counters[group] % len(subjects)]
        counters[group] += 1

        out.append(
            {
                "category": "pyq",
                "group_type": group,
                "subject": subject,
                "topic": subject,
                "question_text": q,       # Tamil — always renders
                "option_a": opts[0],
                "option_b": opts[1],
                "option_c": opts[2],
                "option_d": opts[3],
                "correct_answer": ans,
                "explanation": "",
                "difficulty": "medium",
                "source_url": r.get("source", ""),
            }
        )

    with open("tamil_questions.json", "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)

    spread = {}
    for x in out:
        spread[x["group_type"]] = spread.get(x["group_type"], 0) + 1
    print(f"\nTotal Tamil questions: {len(out)}  spread={spread}")
    return out


if __name__ == "__main__":
    build()
