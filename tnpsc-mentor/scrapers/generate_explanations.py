"""
Fill missing / placeholder explanations using Claude — honestly and cheaply.

Many scraped questions have no real explanation (e.g. the IndiaBix placeholder
"No answer description is available. Let's discuss."). This script generates a
factual explanation for each such question that:
  * explains WHY the verified-correct option is correct, and
  * briefly explains WHY EACH OTHER option is wrong (so an aspirant who picked a
    wrong answer learns why their choice was incorrect).

Anti-hallucination design (the whole point):
  * The correct answer is ALREADY KNOWN (it came verified from the source). We
    pass it to Claude as fixed ground truth — Claude EXPLAINS, it does not pick.
  * The model is instructed to never contradict the given answer, and to explain
    a concept in general terms rather than invent a specific fact (date, number,
    name) it isn't sure of. No wrong guidance.

Efficiency / cost:
  * Uses the Message Batches API (50% cheaper, built for bulk, non-latency work).
  * Structured output (json_schema) so the result is clean text, no preamble.

Model: defaults to claude-opus-4-8 (highest quality). Override with the
EXPLANATION_MODEL env var (e.g. claude-haiku-4-5) to cut cost ~5x for this
simple, grounded task.

Requires scrapers/.env with ANTHROPIC_API_KEY (+ SUPABASE_URL,
SUPABASE_SERVICE_ROLE_KEY) and:  pip install anthropic
"""

import json
import os
import sys
import time

import anthropic
import requests
from dotenv import load_dotenv

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

load_dotenv()
URL = (os.getenv("SUPABASE_URL") or "").rstrip("/")
KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or ""
MODEL = os.getenv("EXPLANATION_MODEL", "claude-opus-4-8")

# Markers that indicate "no real explanation present".
PLACEHOLDERS = ("no answer description", "let's discuss", "let us discuss")
MIN_LEN = 25  # explanations shorter than this are treated as missing

SCHEMA = {
    "type": "object",
    "properties": {"explanation": {"type": "string"}},
    "required": ["explanation"],
    "additionalProperties": False,
}

SYSTEM = (
    "You are a TNPSC exam tutor writing answer explanations for aspirants.\n"
    "You are given a multiple-choice question, its four options (A-D), and the "
    "VERIFIED correct option. Your job is to EXPLAIN, not to decide.\n\n"
    "Write a single explanation that:\n"
    "1. States, in 1-2 sentences, why the correct option is correct.\n"
    "2. Then, briefly (one short clause each), says why each of the OTHER three "
    "options is wrong — so a student who picked a wrong option understands their "
    "mistake. Format that part as: 'Why not the others: (X) reason; (Y) reason; (Z) reason.'\n\n"
    "Strict rules:\n"
    "- The correct answer is fixed and verified. NEVER contradict it or imply a "
    "different option is correct.\n"
    "- Be factually accurate. If you are not sure of a specific fact (a date, "
    "number, or name), explain the underlying concept in general terms rather "
    "than inventing a specific — never state a fact you are unsure of.\n"
    "- Keep it concise (about 3-5 sentences total), neutral, and exam-appropriate.\n"
    "- No preamble, no 'Sure', no markdown headers."
)

LETTERS = ["A", "B", "C", "D"]


def _h(extra=None):
    h = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json"}
    if extra:
        h.update(extra)
    return h


def _retry(fn, what, tries=6):
    """Call fn() with exponential backoff on transient Anthropic/network errors.

    The Batches API occasionally returns transient edge errors (520/529/500) or
    drops a connection; these are retryable. A whole batch is expensive to lose,
    so we back off and retry rather than crash the run.
    """
    delay = 30
    for attempt in range(1, tries + 1):
        try:
            return fn()
        except (anthropic.APIStatusError, anthropic.APIConnectionError) as e:  # noqa: PERF203
            status = getattr(e, "status_code", None)
            transient = isinstance(e, anthropic.APIConnectionError) or status in (
                500, 502, 503, 504, 520, 521, 522, 524, 529,
            )
            if not transient or attempt == tries:
                raise
            print(f"    {what}: transient error ({status or type(e).__name__}); "
                  f"retry {attempt}/{tries} in {delay}s")
            time.sleep(delay)
            delay = min(delay * 2, 300)


