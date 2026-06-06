"""
Populate the bilingual Tamil (_ta) columns by machine-translating the English
questions already in the `questions` table (EN -> TA via Google MT through
deep-translator). This is what makes the app's "Both" language mode show the
SAME question in English and Tamil with one shared answer — no scanning,
purchasing, or manual entry.

Design notes:
  * Only rows whose question_text is ENGLISH are translated. Rows that are
    already Tamil-origin (the Hugging Face dataset) are detected by Tamil
    Unicode and skipped, so we never "translate Tamil as if English".
  * Resumable: we only fetch rows where question_text_ta IS NULL, so re-running
    continues where it left off (and survives rate-limit interruptions).
  * Efficient: many fields are packed into one translate_batch call.
  * Reversible: everything lands in *_ta columns; clearing them restores the
    English-only state.

Translates question_text + option_a..d (the essential MCQ). Explanations are
left in English (the UI falls back to English when explanation_ta is absent).

Requires scrapers/.env (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) and:
    pip install deep-translator
"""

import os
import sys
import time

import requests
from deep_translator import GoogleTranslator
from dotenv import load_dotenv

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

load_dotenv()
URL = (os.getenv("SUPABASE_URL") or "").rstrip("/")
KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or ""

TAMIL = lambda s: any("஀" <= c <= "௿" for c in (s or ""))
ROW_FIELDS = ["question_text", "option_a", "option_b", "option_c", "option_d"]
TA_FIELDS = ["question_text_ta", "option_a_ta", "option_b_ta", "option_c_ta", "option_d_ta"]

PAGE = 200          # rows fetched per DB page
PACK = 40           # strings per translate_batch call


def _h(extra=None):
    h = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json"}
    if extra:
        h.update(extra)
    return h


def count_remaining():
    r = requests.get(
        f"{URL}/rest/v1/questions?question_text_ta=is.null&select=id",
        headers=_h({"Prefer": "count=exact", "Range": "0-0"}),
        timeout=30,
    )
    cr = r.headers.get("content-range", "")
    return cr.split("/")[-1] if "/" in cr else "?"


def fetch_untranslated(page):
    cols = ",".join(["id"] + ROW_FIELDS)
    r = requests.get(
        f"{URL}/rest/v1/questions?question_text_ta=is.null&select={cols}&limit={page}",
        headers=_h(),
        timeout=60,
    )
    r.raise_for_status()
    return r.json()


def translate_strings(strings, pack=PACK):
    """Translate a flat list of English strings to Tamil (batched + retried)."""
    out = [None] * len(strings)
    tr = GoogleTranslator(source="en", target="ta")
    for i in range(0, len(strings), pack):
        chunk = strings[i : i + pack]
        # Guard: GoogleTranslator rejects empty strings.
        idx = [j for j, s in enumerate(chunk) if s and s.strip()]
        payload = [chunk[j] for j in idx]
        res = None
        for attempt in range(4):
            try:
                res = tr.translate_batch(payload) if payload else []
                break
            except Exception as e:  # noqa: BLE001
                wait = 2 * (attempt + 1)
                print(f"    batch retry {attempt+1} after {wait}s ({str(e)[:60]})")
                time.sleep(wait)
        if res is None:
            # last-resort per-string
            res = []
            for s in payload:
                try:
                    res.append(tr.translate(s))
                except Exception:
                    res.append(s)
                time.sleep(0.3)
        for k, j in enumerate(idx):
            out[i + j] = res[k] if k < len(res) else chunk[j]
        time.sleep(0.4)
    return out


def patch_row(row_id, ta_values):
    body = {ta: val for ta, val in zip(TA_FIELDS, ta_values) if val}
    if not body:
        return False
    r = requests.patch(
        f"{URL}/rest/v1/questions?id=eq.{row_id}",
        headers=_h({"Prefer": "return=minimal"}),
        json=body,
        timeout=60,
    )
    return r.status_code in (200, 204)


