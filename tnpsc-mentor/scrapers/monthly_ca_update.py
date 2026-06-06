"""
Production monthly Current-Affairs updater (designed to run on a schedule).

What it does, idempotently, every run:
  1. Computes the current + previous month automatically (no hard-coded list).
  2. Scrapes that month's current-affairs MCQs + refreshes the topic-wise sets
     (reuses the validated GKToday quizbase parser in current_affairs_scraper).
  3. De-duplicates against what's already in Supabase (by question text per
     month/topic) and inserts ONLY new questions via the REST API.

Source-extensible: add more scrapers to SOURCES without touching the cron glue.

Runs locally (reads scrapers/.env) or in CI (reads env vars). In GitHub Actions
it's scheduled monthly via .github/workflows/monthly-ca.yml using repo secrets
SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.

Env:
    SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
"""

import datetime
import json
import os
import sys

import requests
from dotenv import load_dotenv

# Reuse the proven GKToday parser/scrapers.
from current_affairs_scraper import TOPIC_SOURCES, scrape_month, scrape_topic

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

load_dotenv()
URL = (os.getenv("SUPABASE_URL") or "").rstrip("/")
KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or ""

ALLOWED = {
    "category", "ca_month", "ca_year", "ca_type", "ca_topic", "subject",
    "question_text", "option_a", "option_b", "option_c", "option_d",
    "correct_answer", "explanation", "difficulty", "source_url",
}


def _h(extra=None):
    h = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json"}
    if extra:
        h.update(extra)
    return h


def recent_months(n=2):
    """Current month + previous (n-1) months, as (slug, label, year)."""
    out = []
    d = datetime.date.today().replace(day=1)
    for _ in range(n):
        out.append((d.strftime("%B-%Y").lower(), d.strftime("%B %Y"), d.year))
        d = (d - datetime.timedelta(days=1)).replace(day=1)
    return out


def existing_question_texts(filter_q: str) -> set:
    """Fetch existing question_text values matching a PostgREST filter."""
    texts = set()
    offset = 0
    while True:
        r = requests.get(
            f"{URL}/rest/v1/questions?{filter_q}&select=question_text&limit=1000&offset={offset}",
            headers=_h(),
            timeout=60,
        )
        if r.status_code != 200:
            break
        batch = r.json()
        if not batch:
            break
        texts.update((row.get("question_text") or "").strip() for row in batch)
        if len(batch) < 1000:
            break
        offset += 1000
    return texts


def insert_new(rows):
    if not rows:
        return 0
    clean = [{k: v for k, v in r.items() if k in ALLOWED} for r in rows]
    inserted = 0
    for i in range(0, len(clean), 100):
        batch = clean[i : i + 100]
        resp = requests.post(
            f"{URL}/rest/v1/questions",
            headers=_h({"Prefer": "return=minimal"}),
            data=json.dumps(batch),
            timeout=90,
        )
        if resp.status_code in (200, 201, 204):
            inserted += len(batch)
        else:
            print(f"  insert failed [{resp.status_code}]: {resp.text[:200]}")
    return inserted


def update_months():
    total = 0
    for slug, label, year in recent_months(2):
        print(f"Month: {label}")
        scraped = scrape_month(slug, label, year)
        if not scraped:
            print("  (no questions published yet)")
            continue
        seen = existing_question_texts(
            f"category=eq.current_affairs&ca_type=eq.month_wise&ca_month=eq.{requests.utils.quote(label)}"
        )
        fresh = [q for q in scraped if (q["question_text"] or "").strip() not in seen]
        n = insert_new(fresh)
        print(f"  scraped {len(scraped)}, new {len(fresh)}, inserted {n}")
        total += n
    return total


def refresh_topics():
    total = 0
    for slug, label in TOPIC_SOURCES.items():
        scraped = scrape_topic(slug, label)
        if not scraped:
            continue
        seen = existing_question_texts(
            f"category=eq.current_affairs&ca_type=eq.topic_wise&ca_topic=eq.{requests.utils.quote(label)}"
        )
        fresh = [q for q in scraped if (q["question_text"] or "").strip() not in seen]
        n = insert_new(fresh)
        if n:
            print(f"Topic {label}: +{n}")
        total += n
    return total


def main():
    if not URL or not KEY:
        print("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY"); sys.exit(1)
    print(f"Target: {URL}")
    added = update_months() + refresh_topics()
    print(f"\nDone. Added {added} new current-affairs questions.")


if __name__ == "__main__":
    main()
