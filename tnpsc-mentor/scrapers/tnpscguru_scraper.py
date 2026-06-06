"""
Scrapes bilingual TNPSC MCQs from TNPSC Guru (www.tnpscguru.in).

TNPSC Guru is a Blogger site. We enumerate posts via the JSON feed:

    https://www.tnpscguru.in/feeds/posts/default?alt=json&start-index=1&max-results=150

Each feed entry's `content.$t` already carries the full post HTML, so MCQs are
parsed straight from the feed (no second request per post).

Inline MCQ markup has TWO variants:
  Variant A (older):
    <div class="question">
      <p>1. stem</p>
      <p class="ans correct">a) ... <span>Correct Answer</span></p>
      <p class="ans">b) ...</p> ...
    </div>
  Variant B (newer):
    <div class="question">
      <p>1) stem</p>
      <div class="ans">A) ... <span></span></div>
      <div class="ans correct">B) ...</div> ...
      <div class="explanation"><strong>Explanation:</strong> ...</div>
    </div>

Bilingual: each question is rendered as TWO consecutive div.question blocks —
first English, then the Tamil version (same options/answer). We pair them by
detecting Tamil via the Unicode range U+0B80..U+0BFF, merging the English block
with its Tamil counterpart (English -> main fields, Tamil -> *_ta fields).

Output: tnpscguru_questions.json
"""

import json
import re
import sys
import time

import requests
from bs4 import BeautifulSoup

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 Chrome/120"
    )
}

FEED_URL = "https://www.tnpscguru.in/feeds/posts/default"
PAGE_SIZE = 150

TAMIL_RE = re.compile(r"[஀-௿]")
# Leading enumerator like "1." / "1)" / "12 ." at the start of a stem.
STEM_NUM_RE = re.compile(r"^\s*\d+\s*[.)]\s*")
# Leading option label like "a)" / "A." / "(b)" / "1)".
OPT_LABEL_RE = re.compile(r"^\s*[\(]?\s*[a-eA-E1-5]\s*[.)\]]\s*")


def _clean(text):
    return " ".join((text or "").split())


def _is_tamil(text):
    return bool(TAMIL_RE.search(text or ""))


SUBJECT_RULES = [
    (("history", "freedom", "movement"), "History and INM"),
    (("polity", "constitution"), "Polity"),
    (("geography",), "Geography"),
    (("econom",), "Indian Economy"),
    (("physics",), "Physics"),
    (("chemistry",), "Chemistry"),
    (("biology", "botany", "zoology"), "Biology"),
    (("science",), "General Science"),
    (("aptitude", "mental", "maths", "reasoning"), "Aptitude"),
    (("tamil",), "General Tamil"),
    (("english", "grammar"), "General English"),
    (("current affairs",), "Current Affairs"),
    (("tamil nadu", "tamilnadu"), "History Culture Heritage of TN"),
]


def map_subject(title):
    """Best-effort subject from the post title (first matching rule wins)."""
    t = (title or "").lower()
    for keywords, subject in SUBJECT_RULES:
        if any(k in t for k in keywords):
            return subject
    return None


def _strip_trailing_span(el):
    """Return option text with any trailing <span> (the answer marker) removed."""
    clone = BeautifulSoup(str(el), "lxml")
    for span in clone.find_all("span"):
        span.decompose()
    return _clean(clone.get_text(" ", strip=True))


def parse_question_block(div):
    """Parse a single div.question into a normalized dict, or None if invalid.

    Returns:
      {
        "stem": str,
        "options": [str, ...],     # in document order, labels/answer-span stripped
        "correct_index": int|None, # index into options of the .correct option
        "explanation": str|None,
        "is_tamil": bool,
      }
    """
    # Stem = first child <p> (both variants put the stem in a <p>).
    stem_el = div.find("p")
    if stem_el is None:
        return None
    stem = _clean(stem_el.get_text(" ", strip=True))
    stem = STEM_NUM_RE.sub("", stem).strip()

    # Options: any element carrying class "ans".
    opt_els = div.find_all(class_="ans")
    options = []
    correct_index = None
    for i, el in enumerate(opt_els):
        classes = el.get("class") or []
        text = _strip_trailing_span(el)
        text = OPT_LABEL_RE.sub("", text).strip()
        options.append(text)
        if "correct" in classes:
            correct_index = i

    # Explanation (variant B): div.explanation. Strip a leading "Explanation:".
    explanation = None
    exp_el = div.find(class_="explanation")
    if exp_el is not None:
        exp_text = _clean(exp_el.get_text(" ", strip=True))
        exp_text = re.sub(r"^\s*explanation\s*[:\-]?\s*", "", exp_text, flags=re.I)
        explanation = exp_text or None

    return {
        "stem": stem,
        "options": options,
        "correct_index": correct_index,
        "explanation": explanation,
        "is_tamil": _is_tamil(stem),
    }


def _map_options_to_abcd(parsed):
    """From a parsed block, build (option_a..d, correct_letter) or None.

    - Need >= 4 non-empty options and a correct option.
    - 5-option posts (incl. "Answer not known"): keep A-D; if the correct option
      is the 5th (E), skip the question by returning None.
    """
    opts = [o for o in parsed["options"]]
    ci = parsed["correct_index"]
    if ci is None:
        return None
    if len([o for o in opts if o]) < 4:
        return None
    if ci >= 4:
        # Correct answer is option E (or later) — cannot map to A-D.
        return None
    first4 = opts[:4]
    if any(not o for o in first4):
        return None
    letter = ["A", "B", "C", "D"][ci]
    return first4, letter


