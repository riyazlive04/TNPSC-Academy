# Vettri Nichayam exam content format

The **Vettri Nichayam** bank is 13 fixed mock exams (`category='vettri'`, `vettri_set` 1..13). The catalog rows are seeded (disabled) by `supabase/vettri.sql`; this doc is for loading the **questions**.

## Where files go

One JSON file per exam, named `vettri<N>.json` (N = 1..13), in a directory outside the repo. Default: `c:/Users/mas20/Desktop/work/TNPSC/vettri_tests/`. You can load a subset — missing files are skipped, so you can add exams as they're written.

## Per-question JSON shape

Each file is a JSON **array** of question objects. This is the same shape the full mock exams use:

```json
[
  {
    "external_id": "vettri1-001",
    "subject": "Polity",
    "topic": "Indian Constitution",
    "unit": null,
    "difficulty": "hard",

    "question_text": "Which article deals with ...?",
    "option_a": "...",
    "option_b": "...",
    "option_c": "...",
    "option_d": "...",
    "correct_answer": "C",
    "explanation": "Article 32 ...",
    "why_wrong": { "A": "...", "B": "...", "D": "..." },

    "question_text_ta": "…",
    "option_a_ta": "…",
    "option_b_ta": "…",
    "option_c_ta": "…",
    "option_d_ta": "…",
    "explanation_ta": "…",
    "why_wrong_ta": { "A": "…", "B": "…", "D": "…" }
  }
]
```

### Field notes
- **Required:** `question_text`, `option_a`..`option_d`, `correct_answer` (A/B/C/D, case-insensitive).
- **`external_id`** — a stable unique id per question. Used for provenance; the loader reloads a whole set at a time (by `vettri_set`), so keep ids unique to avoid confusion.
- **`difficulty`** — `easy` | `medium` | `hard`. Defaults to `hard` if omitted.
- **Tamil columns** (`*_ta`) — optional; omit or set empty for English-only questions.
- **`why_wrong` / `why_wrong_ta`** — optional JSON objects (per-option rationale). `null` or `{}` becomes NULL.
- Do **not** set `category` or `vettri_set` in the JSON — the loader stamps them.

## Loading

```bash
cd server
node --env-file=.env load-vettri-exams.mjs            # default dir
node --env-file=.env load-vettri-exams.mjs /path/dir  # custom dir
```

The loader is idempotent per set (it deletes and reinserts each present set), and it syncs each exam's `total_questions` to the loaded count.

## Turning exams on

Loading does **not** enable an exam. In the app: **Superadmin → Vettri**, then:
1. Flip the master **Vettri Nichayam visibility** toggle on (shows the nav tab + Test Arena tile).
2. Toggle **enabled** per exam (the toggle refuses to enable an exam with 0 questions loaded).
