"""
Paired bilingual MCQ extractor for official TNPSC papers.

TNPSC objective papers print every question in BOTH English and Tamil, with a
single shared answer. This module turns the OCR text produced by
`tnpsc_official_scraper.py` (--ocr) into PAIRED rows ready for our `questions`
table:

    question_text      (English)   question_text_ta   (Tamil)
    option_a..d        (English)   option_a_ta..d_ta  (Tamil)
    correct_answer     (shared A/B/C/D)

Pipeline:
    1. tnpsc_official_scraper.py --download N
    2. tnpsc_official_scraper.py --ocr --engine cloud      # -> tnpsc_official_ocr/*.txt
    3. tnpsc_paired_extractor.py                            # -> paired_questions.json
    4. upload_to_supabase.py        (after running the _ta ALTERs in schema.sql)

IMPORTANT — this is a heuristic parser. Scanned-OCR layouts vary a lot across
TNPSC papers (1999-2026) and OCR introduces ~12% word error even with cloud
engines, so:
  * a Tamil reader should QA the output before bulk-loading, and
  * the heuristics (option markers, Tamil ratio, block splitting) are exposed as
    constants so they can be tuned against your actual OCR output.

Run `python tnpsc_paired_extractor.py --selftest` to verify the parsing logic on
a synthetic bilingual sample (no OCR/network needed).
"""

import argparse
import json
import os
import re

OCR_DIR = "tnpsc_official_ocr"
OUT_FILE = "paired_questions.json"

# Tamil Unicode block.
TAMIL_RE = re.compile(r"[஀-௿]")
# Question number at line start: "1." / "12)" / "Q.3"
QNUM_RE = re.compile(r"^\s*(?:Q[.\s]*)?(\d{1,3})\s*[.)\]]\s*", re.I)
# Option markers must be BRACKETED — TNPSC papers use (A)/(B)/(C)/(D) and
# (அ)/(ஆ)/(இ)/(ஈ). Requiring brackets avoids false hits on initials inside
# option text (e.g. the "C." in "C. N. Annadurai").
OPT_EN_RE = re.compile(r"[\(\[]\s*([A-Da-d])\s*[\)\]]")
# Tamil option labels அ ஆ இ ஈ -> A B C D
TAMIL_OPT_MAP = {"அ": "A", "ஆ": "B", "இ": "C", "ஈ": "D"}
OPT_TA_RE = re.compile(r"[\(\[]\s*([அஆஇஈ])\s*[\)\]]")
# Answer-key row: "12. (B)" / "12 - 3" / "Q.12 Ans: C" / "12  ஆ"
ANS_ROW_RE = re.compile(
    r"(?:Q[.\s]*)?(\d{1,3})\s*[).\-:]*\s*(?:Ans(?:wer)?[:.\s]*)?[\(\[]?\s*([A-Da-d1-4அஆஇஈ])\s*[\)\]]?",
)
NUM_TO_LETTER = {"1": "A", "2": "B", "3": "C", "4": "D"}


def tamil_ratio(s: str) -> float:
    letters = [c for c in s if c.isalpha() or TAMIL_RE.match(c)]
    if not letters:
        return 0.0
    tam = len(TAMIL_RE.findall(s))
    return tam / max(1, len(letters))


def is_tamil(s: str, threshold: float = 0.30) -> bool:
    return tamil_ratio(s) >= threshold


def norm_letter(tok: str) -> str | None:
    tok = (tok or "").strip()
    if tok in TAMIL_OPT_MAP:
        return TAMIL_OPT_MAP[tok]
    if tok in NUM_TO_LETTER:
        return NUM_TO_LETTER[tok]
    if tok.upper() in ("A", "B", "C", "D"):
        return tok.upper()
    return None


# ─── Answer key ─────────────────────────────────────────────────────────────
def parse_answer_key(text: str) -> dict:
    """Return {question_number: 'A'|'B'|'C'|'D'} from an answer-key text."""
    answers = {}
    for m in ANS_ROW_RE.finditer(text):
        num = int(m.group(1))
        letter = norm_letter(m.group(2))
        if letter and 1 <= num <= 400 and num not in answers:
            answers[num] = letter
    return answers