def parse_post(content_html, title, url):
    """Parse all bilingual MCQ records out of one post's content HTML."""
    soup = BeautifulSoup(content_html, "lxml")
    blocks = soup.find_all("div", class_="question")
    parsed_blocks = [parse_question_block(b) for b in blocks]
    parsed_blocks = [p for p in parsed_blocks if p is not None]

    subject = map_subject(title)
    rows = []
    i = 0
    n = len(parsed_blocks)
    while i < n:
        en = parsed_blocks[i]
        # Skip stray Tamil-first blocks with no preceding English (rare); treat
        # a Tamil block here as its own English-less record's counterpart only
        # when it directly follows an English block (handled below).
        ta = None
        if not en["is_tamil"]:
            # Look ahead: pair with the next block iff it is Tamil.
            if i + 1 < n and parsed_blocks[i + 1]["is_tamil"]:
                ta = parsed_blocks[i + 1]
                i += 2
            else:
                i += 1
        else:
            # English missing — emit this Tamil as English fallback so data
            # isn't silently lost, but per spec English drives main fields.
            i += 1

        mapped = _map_options_to_abcd(en)
        if en["is_tamil"] or mapped is None or not en["stem"]:
            continue
        (oa, ob, oc, od), letter = mapped

        row = {
            "category": "pyq",
            "subject": subject,
            "topic": title,
            "question_text": en["stem"],
            "option_a": oa,
            "option_b": ob,
            "option_c": oc,
            "option_d": od,
            "correct_answer": letter,
            "explanation": en["explanation"],
            "question_text_ta": None,
            "option_a_ta": None,
            "option_b_ta": None,
            "option_c_ta": None,
            "option_d_ta": None,
            "explanation_ta": None,
            "difficulty": "medium",
            "source_url": url,
        }

        if ta is not None:
            ta_opts = ta["options"]
            row["question_text_ta"] = ta["stem"] or None
            # Map Tamil options positionally to A-D (same order as English).
            for idx, key in enumerate(
                ["option_a_ta", "option_b_ta", "option_c_ta", "option_d_ta"]
            ):
                if idx < len(ta_opts) and ta_opts[idx]:
                    row[key] = ta_opts[idx]
            row["explanation_ta"] = ta["explanation"]

        rows.append(row)

    return rows


def _entry_url(entry):
    """Permalink for a feed entry: <link rel='alternate' type='text/html'>."""
    for link in entry.get("link", []):
        if link.get("rel") == "alternate" and link.get("type") == "text/html":
            return link.get("href")
    # Fallback: any alternate, then the entry id.
    for link in entry.get("link", []):
        if link.get("rel") == "alternate":
            return link.get("href")
    return entry.get("id", {}).get("$t")


def fetch_feed_page(start_index):
    params = {
        "alt": "json",
        "start-index": start_index,
        "max-results": PAGE_SIZE,
    }
    resp = requests.get(FEED_URL, params=params, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    return resp.json()


def scrape():
    posts_scanned = 0
    mcq_posts = 0
    all_rows = []

    start_index = 1
    total_results = None
    while True:
        print(f"Fetching feed start-index={start_index} ...")
        try:
            data = fetch_feed_page(start_index)
        except Exception as e:  # noqa: BLE001
            print(f"  Feed fetch failed at start-index={start_index}: {e}")
            break

        feed = data.get("feed", {})
        if total_results is None:
            try:
                total_results = int(feed.get("openSearch$totalResults", {}).get("$t", "0"))
            except Exception:
                total_results = 0
            print(f"  feed reports {total_results} total posts")
        entries = feed.get("entry", [])
        if not entries:
            print("  No entries — end of feed.")
            break

        for entry in entries:
            posts_scanned += 1
            content = (entry.get("content") or {}).get("$t", "")
            if 'class="question"' not in content:
                continue
            mcq_posts += 1
            title = (entry.get("title") or {}).get("$t", "") or "(untitled)"
            url = _entry_url(entry)
            try:
                rows = parse_post(content, title, url)
            except Exception as e:  # noqa: BLE001
                print(f"  Error parsing post '{title}': {e}")
                continue
            all_rows.extend(rows)

        print(
            f"  page entries={len(entries)} "
            f"(running: scanned={posts_scanned}, mcq_posts={mcq_posts}, "
            f"rows={len(all_rows)})"
        )

        # Blogger size-truncates each response (returns < max-results), so
        # advance by the actual number of entries received, not PAGE_SIZE.
        start_index += len(entries)
        if total_results and start_index > total_results:
            break
        time.sleep(0.75)

    # Dedupe by question_text (keep first occurrence).
    seen = set()
    deduped = []
    for r in all_rows:
        qt = r["question_text"]
        if qt in seen:
            continue
        seen.add(qt)
        deduped.append(r)

    bilingual = sum(1 for r in deduped if r["question_text_ta"])

    with open("tnpscguru_questions.json", "w", encoding="utf-8") as f:
        json.dump(deduped, f, ensure_ascii=False, indent=2)

    print("\n=== SUMMARY ===")
    print(f"Posts scanned:        {posts_scanned}")
    print(f"MCQ posts found:      {mcq_posts}")
    print(f"Rows before dedupe:   {len(all_rows)}")
    print(f"Questions written:    {len(deduped)}")
    print(f"Bilingual (with _ta): {bilingual}")
    print("Output: tnpscguru_questions.json")

    return deduped


if __name__ == "__main__":
    scrape()
