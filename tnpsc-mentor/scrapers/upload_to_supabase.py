"""
Upload scraped JSON files to the Supabase `questions` table.
Run after the scrapers have produced their JSON output.

Uses the Supabase REST (PostgREST) endpoint directly via `requests`, which
avoids version-coupling issues between supabase-py / gotrue / httpx.

Requires scrapers/.env with:
    SUPABASE_URL=...
    SUPABASE_SERVICE_ROLE_KEY=...   (service role — bypasses RLS for bulk insert)
"""

import json
import os
import sys

import requests
from dotenv import load_dotenv

# Windows consoles default to cp1252 and choke on non-ASCII output. Force UTF-8
# so progress messages never crash the run.
try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:  # noqa: BLE001
    pass

load_dotenv()

SUPABASE_URL = (os.getenv("SUPABASE_URL") or "").rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or ""

# Columns that exist on the `questions` table — anything else is stripped so a
# stray scraper key never breaks the insert.
ALLOWED_COLUMNS = {
    "category",
    "group_type",
    "year",
    "standard",
    "ca_month",
    "ca_year",
    "ca_type",
    "ca_topic",
    "aptitude_type",
    "aptitude_topic",
    "subject",
    "topic",
    "question_text",
    "option_a",
    "option_b",
    "option_c",
    "option_d",
    "correct_answer",
    "explanation",
    "difficulty",
    "source_url",
}

BATCH_SIZE = 100


def _headers():
    return {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }


def _sanitize(row: dict) -> dict:
    return {k: v for k, v in row.items() if k in ALLOWED_COLUMNS}


def upload_file(filename, label):
    try:
        with open(filename, "r", encoding="utf-8") as f:
            data = json.load(f)
    except FileNotFoundError:
        print(f"⚠️  {filename} not found. Run the scraper first.")
        return 0
    except json.JSONDecodeError as e:
        print(f"❌ {filename} is not valid JSON: {e}")
        return 0

    if not data:
        print(f"⚠️  {filename} is empty — nothing to upload.")
        return 0

    rows = [_sanitize(r) for r in data]
    print(f"Uploading {len(rows)} {label} questions...")

    endpoint = f"{SUPABASE_URL}/rest/v1/questions"
    inserted = 0
    for i in range(0, len(rows), BATCH_SIZE):
        batch = rows[i : i + BATCH_SIZE]
        try:
            resp = requests.post(
                endpoint, headers=_headers(), data=json.dumps(batch), timeout=60
            )
            if resp.status_code in (200, 201, 204):
                inserted += len(batch)
                print(f"  Batch {i // BATCH_SIZE + 1}: inserted {len(batch)} rows")
            else:
                print(
                    f"  ❌ Batch {i // BATCH_SIZE + 1} failed "
                    f"[HTTP {resp.status_code}]: {resp.text[:300]}"
                )
        except Exception as e:  # noqa: BLE001
            print(f"  ❌ Batch {i // BATCH_SIZE + 1} error: {e}")

    print(f"✅ {label}: {inserted}/{len(rows)} rows uploaded\n")
    return inserted


def current_count():
    """Return the current row count in the questions table (or None)."""
    try:
        resp = requests.get(
            f"{SUPABASE_URL}/rest/v1/questions",
            headers={**_headers(), "Prefer": "count=exact", "Range": "0-0"},
            timeout=30,
        )
        cr = resp.headers.get("content-range", "")
        if "/" in cr:
            return cr.split("/")[-1]
    except Exception:  # noqa: BLE001
        pass
    return None


def main():
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        print(
            "❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. "
            "Set them in scrapers/.env"
        )
        return

    print(f"Target: {SUPABASE_URL}")
    print(f"Rows before upload: {current_count()}\n")

    total = 0
    total += upload_file("aptitude_questions.json", "Aptitude")
    total += upload_file("current_affairs_questions.json", "Current Affairs")
    total += upload_file("pyq_questions.json", "PYQ")
    total += upload_file("samacheer_questions.json", "Samacheer")

    print(f"🎉 All uploads complete! Inserted {total} rows this run.")
    print(f"Rows after upload: {current_count()}")


if __name__ == "__main__":
    main()
