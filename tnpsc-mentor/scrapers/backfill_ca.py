"""
One-off backfill: re-scrape EVERY GKToday current-affairs quiz (all months +
all topics) with the new pagination fix, and insert the questions that were
missed when we only read page 1 (10 of ~50 per month, ~18 of ~78 per topic).

Dedupe safety: a question already in the DB may have been PARAPHRASED (its stored
text now differs from GKToday's verbatim text). So we treat a scraped question as
"already present" if its text matches either (a) what's in the DB for that
month/topic, or (b) the verbatim originals saved in paraphrase_backup.jsonl. This
prevents paraphrased page-1 questions from being re-inserted as duplicates.

Env: scrapers/.env with SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
"""

import json
import os
import sys

import requests

from current_affairs_scraper import MONTHS, TOPIC_SOURCES, scrape_month, scrape_topic
from monthly_ca_update import existing_question_texts, insert_new

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass


def backup_originals():
    """Verbatim question texts of rows we've already paraphrased."""
    s = set()
    p = os.path.join(os.path.dirname(__file__), "paraphrase_backup.jsonl")
    if os.path.exists(p):
        with open(p, encoding="utf-8") as f:
            for line in f:
                try:
                    s.add((json.loads(line).get("question_text") or "").strip())
                except Exception:
                    pass
    return s


def main():
    bk = backup_originals()
    print(f"Known paraphrased-originals: {len(bk)}")
    total = 0

    print("\n=== MONTHS ===")
    for slug, label, year in MONTHS:
        scraped = scrape_month(slug, label, year)
        if not scraped:
            print(f"  {label}: (not published / none)")
            continue
        seen = existing_question_texts(
            f"category=eq.current_affairs&ca_type=eq.month_wise"
            f"&ca_month=eq.{requests.utils.quote(label)}"
        )
        fresh = [
            q for q in scraped
            if q["question_text"].strip() not in seen
            and q["question_text"].strip() not in bk
        ]
        n = insert_new(fresh)
        print(f"  {label}: scraped {len(scraped)}, new {len(fresh)}, inserted {n}")
        total += n

    print("\n=== TOPICS ===")
    for slug, label in TOPIC_SOURCES.items():
        scraped = scrape_topic(slug, label)
        if not scraped:
            print(f"  {label}: none")
            continue
        seen = existing_question_texts(
            f"category=eq.current_affairs&ca_type=eq.topic_wise"
            f"&ca_topic=eq.{requests.utils.quote(label)}"
        )
        fresh = [
            q for q in scraped
            if q["question_text"].strip() not in seen
            and q["question_text"].strip() not in bk
        ]
        n = insert_new(fresh)
        print(f"  {label}: scraped {len(scraped)}, new {len(fresh)}, inserted {n}")
        total += n

    print(f"\nTOTAL new current-affairs questions inserted: {total}")


if __name__ == "__main__":
    main()
