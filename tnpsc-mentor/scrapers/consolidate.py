"""
One-shot consolidation of the newly-added questions (TNPSC Master / Guru /
Thervu) plus a final cleanup. Runs the remaining pipeline SEQUENTIALLY in a
single process so there are no concurrent-paraphrase / MT-rate-limit clashes.

Order (each step is resumable/idempotent):
  1. paraphrase  — rewrite the new IndiaBix-style/3rd-party stems into original
                   wording (originals already done are skipped via the backup).
  2. why_wrong   — per-option "why wrong" for any row missing it (parses the
                   freshly-generated explanations for free, generates the rest).
  3. explanation -> Tamil  — fill explanation_ta for the new explanations.
  4. dedupe      — collapse duplicate-text rows, keep the richest copy (LAST, so
                   it runs after all paraphrasing has settled the text).

Run only AFTER the standalone paraphrase / generate_explanations / question-Tamil
jobs have finished. Env: scrapers/.env.
"""

import sys
import time

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass


def banner(msg):
    print(f"\n{'='*60}\n{msg}\n{'='*60}", flush=True)


def main():
    t0 = "start"

    banner("STEP 1/4 — paraphrase new rows")
    import paraphrase_questions
    paraphrase_questions.run()

    banner("STEP 2/4 — why_wrong (parse + generate)")
    import build_why_wrong
    build_why_wrong.main()

    banner("STEP 3/4 — translate explanations to Tamil")
    import translate_to_tamil
    translate_to_tamil.run_explanations()

    banner("STEP 4/4 — dedupe duplicate-text rows")
    import dedupe_questions
    dedupe_questions.main(apply=True)

    banner("CONSOLIDATION COMPLETE")


if __name__ == "__main__":
    main()
