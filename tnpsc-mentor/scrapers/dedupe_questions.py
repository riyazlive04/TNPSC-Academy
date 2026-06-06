"""
Remove duplicate questions (same question_text) from the bank, keeping the most
complete copy. The old PYQ scraper stored the same question once per group
(Group1/2/4); under the new subject-membership model those copies are redundant.

"Most complete" = scores points for having an explanation, why_wrong, Tamil
(question_text_ta), and a longer explanation — so we never drop the richest row.

Safe by default: prints what it WOULD delete. Pass --apply to actually delete.
Env: scrapers/.env with SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
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


def _h(extra=None):
    h = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json"}
    if extra:
        h.update(extra)
    return h


def fetch_all():
    cols = "id,question_text,explanation,why_wrong,question_text_ta,explanation_ta,category"
    out, off = [], 0
    while True:
        r = requests.get(
            f"{URL}/rest/v1/questions?select={cols}&limit=1000&offset={off}",
            headers=_h(), timeout=60,
        )
        r.raise_for_status()
        rows = r.json()
        if not rows:
            break
        out.extend(rows)
        off += 1000
        if len(rows) < 1000:
            break
    return out


def score(q):
    s = 0
    if q.get("explanation"):
        s += 4 + min(len(q["explanation"]) // 200, 5)
    if q.get("why_wrong"):
        s += 4
    if q.get("question_text_ta"):
        s += 3
    if q.get("explanation_ta"):
        s += 2
    return s


def delete_ids(ids):
    n = 0
    for i in range(0, len(ids), 100):
        chunk = ids[i:i + 100]
        lst = ",".join(chunk)
        r = requests.delete(
            f"{URL}/rest/v1/questions?id=in.({lst})",
            headers=_h({"Prefer": "return=minimal"}), timeout=90,
        )
        if r.status_code in (200, 204):
            n += len(chunk)
        else:
            print(f"  delete failed [{r.status_code}]: {r.text[:160]}")
    return n


def main(apply):
    if not URL or not KEY:
        print("Missing Supabase env."); return
    rows = fetch_all()
    print(f"Fetched {len(rows)} rows.")
    groups = defaultdict(list)
    for q in rows:
        key = (q.get("question_text") or "").strip().lower()
        if key:
            groups[key].append(q)

    to_delete = []
    dup_groups = 0
    for key, items in groups.items():
        if len(items) < 2:
            continue
        dup_groups += 1
        items.sort(key=score, reverse=True)  # best first
        to_delete.extend(q["id"] for q in items[1:])  # drop all but the best

    print(f"Duplicate groups: {dup_groups}  |  rows to delete: {len(to_delete)}")
    print(f"Bank after cleanup: {len(rows) - len(to_delete)}")
    if not apply:
        print("\n(dry-run) re-run with --apply to delete.")
        return
    deleted = delete_ids(to_delete)
    print(f"\nDeleted {deleted} duplicate rows.")


if __name__ == "__main__":
    main("--apply" in sys.argv)