def run(limit=None):
    if not URL or not KEY:
        print("Missing Supabase env."); return
    print(f"Rows still needing Tamil: {count_remaining()}")
    done = 0
    while True:
        rows = fetch_untranslated(PAGE)
        if not rows:
            break
        # Skip Tamil-origin rows (already Tamil) by marking them so the
        # is.null filter stops returning them: copy question_text into _ta.
        english_rows, tamil_rows = [], []
        for row in rows:
            (tamil_rows if TAMIL(row["question_text"]) else english_rows).append(row)

        # Tamil-origin rows: set question_text_ta = question_text (no MT needed),
        # so they leave the untranslated set and render in Tamil mode too.
        for row in tamil_rows:
            patch_row(row["id"], [row.get(f) for f in ROW_FIELDS])

        if english_rows:
            flat = []
            for row in english_rows:
                flat.extend(row.get(f, "") or "" for f in ROW_FIELDS)
            translated = translate_strings(flat)
            for n, row in enumerate(english_rows):
                vals = translated[n * 5 : n * 5 + 5]
                patch_row(row["id"], vals)
                done += 1
                if done % 25 == 0:
                    print(f"  translated {done} (remaining ~{count_remaining()})")
                if limit and done >= limit:
                    print(f"Hit limit {limit}. Stopping.")
                    return
        if not english_rows and not tamil_rows:
            break
    print(f"Done. Translated {done} English rows. Remaining: {count_remaining()}")


# ─── Explanation translation (explanation -> explanation_ta) ────────────────

EXPL_PLACEHOLDERS = ("no answer description", "let's discuss", "let us discuss")


def _expl_needs_tr(row) -> bool:
    e = (row.get("explanation") or "").strip()
    if len(e) < 15:
        return False
    low = e.lower()
    return not any(p in low for p in EXPL_PLACEHOLDERS)


def fetch_untranslated_expl(page):
    r = requests.get(
        f"{URL}/rest/v1/questions"
        f"?explanation=not.is.null&explanation_ta=is.null"
        f"&select=id,explanation&limit={page}",
        headers=_h(),
        timeout=60,
    )
    r.raise_for_status()
    return r.json()


def run_explanations(limit=None):
    """Translate real explanations into explanation_ta for Bilingual mode."""
    if not URL or not KEY:
        print("Missing Supabase env."); return
    print("Translating explanations -> explanation_ta ...")
    done = 0
    empty_pages = 0
    while True:
        rows = fetch_untranslated_expl(PAGE)
        if not rows:
            break
        todo = [r for r in rows if _expl_needs_tr(r) and not TAMIL(r["explanation"])]
        if not todo:
            # All rows on this page are placeholders/short/already-Tamil — avoid
            # an infinite loop by stopping once we stop finding translatable rows.
            empty_pages += 1
            if empty_pages >= 2:
                break
            continue
        empty_pages = 0
        translated = translate_strings([r["explanation"] for r in todo], pack=15)
        for row, ta in zip(todo, translated):
            if ta:
                requests.patch(
                    f"{URL}/rest/v1/questions?id=eq.{row['id']}",
                    headers=_h({"Prefer": "return=minimal"}),
                    json={"explanation_ta": ta},
                    timeout=60,
                )
                done += 1
                if done % 25 == 0:
                    print(f"  explanations translated: {done}")
                if limit and done >= limit:
                    print(f"Hit limit {limit}. Stopping.")
                    return
    print(f"Done. Translated {done} explanations.")


if __name__ == "__main__":
    import argparse

    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=None, help="max rows to translate (test runs)")
    ap.add_argument(
        "--mode",
        choices=["questions", "explanations"],
        default="questions",
        help="questions: translate question+options; explanations: translate explanation->explanation_ta",
    )
    args = ap.parse_args()
    if args.mode == "explanations":
        run_explanations(limit=args.limit)
    else:
        run(limit=args.limit)
