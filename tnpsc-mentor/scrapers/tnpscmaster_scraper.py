"""
Scrape TNPSC Master (https://tnpscmaster.in) — bilingual (EN+TA) topic-wise TNPSC
MCQs with four options, the correct-answer index, AND explanations.

It's a Next.js (App Router) site: the question data is embedded as React Server
Component (RSC) stream chunks, not in the DOM. We request each topic URL with the
`RSC: 1` header (returns text/x-component), reconstruct the stream, locate the
`{"...","questions":[...]}` object, and resolve lazy `$NN` text refs.

Maps the site's subjects onto the app's canonical subject names (extended to the
full TNPSC syllabus: + Geography, General Science, General Tamil, General English).
Output category = "pyq"; questions are subject-tagged and shown per-group by
subject membership (no stored group_type needed).

Output: tnpscmaster_questions.json
"""

import json
import re
import sys
import time

import requests
from bs4 import BeautifulSoup

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

BASE = "https://tnpscmaster.in"
H = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120",
}
LETTERS = ["A", "B", "C", "D"]

# site subject slug -> (app canonical subject, optional fixed topic override)
SUBJECT_MAP = {
    "general-science": "General Science",
    "physics": "Physics",
    "chemistry": "Chemistry",
    "biology": "Biology",
    "geography-of-india": "Geography",
    "history-and-culture-of-india": "History and INM",
    "indian-national-movement": "History and INM",
    "indian-polity": "Polity",
    "indian-economy": "Indian Economy",
    "history-culture-heritage-and-socio-political-movements-in-tamil-nadu":
        "History Culture Heritage of TN",
    "development-administration-in-tamil-nadu": "Development Administration of TamilNadu",
    "aptitude-and-mental-ability": "Aptitude",
    "general-tamil-unit-1": "General Tamil",
    "general-tamil-unit-2": "General Tamil",
    "general-tamil-unit-3": "General Tamil",
    "general-tamil-unit-4": "General Tamil",
    "general-tamil-unit-5": "General Tamil",
    "general-tamil-unit-6": "General Tamil",
    "general-tamil-unit-7": "General Tamil",
    "grammar": "General English",
    "vocabulary": "General English",
    "writing-skills": "General English",
    "technical-terms": "General English",
    "reading-comprehension": "General English",
    "translation": "General English",
    "literary-works-figures-of-speech-appreciation-and-analysis-of-poetry-lines-of-significance":
        "General English",
}


def _humanize(slug):
    return slug.replace("-", " ").title()


def fetch_topics(subject_slug):
    """Topic slugs under a subject (links with exactly 3 path segments)."""
    r = requests.get(f"{BASE}/subjects/{subject_slug}", headers=H, timeout=30)
    if r.status_code != 200:
        return []
    soup = BeautifulSoup(r.content, "lxml")
    topics = set()
    pat = re.compile(rf"^/subjects/{re.escape(subject_slug)}/([^/?#]+)/?$")
    for a in soup.find_all("a", href=True):
        m = pat.match(a["href"])
        if m:
            topics.add(m.group(1))
    return sorted(topics)


def _collect_stream(body):
    """Reconstruct the RSC text stream from either a raw x-component body or
    an HTML page embedding self.__next_f.push([1,"..."]) chunks."""
    chunks = re.findall(r'self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)', body, re.S)
    if chunks:
        try:
            return "".join(json.loads(c) for c in chunks)
        except Exception:
            pass
    return body


def _build_refs(stream):
    """Map RSC line id -> resolved text for 'id:T<hexlen>,<text>' blobs."""
    refs = {}
    for m in re.finditer(r'(?:^|\n)([0-9a-f]+):T([0-9a-f]+),', stream):
        rid = m.group(1)
        length = int(m.group(2), 16)
        start = m.end()
        refs[rid] = stream[start:start + length]
    return refs


def _resolve(val, refs):
    if isinstance(val, str) and val.startswith("$"):
        return refs.get(val[1:], "")
    return val or ""


def parse_questions(body):
    stream = _collect_stream(body)
    refs = _build_refs(stream)
    idx = stream.find('"questions"')
    if idx < 0:
        return []
    dec = json.JSONDecoder()
    obj = None
    cand = idx
    for _ in range(60):
        b = stream.rfind("{", 0, cand)
        if b < 0:
            break
        try:
            parsed, _end = dec.raw_decode(stream[b:])
            if isinstance(parsed, dict) and "questions" in parsed:
                obj = parsed
                break
        except Exception:
            pass
        cand = b
    if not obj:
        return []

    out = []
    for q in obj.get("questions") or []:
        try:
            qn = q.get("question") or {}
            en = _resolve(qn.get("en"), refs).strip()
            ta = _resolve(qn.get("ta"), refs).strip()
            opts = q.get("options") or []
            if len(opts) < 4:
                continue
            oen = [_resolve((opts[i] or {}).get("en"), refs).strip() for i in range(4)]
            ota = [_resolve((opts[i] or {}).get("ta"), refs).strip() for i in range(4)]
            ci = q.get("correctAnswer")
            if not isinstance(ci, int) or not (0 <= ci <= 3):
                continue
            if not en or any(not o for o in oen):
                continue
            exp = q.get("explanation") or {}
            eed = _resolve(exp.get("en"), refs).strip()
            eta = _resolve(exp.get("ta"), refs).strip()
            out.append({
                "question_text": en, "question_text_ta": ta or None,
                "option_a": oen[0], "option_b": oen[1], "option_c": oen[2], "option_d": oen[3],
                "option_a_ta": ota[0] or None, "option_b_ta": ota[1] or None,
                "option_c_ta": ota[2] or None, "option_d_ta": ota[3] or None,
                "correct_answer": LETTERS[ci],
                "explanation": eed or None, "explanation_ta": eta or None,
            })
        except Exception as e:  # noqa: BLE001
            print(f"    q parse error: {e}")
    return out


def fetch_topic(subject_slug, topic_slug):
    url = f"{BASE}/subjects/{subject_slug}/{topic_slug}"
    r = requests.get(url, headers={**H, "RSC": "1"}, timeout=30)
    if r.status_code != 200:
        return [], url
    rows = parse_questions(r.text)
    return rows, url


def scrape_all(subject_limit=None, topic_limit=None):
    all_rows = []
    subjects = list(SUBJECT_MAP)
    if subject_limit:
        subjects = subjects[:subject_limit]
    for slug in subjects:
        app_subject = SUBJECT_MAP[slug]
        topics = fetch_topics(slug)
        if topic_limit:
            topics = topics[:topic_limit]
        print(f"{slug} -> {app_subject}: {len(topics)} topics")
        for t in topics:
            rows, url = fetch_topic(slug, t)
            for r in rows:
                r.update({
                    "category": "pyq",
                    "subject": app_subject,
                    "topic": _humanize(t),
                    "difficulty": "medium",
                    "source_url": url,
                })
            all_rows.extend(rows)
            time.sleep(0.5)
        print(f"  {app_subject}: cumulative {len(all_rows)} questions")
    with open("tnpscmaster_questions.json", "w", encoding="utf-8") as f:
        json.dump(all_rows, f, ensure_ascii=False, indent=2)
    print(f"\nTotal: {len(all_rows)} questions -> tnpscmaster_questions.json")
    return all_rows


if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--subjects", type=int, default=None)
    ap.add_argument("--topics", type=int, default=None)
    args = ap.parse_args()
    scrape_all(subject_limit=args.subjects, topic_limit=args.topics)
