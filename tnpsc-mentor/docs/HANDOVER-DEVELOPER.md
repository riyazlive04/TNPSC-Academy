# TNPSC Mentor — Developer Handover

A bilingual (English/Tamil) TNPSC exam-prep web app: a large, subject-tagged
question bank, auto-graded mock tests, AI-written explanations with per-option
"why-wrong" feedback, analytics, spaced-repetition revision, and a self-updating
current-affairs feed.

**Question bank (live):** ~12,700 questions, **94% bilingual**. A duplicate-text
cleanup pass removes the old per-group PYQ triplication (~2,400 redundant rows),
settling the unique total to ~10,300. Every question has a real explanation and
a per-option `why_wrong` map.

| Category | Code | ~Count |
|---|---|---:|
| Previous Year / subject-wise GK | `pyq` | 8,556 |
| Current Affairs | `current_affairs` | 1,875 |
| Samacheer (state board) | `samacheer` | 1,189 |
| Aptitude & Reasoning | `aptitude` | 1,075 |

---

## 1. Tech stack

| Layer | Technology |
|---|---|
| Frontend | Vite 5 · React 18 · TypeScript 5 · Tailwind CSS 3 |
| Routing / state | React Router v6 · Zustand (auth, quiz, language) |
| Backend | Supabase — Postgres + Auth + RLS via PostgREST |
| PDF / export | jsPDF + html2canvas (in-app); PyMuPDF (doc generation) |
| Fonts | Rajdhani (headings), Inter (body), Noto Sans Tamil |
| Data pipeline | Python 3.11 · requests · BeautifulSoup/lxml · PyMuPDF · deep-translator · anthropic |
| AI | Claude (Opus 4.8 + Haiku 4.5) via the Messages **Batches API** |
| Automation | GitHub Actions (monthly current-affairs cron) |

## 2. Question sources (by `source_url` domain)

All questions are MCQs with a verified answer, normalised into one schema. Each
row stores the exact `source_url` it came from.

| Source | ~Count | Content | Bilingual | Scraper |
|---|---:|---|---|---|
| **IndiaBix** | 6,435 | GK practice, aptitude, reasoning | partial (MT) | `pyq_scraper.py`, `aptitude_scraper.py`, `samacheer_scraper.py`, `indiabix_common.py` |
| **TNPSC Master** | 2,662 | Subject/topic-wise TNPSC Q&A **with explanations** | ✅ native | `tnpscmaster_scraper.py` |
| **GKToday** | 1,504 | Current affairs (month + topic) | MT | `current_affairs_scraper.py` |
| **TNPSC Guru** | 1,207 | Subject-wise TNPSC MCQs | ✅ native | `tnpscguru_scraper.py` |
| **Shankar IAS / Thervu Pettagam** | 371 | Monthly CA quiz PDFs | ✅ native | `thervupettagam_scraper.py` |
| PYQ-paper aggregators (tnpscjob, jagranjosh, adda247, collegedunia, drive) | ~516 | Genuine previous-year papers | partial | `pyq_scraper.py` |

Plus a Hugging Face open dataset (`snegha24/Tamil_tnpscExam`) seeded native Tamil
(`tamil_dataset_loader.py`). **Not used:** Sura Books (paid/login-gated) and
Winmeen's Samacheer 6–12 (paid + TLS-blocked) — only Winmeen's free aptitude is
reachable.

### Scraper notes (non-obvious)
- **TNPSC Master** is a Next.js app — question data is in RSC stream chunks, not
  the DOM. Fetch each topic URL with header `RSC: 1`, reconstruct the stream,
  locate the `{"...","questions":[...]}` object, resolve lazy `$NN` text refs.
