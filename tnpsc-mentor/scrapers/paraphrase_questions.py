"""
Paraphrase third-party question stems + options into ORIGINAL wording, to reduce
copyright exposure, WITHOUT changing any fact or the answer.

Scope (by source): rewrites every question whose source_url is from indiabix.com
or gktoday.in (including the IndiaBix items inside the `pyq` category). Genuine
previous-year-paper questions (other sources) are LEFT VERBATIM on purpose.

Model (mixed, per-request): aptitude category -> Opus (math/reasoning is the most
correctness-fragile); everything else -> Haiku.

Safety guards (this is the whole point — no broken questions):
  * The verified correct answer + all options are passed in; the model only
    REWORDS, must keep the four options in the same A-D order with the same
    meaning, and must not change which option is correct.
  * NUMERIC GUARD: the multiset of numbers in (stem + options) must be identical
    before and after. If it differs, the paraphrase is REJECTED and the original
    is kept (logged). This blocks accidental changes to aptitude problems.
  * Empty-option / empty-stem results are rejected.
  * Originals are backed up to paraphrase_backup.jsonl BEFORE patching, so the
    run is fully reversible and resumable (already-done ids are skipped).

Note: Tamil mirrors (*_ta) are translations of the ORIGINAL wording; facts are
unchanged so they stay valid. Re-translate later if you want exact phrasing parity.

Env: scrapers/.env with SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY.
"""

import json
import os
import re
import sys
import time

import anthropic
import requests
from dotenv import load_dotenv

from generate_explanations import _retry

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

load_dotenv()
URL = (os.getenv("SUPABASE_URL") or "").rstrip("/")
KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or ""
HAIKU = "claude-haiku-4-5"
OPUS = "claude-opus-4-8"

BACKUP = os.path.join(os.path.dirname(__file__), "paraphrase_backup.jsonl")
# Third-party sources whose verbatim wording we rewrite into original expression.
PARAPHRASE_SOURCES = (
    "indiabix.com", "gktoday.in", "tnpscmaster.in", "tnpscguru.in",
    "tnpscthervupettagam.com",
)
LETTERS = ["A", "B", "C", "D"]

SCHEMA = {
    "type": "object",
    "properties": {
        "question_text": {"type": "string"},
        "option_a": {"type": "string"},
        "option_b": {"type": "string"},
        "option_c": {"type": "string"},
        "option_d": {"type": "string"},
    },
    "required": ["question_text", "option_a", "option_b", "option_c", "option_d"],
    "additionalProperties": False,
}

SYSTEM = (
    "You rewrite exam multiple-choice questions in fresh, original wording WITHOUT "
    "changing their meaning, facts, or answer. You are given the question, its four "
    "options (A-D), and the verified correct option.\n"
    "Rules:\n"
    "1. Keep EVERY number, date, year, name, place, formula, and technical term "
    "EXACTLY as given — do not alter, add, or drop any.\n"
    "2. Keep the four options in the SAME order (A,B,C,D) with the SAME meaning — "
    "reword phrasing only. Each option must still mean exactly what it meant.\n"
    "3. Do NOT change which option is correct.\n"
    "4. Do not add explanations or extra information.\n"
    "5. If a question is too short/numeric to meaningfully reword (e.g. 'Find 3+5'), "
    "return it essentially unchanged.\n"
    "Output only the reworded question and four options."
)


def _h(extra=None):
    h = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json"}
    if extra:
        h.update(extra)
    return h


def numbers_in(*texts):
    nums = []
    for t in texts:
        nums += re.findall(r"\d+(?:\.\d+)?", t or "")
    return sorted(nums)


def is_target(q):
    s = (q.get("source_url") or "")
    return any(d in s for d in PARAPHRASE_SOURCES)


def load_done():
    done = set()
    if os.path.exists(BACKUP):
        with open(BACKUP, encoding="utf-8") as f:
            for line in f:
                try:
                    done.add(json.loads(line)["id"])
                except Exception:
                    pass
    return done


def fetch_targets(done):
    cols = "id,category,subject,question_text,option_a,option_b,option_c,option_d,correct_answer,source_url"
    out, off, page = [], 0, 1000
    while True:
        r = requests.get(
            f"{URL}/rest/v1/questions?select={cols}&limit={page}&offset={off}",
            headers=_h(),
            timeout=60,
        )
        r.raise_for_status()
        rows = r.json()
        if not rows:
            break
        out += [q for q in rows if is_target(q) and q["id"] not in done]
        off += page
        if len(rows) < page:
            break
    return out


