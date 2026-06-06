# TNPSC Mentor — Project Handover

A bilingual (English/Tamil) TNPSC exam-preparation web app: 7,243 practice
questions across four categories, auto-graded mock tests, AI-written
explanations, performance analytics, spaced-repetition revision, and a
self-updating current-affairs feed.

**Live counts (as of handover):**

| Category | Code | Questions | Primary source |
|---|---|---:|---|
| Previous Year Questions | `pyq` | 4,690 | IndiaBix (89%) + TNPSC PYQ aggregators |
| Samacheer Kalvi (State Board) | `samacheer` | 1,187 | IndiaBix (subject-wise) |
| Aptitude & Reasoning | `aptitude` | 1,076 | IndiaBix (Aptitude / Reasoning) |
| Current Affairs | `current_affairs` | 290 | GKToday Quizbase |
| **Total** | | **7,243** | |

Bilingual coverage: ~4,600 questions and ~4,500 explanations carry a Tamil
version (`*_ta` columns); the rest fall back to English. Every question records
the exact URL it came from (`source_url`).

---

# PART A — For the Developer

## A1. Tech stack

| Layer | Technology |
|---|---|
| Frontend | Vite 5 · React 18 · TypeScript 5 · Tailwind CSS 3 |
| Routing / state | React Router v6 · Zustand (auth, quiz, language stores) |
| Backend | Supabase — Postgres + Auth + Row-Level Security, accessed via PostgREST |
| PDF / export | jsPDF + html2canvas |
| Icons / fonts | lucide-react · Rajdhani (headings), Inter (body), Noto Sans Tamil |
| Data pipeline | Python 3.11 (requests + BeautifulSoup + lxml), deep-translator, Anthropic SDK |
| AI explanations | Claude (Opus 4.8 + Haiku 4.5) via the Messages **Batches API** |
| Automation | GitHub Actions (monthly current-affairs cron) |

## A2. Where the data comes from (sources)

All questions are MCQs with a verified correct answer, collected from public
practice sites and one open dataset, then normalised into one schema:

- **IndiaBix** (`indiabix.com`) — the largest single source; powers most of
  `pyq` (4,172 questions), all of `samacheer`, and all of `aptitude`. Parsers
  read the question text, four options, the encoded correct-answer marker, and
  any answer description. Scrapers: `pyq_scraper.py`, `samacheer_scraper.py`,
  `aptitude_scraper.py`, shared helper `indiabix_common.py`.
- **TNPSC previous-paper aggregators** — the remaining ~11% of `pyq` comes from
  actual previous-year-paper sources: `tnpscjob.com` (259), and PDF/paper
  extracts via `drive.google.com` (123), `collegedunia` (62),
  `jagranjosh` (44), `adda247` (28). These are genuine past TNPSC questions.
- **GKToday Quizbase** (`gktoday.in/quizbase/...`) — powers `current_affairs`,
  both month-wise and topic-wise sets. Scraper: `current_affairs_scraper.py`.
- **Hugging Face `snegha24/Tamil_tnpscExam`** — an open dataset of ~516 real
  Tamil TNPSC MCQs, used to seed native Tamil content. Loader:
  `tamil_dataset_loader.py`.
- **Machine translation** — for questions/explanations without a native Tamil
  source, `translate_to_tamil.py` fills the `*_ta` columns via the free Google
  endpoint (`deep-translator`). English remains the source of truth.

> **Licensing note (important for commercial use):** IndiaBix and GKToday content
> is scraped from their public pages. This is fine for prototyping and education,
> but before charging users you should review each site's terms of use / obtain
> permission, or replace those items with licensed or originally-authored
> questions. The Hugging Face dataset carries its own (open) license. Treat
> `source_url` on each row as the provenance record.

## A3. AI explanation pipeline (anti-hallucination by design)