- **GKToday** paginates with `?pageno=2..N` (10 MCQs/page) — walk until a page
  returns no new questions (don't stop at page 1).
- **TNPSC Guru** is Blogger — paginate the JSON feed by the *actual* entries
  returned (Blogger size-truncates pages), not a fixed step.
- **Thervu Pettagam** quiz docs are digital-text PDFs (PyMuPDF); answer key is a
  `N. X` table at the end; EN then TA interleaved per question.

## 3. AI pipelines (anti-hallucination by design)

The model is always **anchored on the verified answer** — it explains/rewrites,
it never decides. All use the Batches API (50% cheaper) + structured JSON output.
Default model `claude-opus-4-8`; `EXPLANATION_MODEL` env overrides (Haiku used
for bulk).

- **`generate_explanations.py`** — fills missing/placeholder explanations.
  Output: why the correct option is right **+ "Why not the others: (A)…; (B)…"**.
- **`build_why_wrong.py`** — populates `questions.why_wrong` (jsonb) =
  `{"<wrong letter>":"why it's wrong"}`. Phase 1 parses the explanations above
  (free); Phase 2 generates the rest.
- **`paraphrase_questions.py`** — rewrites third-party stems+options into
  original wording (copyright de-risk), preserving every number/name and the
  answer. Mixed model (Opus for aptitude, Haiku else). Numeric-guard rejects any
  rewrite that changes a number; originals backed up to `paraphrase_backup.jsonl`
  (gitignored). Genuine previous-year-paper items are kept verbatim.
- **`translate_to_tamil.py`** — fills `*_ta` columns via free Google MT
  (`--mode questions` / `--mode explanations`). Native-Tamil source rows skip MT.
- **`consolidate.py`** — runs paraphrase(new) → why_wrong → explanation-Tamil →
  dedupe sequentially (avoids concurrent-paraphrase / MT clashes).
- **`dedupe_questions.py`** — collapses duplicate `question_text`, keeping the
  richest copy (scores explanation/why_wrong/Tamil presence). `--apply` to delete.

## 4. Data model (`supabase/schema.sql`)
- **`questions`** — `category`, `subject`, `topic`, group/standard/CA/aptitude
  metadata, `question_text`, `option_a..d`, `correct_answer`, `explanation`,
  **`why_wrong` (jsonb)**, `source_url`, and Tamil mirrors `*_ta`.
- **`profiles`** (role user/admin, exam_date, daily_goal), **`test_sessions`** /
  **`test_answers`**, **`review_items`** (SRS), **`daily_activity`** (streaks).
- **`user_percentile(uuid)`** SECURITY DEFINER RPC. RLS on all user tables.

## 5. Syllabus taxonomy (`src/lib/constants.ts`)
GS subjects extended to the full TNPSC syllabus (added **Geography**, **General
Science**) plus language papers (**General Tamil**, **General English**) for
Group 2/4. **PYQ uses subject-membership** — a question is shown under any group
whose syllabus includes its subject (`fetchQuestions.ts` filters by `subject`,
not a stored `group_type`), so each question is stored once.

## 6. App structure (`src/`)
- **pages/** — LanguageScreen → TestArena → category pickers → SetupPage →
  QuizPage → ResultPage; plus MockTest, Daily (CA), Revision (SRS), Insights,
  AdminQuestions (admins view the full list **with answers**), auth pages.
- **store/** — authStore, quizStore (timer, 80% gate, flagging, scoring),
  languageStore. **lib/** — fetchQuestions, analytics, srs, habit, assets, i18n,
  pdfGenerator, constants, supabase.
- **Quiz rules:** 45s/question, 15s min, 80%-attendance gate to unlock
  explanations + PDF, auto-submit. **Answers/explanations are never shown
  mid-quiz** — only consolidated on the Result page (correct answer + targeted
  "Why your answer (X) is wrong" + explanation).

## 7. Running it
**Frontend**
```
cd tnpsc-mentor && npm install
# .env: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
npm run dev      # local (http://localhost:5173)
npm run build
```
**Data pipeline** (`scrapers/`, needs `.env`: SUPABASE_URL,
SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY)
```
pip install -r requirements.txt
python tnpscmaster_scraper.py        # (or aptitude/pyq/samacheer/current_affairs/tnpscguru/thervupettagam)
python upload_new.py <file>.json     # dedup-insert (incl. _ta)
python consolidate.py                # paraphrase -> why_wrong -> Tamil -> dedupe
python export_questions.py && python make_pdfs.py   # regenerate docs
```
**Automation** — `.github/workflows/monthly-ca.yml` runs `monthly_ca_update.py`
on the 5th monthly (repo secrets SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).
**Roles** — set `profiles.role = 'admin'` for view-only question-bank mode.

## 8. Copyright
Most content is scraped from third-party practice sites. Mitigations in place:
explanations are **our own** (AI-written), and stems are **paraphrased** into
original wording; genuine past-paper items kept verbatim; `source_url` retained
for provenance. See **HANDOVER-CLIENT.md** for the plain-English version and the
pre-monetisation checklist.
