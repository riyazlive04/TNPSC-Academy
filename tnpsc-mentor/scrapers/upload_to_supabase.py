"""
Upload scraped JSON files to the Supabase `questions` table.
Run after the scrapers have produced their JSON output.

Requires scrapers/.env with:
    SUPABASE_URL=...
    SUPABASE_SERVICE_ROLE_KEY=...   (service role — bypasses RLS for bulk insert)
"""

import json
import os

from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

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


def _sanitize(row: dict) -> dict:
    return {k: v for k, v in row.items() if k in ALLOWED_COLUMNS}


def upload_file(supabase, filename, label):
    try:
        with open(filename, "r", encoding="utf-8") as f:
            data = json.load(f)
    except FileNotFoundError:
        print(f"⚠️  {filename} not found. Run the scraper first.")
        return
    except json.JSONDecodeError as e:
        print(f"❌ {filename} is not valid JSON: {e}")
        return

    if not data:
        print(f"⚠️  {filename} is empty — nothing to upload.")
        return

    rows = [_sanitize(r) for r in data]
    print(f"Uploading {len(rows)} {label} questions...")

    inserted = 0
    for i in range(0, len(rows), BATCH_SIZE):
        batch = rows[i : i + BATCH_SIZE]
        try:
            supabase.table("questions").insert(batch).execute()
            inserted += len(batch)
            print(f"  Batch {i // BATCH_SIZE + 1}: inserted {len(batch)} rows")
        except Exception as e:  # noqa: BLE001
            print(f"  ❌ Batch {i // BATCH_SIZE + 1} failed: {e}")

    print(f"✅ {label}: {inserted}/{len(rows)} rows uploaded\n")


def main():
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        print(
            "❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. "
            "Set them in scrapers/.env"
        )
        return

    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    upload_file(supabase, "aptitude_questions.json", "Aptitude")
    upload_file(supabase, "current_affairs_questions.json", "Current Affairs")
    upload_file(supabase, "pyq_questions.json", "PYQ")
    upload_file(supabase, "samacheer_questions.json", "Samacheer")
    print("🎉 All uploads complete!")


if __name__ == "__main__":
    main()
