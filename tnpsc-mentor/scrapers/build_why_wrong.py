"""
Populate questions.why_wrong (jsonb) = { "<wrong letter>": "why it's wrong", ... }
so the app can show TARGETED feedback: "Your answer (B) is wrong because …".

Two phases, both anchored on the verified correct answer (Claude explains, never
decides — same anti-hallucination rule as generate_explanations.py):

  Phase 1 — PARSE (free): explanations we generated already contain
    "Why not the others: (A) …; (B) …; (D) …". Parse those per-letter clauses
    into the why_wrong map locally — no API cost.

  Phase 2 — GENERATE (Haiku by default): for questions whose explanation does
    NOT itemize per-option reasons (older scraped explanations), generate a
    one-line reason for each WRONG option via the Batches API + structured
    output. The existing `explanation` text is left untouched.

Prereq (run once in Supabase SQL editor):
    alter table questions add column if not exists why_wrong jsonb;

Env: scrapers/.env with SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY.
Model: EXPLANATION_MODEL env (default claude-haiku-4-5 — cheap, grounded task).
"""

import json
import os
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor

import anthropic
import requests
from dotenv import load_dotenv

# Reuse the proven transient-error backoff.
from generate_explanations import _retry

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

load_dotenv()
URL = (os.getenv("SUPABASE_URL") or "").rstrip("/")
KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or ""
MODEL = os.getenv("EXPLANATION_MODEL", "claude-haiku-4-5")

LETTERS = ["A", "B", "C", "D"]
MARKER = "Why not the others"


def _h(extra=None):
    h = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json"}
    if extra:
        h.update(extra)
    return h


def wrong_letters(correct):
    return [L for L in LETTERS if L != correct]


def parse_why_wrong(explanation, correct):
    """Extract {letter: reason} for each wrong option from a 'Why not the others'
    explanation. Returns None unless ALL wrong options are present (so we never
    store a partial map that would leave a wrong-picker with no feedback)."""
    if not explanation or MARKER not in explanation:
        return None
    seg = explanation.split(MARKER, 1)[1]
    pairs = re.findall(r"\(([A-D])\)\s*(.+?)(?=\s*;\s*\([A-D]\)|\s*$)", seg, flags=re.S)
    d = {L: t.strip().strip(".;: ").strip() for L, t in pairs}
    wrong = wrong_letters(correct)
    if all(d.get(L) for L in wrong):
        return {L: d[L] for L in wrong}
    return None


def fetch_all():
    cols = "id,question_text,option_a,option_b,option_c,option_d,correct_answer,explanation,why_wrong,subject,category"
    out, offset, page = [], 0, 1000
    while True:
        r = requests.get(
            f"{URL}/rest/v1/questions?select={cols}&limit={page}&offset={offset}",
            headers=_h(),
            timeout=60,
        )
        r.raise_for_status()
        rows = r.json()
        if not rows:
            break
        out.extend(rows)
        offset += page
        if len(rows) < page:
            break
    return out


def patch_why_wrong(qid, mapping):
    r = requests.patch(
        f"{URL}/rest/v1/questions?id=eq.{qid}",
        headers=_h({"Prefer": "return=minimal"}),
        json={"why_wrong": mapping},
        timeout=60,
    )
    return r.status_code in (200, 204)


def patch_many(items):
    """items: list of (qid, mapping). Threaded PATCH for speed."""
    ok = 0
    with ThreadPoolExecutor(max_workers=12) as ex:
        for success in ex.map(lambda t: patch_why_wrong(t[0], t[1]), items):
            ok += 1 if success else 0
    return ok


# ─── Phase 2: generation for non-itemized explanations ──────────────────────

SYSTEM = (
    "You are a TNPSC exam tutor. You are given a multiple-choice question, its "
    "options (A-D), and the VERIFIED correct option. For EACH WRONG option, give "
    "one concise sentence explaining why that option is incorrect — so a student "
    "who picked it understands their mistake.\n"
    "Rules: never contradict or cast doubt on the verified correct option. Be "
    "factually accurate; if unsure of a specific fact, explain the concept in "
    "general terms rather than inventing one. No preamble."
)


def build_request(q):
    wrong = wrong_letters(q["correct_answer"])
    schema = {
        "type": "object",
        "properties": {L: {"type": "string"} for L in wrong},
        "required": wrong,
        "additionalProperties": False,
    }
    opts = "\n".join(f"({L}) {q.get('option_'+L.lower(),'')}" for L in LETTERS)
    ans = q["correct_answer"]
    prompt = (
        f"Subject: {q.get('subject') or q.get('category') or 'General'}\n"
        f"Question: {q['question_text']}\n\nOptions:\n{opts}\n\n"
        f"VERIFIED correct option: ({ans}) {q.get('option_'+ans.lower(),'')}\n\n"
        f"Give a reason for each wrong option: {', '.join(wrong)}."
    )
    return {
        "custom_id": q["id"],
        "params": {
            "model": MODEL,
            "max_tokens": 600,
            "system": SYSTEM,
            "messages": [{"role": "user", "content": prompt}],
            "output_config": {"format": {"type": "json_schema", "schema": schema}},
        },
    }


def generate(rows, chunk=1000):
    client = anthropic.Anthropic()
    done = 0
    for i in range(0, len(rows), chunk):
        group = rows[i : i + chunk]
        print(f"\nGenerating why_wrong: batch {i//chunk + 1} ({len(group)})...")
        batch = _retry(
            lambda: client.messages.batches.create(requests=[build_request(q) for q in group]),
            "batch create",
        )
        print(f"  batch {batch.id} — polling...")
        while True:
            b = _retry(lambda: client.messages.batches.retrieve(batch.id), "poll")
            if b.processing_status == "ended":
                break
            time.sleep(30)
        updates = []
        for result in _retry(lambda: client.messages.batches.results(batch.id), "results"):
            if result.result.type != "succeeded":
                continue
            try:
                text = next(
                    (c.text for c in result.result.message.content if c.type == "text"), ""
                )
                mapping = {k: v.strip() for k, v in json.loads(text).items() if v and v.strip()}
                if mapping:
                    updates.append((result.custom_id, mapping))
            except Exception as e:  # noqa: BLE001
                print(f"    parse error {result.custom_id}: {e}")
        ok = patch_many(updates)
        done += ok
        print(f"  batch done: {ok}/{len(group)} written (total {done})")
    return done


def main():
    if not URL or not KEY:
        print("Missing Supabase env."); return
    if not os.getenv("ANTHROPIC_API_KEY"):
        print("Missing ANTHROPIC_API_KEY."); return
    print(f"Model (for generation phase): {MODEL}")
    print("Fetching questions...")
    rows = fetch_all()
    print(f"  {len(rows)} total.")

    parsed, need_gen = [], []
    for q in rows:
        if q.get("why_wrong"):  # already populated (resumable)
            continue
        m = parse_why_wrong(q.get("explanation"), q["correct_answer"])
        if m:
            parsed.append((q["id"], m))
        else:
            need_gen.append(q)

    print(f"\nPhase 1 — parse-backfill (free): {len(parsed)} questions")
    if parsed:
        ok = patch_many(parsed)
        print(f"  wrote {ok}/{len(parsed)} from existing explanations")

    print(f"\nPhase 2 — generate (Haiku): {len(need_gen)} questions")
    if need_gen:
        generate(need_gen)

    print("\nDone.")


if __name__ == "__main__":
    main()
