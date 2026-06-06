"""
Export the full question bank to one Markdown document PER CATEGORY, formatted
the same way the app presents a question (stem, options A-D with the correct one
marked, explanation), with the SOURCE link printed below every question.

Output: tnpsc-mentor/docs/question-bank/<category>.md
  - pyq.md, samacheer.md, aptitude.md, current_affairs.md
  - plus an index README.md

Env: scrapers/.env with SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (read-only use).
"""

import os
import sys
from collections import defaultdict

import requests
from dotenv import load_dotenv

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

load_dotenv()
URL = (os.getenv("SUPABASE_URL") or "").rstrip("/")
KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or ""

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "docs", "question-bank")
LETTERS = ["A", "B", "C", "D"]

CATEGORY_TITLES = {
    "pyq": "Previous Year Questions",
    "samacheer": "Samacheer Kalvi (State Board)",
    "aptitude": "Aptitude & Reasoning",
    "current_affairs": "Current Affairs",
}


def _h():
    return {"apikey": KEY, "Authorization": f"Bearer {KEY}"}


def fetch_all():
    out, off, page = [], 0, 1000
    while True:
        r = requests.get(
            f"{URL}/rest/v1/questions?select=*&order=subject,topic,id&limit={page}&offset={off}",
            headers=_h(),
            timeout=60,
        )
        r.raise_for_status()
        rows = r.json()
        if not rows:
            break
        out.extend(rows)
        off += page
        if len(rows) < page:
            break
    return out


def group_label(q) -> str:
    """Secondary heading a question is filed under, per category."""
    c = q.get("category")
    if c == "pyq":
        return q.get("subject") or "General"
    if c == "samacheer":
        subj = q.get("subject") or "General"
        std = q.get("standard")
        return f"{subj} — Standard {std}" if std else subj
    if c == "aptitude":
        t = (q.get("aptitude_type") or "").title()
        topic = q.get("aptitude_topic") or q.get("topic") or "General"
        return f"{t}: {topic}" if t else topic
    if c == "current_affairs":
        if q.get("ca_type") == "month_wise":
            return f"Monthly — {q.get('ca_month') or 'Undated'}"
        return f"Topic — {q.get('ca_topic') or 'General'}"
    return q.get("subject") or "General"


def render_question(q, n) -> str:
    lines = [f"**Q{n}. {q['question_text'].strip()}**", ""]
    for L in LETTERS:
        opt = (q.get(f"option_{L.lower()}") or "").strip()
        mark = "  ✅ **(correct answer)**" if q.get("correct_answer") == L else ""
        lines.append(f"- **{L}.** {opt}{mark}")
    lines.append("")
    expl = (q.get("explanation") or "").strip()
    if expl:
        lines.append(f"**Explanation:** {expl}")
        lines.append("")
    src = (q.get("source_url") or "").strip()
    if src:
        lines.append(f"*Source: [{src}]({src})*")
    lines.append("\n---\n")
    return "\n".join(lines)


def source_domains(rows):
    doms = set()
    for q in rows:
        s = q.get("source_url") or ""
        if "//" in s:
            doms.add(s.split("//", 1)[1].split("/", 1)[0])
    return sorted(doms)


def write_category(cat, rows):
    rows = sorted(rows, key=lambda q: (group_label(q), q.get("id")))
    groups = defaultdict(list)
    for q in rows:
        groups[group_label(q)].append(q)

    title = CATEGORY_TITLES.get(cat, cat)
    doms = source_domains(rows)
    out = [
        f"# {title}",
        "",
        f"**Category code:** `{cat}`  ",
        f"**Total questions:** {len(rows)}  ",
        f"**Sources:** {', '.join(doms) if doms else 'n/a'}  ",
        "",
        "> Every question below shows its options (correct answer marked ✅), the "
        "explanation, and a direct link to the source it was collected from.",
        "",
        "## Contents",
        "",
    ]
    for g in sorted(groups):
        anchor = g.lower().replace(" ", "-").replace(":", "").replace("—", "").replace("--", "-")
        out.append(f"- {g} ({len(groups[g])})")
    out.append("\n---\n")

    n = 0
    for g in sorted(groups):
        out.append(f"## {g}\n")
        for q in groups[g]:
            n += 1
            out.append(render_question(q, n))

    path = os.path.join(OUT_DIR, f"{cat}.md")
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(out))
    return path, len(rows), doms


def main():
    if not URL or not KEY:
        print("Missing Supabase env."); return
    os.makedirs(OUT_DIR, exist_ok=True)
    print("Fetching all questions...")
    rows = fetch_all()
    print(f"  {len(rows)} fetched.")

    by_cat = defaultdict(list)
    for q in rows:
        by_cat[q.get("category") or "uncategorised"].append(q)

    index = [
        "# TNPSC Mentor — Question Bank Export",
        "",
        f"Total: **{len(rows)}** questions across **{len(by_cat)}** categories. "
        "Each category is a separate document; every question lists its source link.",
        "",
        "| Category | Document | Questions | Sources |",
        "|---|---|---|---|",
    ]
    for cat in sorted(by_cat, key=lambda c: -len(by_cat[c])):
        path, cnt, doms = write_category(cat, by_cat[cat])
        fname = os.path.basename(path)
        title = CATEGORY_TITLES.get(cat, cat)
        index.append(f"| {title} | [{fname}](./{fname}) | {cnt} | {', '.join(doms)} |")
        print(f"  wrote {fname}: {cnt} questions")

    with open(os.path.join(OUT_DIR, "README.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(index) + "\n")
    print(f"\nDone. Files in: {os.path.normpath(OUT_DIR)}")


if __name__ == "__main__":
    main()