# ─── Question paper ─────────────────────────────────────────────────────────
def _split_blocks(text: str):
    """Split a paper into (qnum, block_text) by leading question numbers."""
    lines = text.splitlines()
    blocks = []
    cur_num, cur_lines = None, []
    for ln in lines:
        m = QNUM_RE.match(ln)
        if m:
            if cur_num is not None:
                blocks.append((cur_num, "\n".join(cur_lines)))
            cur_num = int(m.group(1))
            cur_lines = [QNUM_RE.sub("", ln, count=1)]
        elif cur_num is not None:
            cur_lines.append(ln)
    if cur_num is not None:
        blocks.append((cur_num, "\n".join(cur_lines)))
    return blocks


def _extract_options(block: str):
    """
    Pull option text per letter for each language. Returns (en_opts, ta_opts)
    dicts keyed by 'A'..'D'.

    Markers from BOTH scripts are merged into one position-ordered pass, and the
    language bucket is decided by the MARKER's script (English (A)-(D) vs Tamil
    (அ)-(ஈ)) — not by the option text — so it works whether EN/TA options are on
    the same line (e.g. "(A) 6  (அ) 6") or in separate blocks. Each option's text
    runs until the next marker of either script.
    """
    en, ta = {}, {}
    markers = []  # (pos, end, letter, lang)
    for m in OPT_EN_RE.finditer(block):
        markers.append((m.start(), m.end(), m.group(1).upper(), "en"))
    for m in OPT_TA_RE.finditer(block):
        markers.append((m.start(), m.end(), TAMIL_OPT_MAP[m.group(1)], "ta"))
    markers.sort(key=lambda x: x[0])

    for i, (_, end, letter, lang) in enumerate(markers):
        nxt = markers[i + 1][0] if i + 1 < len(markers) else len(block)
        seg = " ".join(block[end:nxt].split())
        if not seg:
            continue
        bucket = ta if lang == "ta" else en
        bucket.setdefault(letter, seg)
    return en, ta


def _split_question_text(block: str):
    """Question stem = text before the first option marker; split EN vs TA."""
    first = None
    for rgx in (OPT_EN_RE, OPT_TA_RE):
        m = rgx.search(block)
        if m and (first is None or m.start() < first):
            first = m.start()
    stem = block[:first] if first is not None else block
    en_lines, ta_lines = [], []
    for ln in stem.splitlines():
        ln = ln.strip()
        if not ln:
            continue
        (ta_lines if is_tamil(ln) else en_lines).append(ln)
    return " ".join(en_lines).strip(), " ".join(ta_lines).strip()


def parse_question_paper(text: str):
    out = []
    for num, block in _split_blocks(text):
        en_q, ta_q = _split_question_text(block)
        en_opts, ta_opts = _extract_options(block)
        out.append(
            {
                "num": num,
                "en_q": en_q,
                "ta_q": ta_q,
                "en_opts": en_opts,
                "ta_opts": ta_opts,
            }
        )
    return out


# ─── Pairing ────────────────────────────────────────────────────────────────
def build_rows(parsed, answers, meta):
    """Merge parsed questions + answer key into paired DB rows."""
    rows = []
    for q in parsed:
        letter = answers.get(q["num"])
        en, ta = q["en_opts"], q["ta_opts"]
        # Require a usable question (at least one language) + 4 English options
        # + a known answer. Tamil columns are filled when available.
        if not letter or len([l for l in "ABCD" if en.get(l)]) < 4:
            continue
        if not q["en_q"] and not q["ta_q"]:
            continue
        row = {
            "category": "pyq",
            "group_type": meta.get("group_type", "Group4_VAO"),
            "subject": meta.get("subject", "Current Affairs"),
            "topic": meta.get("subject", "Current Affairs"),
            "question_text": q["en_q"] or q["ta_q"],
            "option_a": en.get("A", ""),
            "option_b": en.get("B", ""),
            "option_c": en.get("C", ""),
            "option_d": en.get("D", ""),
            "correct_answer": letter,
            "difficulty": "medium",
            "source_url": meta.get("source_url", "tnpsc.gov.in"),
        }
        # Tamil side (paired) — only when present.
        if q["ta_q"]:
            row["question_text_ta"] = q["ta_q"]
        if len([l for l in "ABCD" if ta.get(l)]) == 4:
            row["option_a_ta"] = ta.get("A", "")
            row["option_b_ta"] = ta.get("B", "")
            row["option_c_ta"] = ta.get("C", "")
            row["option_d_ta"] = ta.get("D", "")
        rows.append(row)
    return rows