Many scraped questions had no real explanation (placeholder "No answer
description is available"). These are filled by Claude — **never asked to pick
the answer, only to explain the already-verified one**:

- `generate_explanations.py` — for each question with a missing/placeholder
  explanation, sends the question + options + the **verified correct option** to
  Claude and asks it to explain *why the correct option is right* and *why each
  other option is wrong*. Uses the **Batches API** (50% cheaper) and **structured
  JSON output**. Model via `EXPLANATION_MODEL` env (default `claude-opus-4-8`;
  Haiku used for bulk). Resumable; retries transient API errors with backoff.
- `build_why_wrong.py` — populates `questions.why_wrong` (jsonb) =
  `{ "<wrong letter>": "why it is wrong" }`. Phase 1 parses the per-option
  reasons already embedded in generated explanations (free); Phase 2 generates
  them for older explanations that lack itemisation.
- Result: every question has a real explanation; wrong-pickers get targeted
  feedback ("Why your answer (B) is wrong: …") shown on the **Result page only**
  — never mid-quiz.

## A4. Data model (Supabase / `supabase/schema.sql`)

- **`questions`** — the bank. Key columns: `category`, `subject`, `topic`,
  `group_type`/`year` (pyq), `standard` (samacheer), `aptitude_type`/
  `aptitude_topic`, `ca_type`/`ca_month`/`ca_topic`, `question_text`,
  `option_a..d`, `correct_answer`, `explanation`, `why_wrong` (jsonb),
  `source_url`, and Tamil mirrors `question_text_ta`, `option_*_ta`,
  `explanation_ta`.
- **`profiles`** — user role (`user`/`admin`), `exam_date`, `daily_goal`.
- **`test_sessions`** / **`test_answers`** — every attempt + per-question result
  (feeds analytics and percentile).
- **`review_items`** — spaced-repetition queue (SM-2-lite).
- **`daily_activity`** — one row per user per active day (streaks + daily goal).
- **`user_percentile(uuid)`** — `SECURITY DEFINER` RPC; ranks a user's average
  score against all aspirants (aggregate only, no row leakage).
- RLS is on for all user-owned tables; `questions` is read-only to clients.

## A5. App structure (`src/`)

- **pages/** — `LanguageScreen` → `TestArenaPage` → category pickers
  (`PreviousYearPage`, `AptitudePage`, `CurrentAffairsPage`, `SamacheerPage`) →
  `SetupPage` → `QuizPage` → `ResultPage`. Plus `MockTestPage`, `DailyPage`
  (daily CA), `RevisionPage` (SRS), `InsightsPage` (analytics),
  `AdminQuestionsPage` (admins view the full list **with answers** instead of
  attempting), and auth pages.
- **store/** — `authStore` (session + profile/role), `quizStore` (timer,
  flags, attendance gate, scoring), `languageStore` (en/ta/both).
- **lib/** — `fetchQuestions` (query builder), `analytics` (weak-area scoring),
  `srs` (revision schedule), `habit` (streak/goal/countdown/percentile),
  `assets` (study links), `i18n` (Tamil UI labels), `pdfGenerator`,
  `constants`, `supabase` (client).

## A6. Quiz rules (in `quizStore`)

45s per question, 15s minimum before moving on, 80%-attendance gate to unlock
explanations + PDF, question flagging, and auto-submit on timeout. Negative
marking is supported for mock tests. The quiz **never reveals answers per
question** — the full breakdown (correct answer, your wrong choice + why,
explanation) appears consolidated on the Result page.

## A7. Running it

**Frontend**
```
cd tnpsc-mentor
npm install
# .env: VITE_SUPABASE_URL=…  VITE_SUPABASE_ANON_KEY=…
npm run dev      # local
npm run build    # production bundle in dist/
```

**Data pipeline** (`scrapers/`)
```
pip install -r requirements.txt
# .env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
#       ANTHROPIC_API_KEY (explanations), GOOGLE_VISION_API_KEY (optional OCR)
python aptitude_scraper.py        # etc. — scrapers write JSON
python upload_to_supabase.py      # bulk insert via PostgREST
python generate_explanations.py   # fill explanations (Claude, resumable)
python build_why_wrong.py         # per-option "why wrong" map
python translate_to_tamil.py --mode questions      # fill *_ta
python translate_to_tamil.py --mode explanations    # fill explanation_ta
python export_questions.py        # regenerate docs/question-bank/*.md
```

**Automation** — `.github/workflows/monthly-ca.yml` runs `monthly_ca_update.py`
on the 5th of each month (or manually via the Actions tab). Requires repo
secrets `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

**Roles** — set a user's `profiles.role` to `admin` to switch them into
view-only question-bank mode.

---

# PART B — For the Client (TNPSC Mentor)

## B1. What the question bank contains

Your app currently holds **7,243 multiple-choice questions**, each with four
options, the correct answer, and a written explanation:

- **4,690 Previous-Year-style General Knowledge** questions (History, Polity,
  Economy, Geography, Science, and more).
- **1,187 Samacheer Kalvi (State Board)** questions, organised by subject and
  standard — the school-syllabus foundation TNPSC tests heavily.
- **1,076 Aptitude & Reasoning** questions (quantitative aptitude + logical /
  verbal / non-verbal reasoning).
- **290 Current Affairs** questions, both month-wise and topic-wise (awards,
  defence, economy, environment, schemes, polity, science, sports, etc.).

## B2. Where the questions come from

| Content | Source | Why this source |
|---|---|---|
| Samacheer, Aptitude, Reasoning, and most GK | **IndiaBix** — one of India's largest free MCQ practice libraries | Large, well-categorised, exam-style questions with answers |
| Some previous-year GK papers | **TNPSC previous-paper sites** (tnpscjob.com, jagranjosh, adda247, etc.) | Genuine past TNPSC exam questions |
| Current Affairs (monthly + topic) | **GKToday** — a widely-used current-affairs publisher | Fresh, dated, TNPSC-relevant current affairs |
| Native Tamil questions | **An open academic Tamil-TNPSC dataset** (Hugging Face) | Genuine Tamil-language questions, not machine-translated |

Every single question stores the **exact web link it came from**. You can see
this link printed directly below each question in the exported documents
(`docs/question-bank/`), so any item can be traced back to its origin.

## B3. Language support

The interface and explanations are bilingual. Question **labels and explanations**
are available in Tamil; the **questions themselves are kept in English** (per
your instruction), with Tamil versions provided where a trustworthy Tamil source
or translation exists. Learners can switch between English, Tamil, or both.

## B4. How explanations help learners

Every question has an explanation that does two things honestly:
1. explains **why the correct answer is correct**, and
2. explains **why each wrong option is wrong** — so if a student picks the wrong
   choice, they're told specifically why it was wrong.

These are AI-assisted but **anchored to the verified correct answer** — the AI is
only allowed to explain the known answer, not to decide it, which prevents
misleading guidance.

## B5. Staying current

Current affairs refresh **automatically every month** with no manual work — a
scheduled job collects the latest questions and adds only new ones. This keeps
the current-affairs section relevant throughout the exam cycle.

## B6. Copyright & compliance (please read)

The GK/aptitude/current-affairs questions are gathered from **public** practice
websites for educational preparation. Here is an honest, plain-English summary of
the copyright position. *This is general information, not legal advice — get an
Indian IP lawyer's sign-off before charging users at scale.*

**What is NOT protected by copyright**
- **Facts and ideas.** "When did World War I begin?" → "1914" is a fact. Facts
  and the correct answers themselves cannot be copyrighted.
- So a question that tests a fact can be re-asked in your **own words** freely.

**What CAN be protected**
- **The exact wording** of a question/option as written by another site
  (their original expression).
- **Original explanations** written by the source site.
- **The compilation** — a large, curated collection can have "database"/
  compilation rights in its selection and arrangement.

**Where our app stands today**
- ✅ **Explanations are now our own** — every explanation was re-written by AI
  anchored to the verified answer, so we are **not** republishing source
  explanations. This removes the biggest piece of copied expression.
- ⚠️ **Question stems/options are still largely verbatim** from the sources.
  Bulk verbatim copying (thousands of items) into a **commercial** product is the
  main exposure — both under copyright and under each site's terms of use.

**Realistic risk**
- This is a real but **manageable** risk, not a criminal matter. The usual first
  step from a publisher is a takedown notice / cease-and-desist, then a claim for
  damages if ignored. Exposure rises with (a) commercial/paid use, (b) volume of
  verbatim copying, and (c) publicly crediting the competitor as the source.

**Recommended steps before monetising**
1. **Paraphrase** the question stems and options (keep the fact, change the
   wording). This converts most items into original expression. Could be done in
   bulk with the same AI pipeline already built.
2. Keep using **our own explanations** (already done).
3. Gradually **replace** the highest-risk verbatim items with originally-authored
   or licensed questions; the `source_url` on every row makes this auditable.
4. Consider **not displaying** competitor source links to end-users in the
   product (keep them internally for provenance). Public attribution does **not**
   cure infringement and can highlight the copying.
5. Where practical, **license** content or use clearly free/government sources.

*(The per-question `source_url` we store makes all of the above straightforward
to manage and prioritise.)*

---

*Full question listings (every question with its source link, grouped by
category) are in `docs/question-bank/` — one document per category.*