def build_request(q):
    model = OPUS if q.get("category") == "aptitude" else HAIKU
    opts = "\n".join(f"({L}) {q.get('option_'+L.lower(),'')}" for L in LETTERS)
    ans = q["correct_answer"]
    prompt = (
        f"Question: {q['question_text']}\n\nOptions:\n{opts}\n\n"
        f"Verified correct option: ({ans}). Keep ({ans}) correct.\n\n"
        "Reword the question and the four options as instructed."
    )
    return {
        "custom_id": q["id"],
        "params": {
            "model": model,
            "max_tokens": 900,
            "system": SYSTEM,
            "messages": [{"role": "user", "content": prompt}],
            "output_config": {"format": {"type": "json_schema", "schema": SCHEMA}},
        },
    }


def accept(orig, new):
    """Validate a paraphrase. Returns (ok, reason)."""
    fields = ["question_text"] + [f"option_{L.lower()}" for L in LETTERS]
    for f in fields:
        if not (new.get(f) or "").strip():
            return False, f"empty {f}"
    o_nums = numbers_in(*[orig.get(f, "") for f in fields])
    n_nums = numbers_in(*[new.get(f, "") for f in fields])
    if o_nums != n_nums:
        return False, f"number mismatch {o_nums} != {n_nums}"
    return True, "ok"


def backup_original(q):
    rec = {k: q.get(k) for k in
           ["id", "question_text", "option_a", "option_b", "option_c", "option_d"]}
    with open(BACKUP, "a", encoding="utf-8") as f:
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")


def patch(qid, new):
    body = {k: new[k] for k in
            ["question_text", "option_a", "option_b", "option_c", "option_d"]}
    r = requests.patch(
        f"{URL}/rest/v1/questions?id=eq.{qid}",
        headers=_h({"Prefer": "return=minimal"}),
        json=body,
        timeout=60,
    )
    return r.status_code in (200, 204)


def run(limit=None, chunk=1000):
    if not URL or not KEY:
        print("Missing Supabase env."); return
    if not os.getenv("ANTHROPIC_API_KEY"):
        print("Missing ANTHROPIC_API_KEY."); return
    client = anthropic.Anthropic()

    done = load_done()
    print(f"Already paraphrased (backup): {len(done)}")
    targets = fetch_targets(done)
    if limit:
        targets = targets[:limit]
    print(f"To paraphrase now: {len(targets)} (Opus={sum(1 for q in targets if q['category']=='aptitude')}, Haiku={sum(1 for q in targets if q['category']!='aptitude')})")
    if not targets:
        return

    by_id = {q["id"]: q for q in targets}
    written = rejected = 0
    for i in range(0, len(targets), chunk):
        group = targets[i : i + chunk]
        print(f"\nBatch {i//chunk + 1}: {len(group)} ...")
        batch = _retry(
            lambda: client.messages.batches.create(requests=[build_request(q) for q in group]),
            "batch create",
        )
        print(f"  {batch.id} — polling...")
        while True:
            b = _retry(lambda: client.messages.batches.retrieve(batch.id), "poll")
            if b.processing_status == "ended":
                break
            time.sleep(30)
        for result in _retry(lambda: client.messages.batches.results(batch.id), "results"):
            if result.result.type != "succeeded":
                continue
            qid = result.custom_id
            orig = by_id[qid]
            try:
                text = next(
                    (c.text for c in result.result.message.content if c.type == "text"), ""
                )
                new = json.loads(text)
            except Exception as e:  # noqa: BLE001
                print(f"    parse error {qid}: {e}"); rejected += 1; continue
            ok, reason = accept(orig, new)
            if not ok:
                rejected += 1
                continue  # keep original verbatim
            backup_original(orig)
            if patch(qid, new):
                written += 1
        print(f"  cumulative: written {written}, rejected/kept-original {rejected}")
    print(f"\nDone. Paraphrased {written}; kept {rejected} original (guard rejected).")


if __name__ == "__main__":
    import argparse

    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=None, help="max questions (test runs)")
    args = ap.parse_args()
    run(limit=args.limit)