def _meta_from_filename(name: str) -> dict:
    f = name.lower()
    if "group-1" in f or "group1" in f or "_i_" in f:
        g = "Group1"
    elif "group-2" in f or "group2" in f:
        g = "Group2_2A"
    else:
        g = "Group4_VAO"
    return {"group_type": g, "subject": "Current Affairs", "source_url": name}


def run():
    if not os.path.isdir(OCR_DIR):
        print(f"No {OCR_DIR}/ yet. Run tnpsc_official_scraper.py --ocr first.")
        return
    txts = [f for f in os.listdir(OCR_DIR) if f.endswith(".txt")]
    # An answer-key file pairs with its question-paper file by shared stem; if a
    # paper embeds its own key we still parse both from the same text.
    all_rows = []
    for name in txts:
        text = open(os.path.join(OCR_DIR, name), encoding="utf-8").read()
        answers = parse_answer_key(text)
        parsed = parse_question_paper(text)
        rows = build_rows(parsed, answers, _meta_from_filename(name))
        print(f"{name}: {len(parsed)} blocks, {len(answers)} answers -> {len(rows)} paired rows")
        all_rows.extend(rows)

    with open(OUT_FILE, "w", encoding="utf-8") as f:
        json.dump(all_rows, f, ensure_ascii=False, indent=2)
    paired = sum(1 for r in all_rows if r.get("question_text_ta"))
    print(f"\nWrote {len(all_rows)} rows to {OUT_FILE} ({paired} with Tamil pairing).")
    print("Review with a Tamil reader, then: python upload_to_supabase.py")


# ─── Self-test (no OCR/network) ─────────────────────────────────────────────
SAMPLE_PAPER = """\
1. Who was the first Chief Minister of Tamil Nadu?
தமிழ்நாட்டின் முதல் முதலமைச்சர் யார்?
(A) C. N. Annadurai    (அ) சி. என். அண்ணாதுரை
(B) K. Kamaraj         (ஆ) கா. காமராசர்
(C) M. Bakthavatsalam  (இ) மு. பக்தவத்சலம்
(D) M. G. Ramachandran (ஈ) எம். ஜி. ராமச்சந்திரன்
2. The Tropic of Cancer passes through how many Indian states?
கடகரேகை எத்தனை இந்திய மாநிலங்கள் வழியாக செல்கிறது?
(A) 6   (அ) 6
(B) 7   (ஆ) 7
(C) 8   (இ) 8
(D) 9   (ஈ) 9
"""
SAMPLE_KEY = "1. (A)\n2. (C)\n"


def selftest():
    answers = parse_answer_key(SAMPLE_KEY)
    assert answers == {1: "A", 2: "C"}, answers
    parsed = parse_question_paper(SAMPLE_PAPER)
    assert len(parsed) == 2, len(parsed)
    rows = build_rows(parsed, answers, {"group_type": "Group1", "subject": "Polity"})
    assert len(rows) == 2, len(rows)
    r0 = rows[0]
    assert r0["correct_answer"] == "A"
    assert "first Chief Minister" in r0["question_text"]
    assert r0["question_text_ta"] and TAMIL_RE.search(r0["question_text_ta"])
    assert r0["option_a"].startswith("C. N. Annadurai")
    assert r0["option_a_ta"] and TAMIL_RE.search(r0["option_a_ta"])
    assert r0["option_b_ta"].startswith("கா")
    print("✓ selftest passed — paired EN+TA extraction works")
    print(f"  Q1 EN: {r0['question_text']}")
    print(f"  Q1 TA: {r0['question_text_ta']}")
    print(f"  A) EN={r0['option_a']!r}  TA={r0['option_a_ta']!r}  answer={r0['correct_answer']}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--selftest", action="store_true", help="run parser self-test (no OCR needed)")
    args = ap.parse_args()
    if args.selftest:
        selftest()
    else:
        run()