def needs_explanation(expl) -> bool:
    s = (expl or "").strip()
    if len(s) < MIN_LEN:
        return True
    low = s.lower()
    return any(p in low for p in PLACEHOLDERS)


def fetch_candidates(limit=None):
    """Page through questions and keep those missing a real explanation."""
    cols = "id,question_text,option_a,option_b,option_c,option_d,correct_answer,explanation,subject,category"
    out = []
    offset = 0
    page = 1000
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
        out.extend(q for q in rows if needs_explanation(q.get("explanation")))
        offset += page
        if limit and len(out) >= limit:
            return out[:limit]
        if len(rows) < page:
            break
    return out


def build_prompt(q) -> str:
    opts = "\n".join(f"({L}) {q.get('option_'+L.lower(), '')}" for L in LETTERS)
    ans = q["correct_answer"]
    ans_text = q.get("option_" + ans.lower(), "")
    subj = q.get("subject") or q.get("category") or "General"
    return (
        f"Subject: {subj}\n"
        f"Question: {q['question_text']}\n\n"
        f"Options:\n{opts}\n\n"
        f"VERIFIED correct option: ({ans}) {ans_text}\n\n"
        "Write the explanation as instructed."
    )


def make_request(q):
    return {
        "custom_id": q["id"],
        "params": {
            "model": MODEL,
            "max_tokens": 600,
            "system": SYSTEM,
            "messages": [{"role": "user", "content": build_prompt(q)}],
            "output_config": {"format": {"type": "json_schema", "schema": SCHEMA}},
        },
    }


def patch_explanation(qid, explanation):
    r = requests.patch(
        f"{URL}/rest/v1/questions?id=eq.{qid}",
        headers=_h({"Prefer": "return=minimal"}),
        json={"explanation": explanation},
        timeout=60,
    )
    return r.status_code in (200, 204)


def run(limit=None, chunk=1000):
    if not URL or not KEY:
        print("Missing Supabase env."); return
    if not os.getenv("ANTHROPIC_API_KEY"):
        print("Missing ANTHROPIC_API_KEY in scrapers/.env"); return

    client = anthropic.Anthropic()
    print(f"Model: {MODEL}")
    print("Finding questions needing explanations...")
    candidates = fetch_candidates(limit=limit)
    print(f"  {len(candidates)} questions need an explanation.")
    if not candidates:
        return

    total_done = 0
    for i in range(0, len(candidates), chunk):
        group = candidates[i : i + chunk]
        requests_payload = [make_request(q) for q in group]
        print(f"\nSubmitting batch of {len(requests_payload)} (chunk {i//chunk + 1})...")
        batch = _retry(
            lambda: client.messages.batches.create(requests=requests_payload),
            "batch create",
        )
        print(f"  batch {batch.id} — polling...")

        # Poll until the batch finishes.
        while True:
            b = _retry(lambda: client.messages.batches.retrieve(batch.id), "poll")
            if b.processing_status == "ended":
                break
            time.sleep(30)

        # Apply results.
        ok = 0
        for result in _retry(lambda: client.messages.batches.results(batch.id), "results"):
            if result.result.type != "succeeded":
                continue
            try:
                msg = result.result.message
                text = next((b.text for b in msg.content if b.type == "text"), "")
                data = json.loads(text)
                expl = (data.get("explanation") or "").strip()
                if expl and patch_explanation(result.custom_id, expl):
                    ok += 1
            except Exception as e:  # noqa: BLE001
                print(f"    parse/patch error for {result.custom_id}: {e}")
        total_done += ok
        print(f"  chunk done: {ok}/{len(group)} explanations written (total {total_done})")

    print(f"\nDone. Wrote {total_done} explanations.")


if __name__ == "__main__":
    import argparse

    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=None, help="max questions to process (test runs)")
    args = ap.parse_args()
    run(limit=args.limit)
