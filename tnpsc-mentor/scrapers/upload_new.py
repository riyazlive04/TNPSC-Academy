"""
Upload a scraped questions JSON to Supabase, deduped against the existing bank
by question_text. Inserts all supported columns including the Tamil (_ta) mirrors.

Usage: python upload_new.py <file1.json> [file2.json ...]
Env: scrapers/.env with SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
"""

import json
import os
import sys

import requests
from dotenv import load_dotenv

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

load_dotenv()
URL = (os.getenv("SUPABASE_URL") or "").rstrip("/")
KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or ""

ALLOWED = {
    "category", "group_type", "year", "standard", "ca_month", "ca_year", "ca_type",
    "ca_topic", "aptitude_type", "aptitude_topic", "subject", "topic",
    "question_text", "option_a", "option_b", "option_c", "option_d",
    "correct_answer", "explanation", "difficulty", "source_url",
    "question_text_ta", "option_a_ta", "option_b_ta", "option_c_ta",
    "option_d_ta", "explanation_ta",
}


def _h(extra=None):
    h = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json"}
    if extra:
        h.update(extra)
    return h


def existing_texts():
    texts, off = set(), 0
    while True:
        r = requests.get(
            f"{URL}/rest/v1/questions?select=question_text&limit=1000&offset={off}",
            headers=_h(), timeout=60,
        )
        r.raise_for_status()
        rows = r.json()
        if not rows:
            break
        texts.update((q.get("question_text") or "").strip() for q in rows)
        off += 1000
        if len(rows) < 1000:
            break
    return texts


def insert(rows):
    # PostgREST bulk insert requires every object to share the SAME keys, so
    # normalise each row to the union of allowed keys used across the set
    # (missing -> None), rather than dropping nulls per-row.
    keys = sorted({k for r in rows for k in r if k in ALLOWED})
    clean = [{k: r.get(k) for k in keys} for r in rows]
    n = 0
    for i in range(0, len(clean), 100):
        batch = clean[i:i + 100]
        resp = requests.post(
            f"{URL}/rest/v1/questions",
            headers=_h({"Prefer": "return=minimal"}),
            data=json.dumps(batch), timeout=90,
        )
        if resp.status_code in (200, 201, 204):
            n += len(batch)
        else:
            print(f"  insert failed [{resp.status_code}]: {resp.text[:200]}")
    return n


def main(files):
    if not URL or not KEY:
        print("Missing Supabase env."); return
    print("Loading existing question texts for dedupe...")
    seen = existing_texts()
    print(f"  {len(seen)} existing.")
    grand = 0
    for f in files:
        rows = json.load(open(f, encoding="utf-8"))
        fresh, local = [], set()
        for q in rows:
            t = (q.get("question_text") or "").strip()
            if not t or t in seen or t in local:
                continue
            local.add(t); fresh.append(q)
        n = insert(fresh)
        seen.update(local)
        grand += n
        print(f"{os.path.basename(f)}: {len(rows)} in file, {len(fresh)} new, inserted {n}")
    print(f"\nTotal inserted: {grand}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("usage: python upload_new.py <file.json> [...]")
    else:
        main(sys.argv[1:])
