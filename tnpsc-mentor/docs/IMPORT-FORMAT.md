# Question Import Format

How to import your prepared question batch into TNPSC Mentor. Two paths, **same
column format**:

- **In-app** (no setup): Admin → Question Bank → **Import** → upload a `.csv` or
  `.json` file.
- **Python pipeline** (bulk/automation): convert your docs to JSON, then
  `python scrapers/upload_new.py yourfile.json`.

Every imported row is tagged `source_url = tnpsc-official` automatically, so the
old mock bank can be purged afterwards with `supabase/reset_questions.sql`.

---

## Columns

**Required**

| Column | Values | Notes |
|---|---|---|
| `category` | `pyq` · `samacheer` · `current_affairs` · `aptitude` | which section |
| `question_text` | text | the question stem |
| `option_a` … `option_d` | text | the four options |
| `correct_answer` | `A` · `B` · `C` · `D` | the right option |

**Optional — classification** (fill what applies to the category)

| Column | Example |
|---|---|
| `subject` | `History and INM`, `Polity`, `Geography`… |
| `topic` | chapter / topic name |
| `group_type` | `Group1` · `Group2_2A` · `Group4_VAO` |
| `standard` | `6`–`10` (Samacheer) |
| `year` | `2023` (previous-year papers) |
| `ca_month` | `August 2025` (current affairs) |
| `ca_type` | `month_wise` · `topic_wise` |
| `ca_topic` | `Science & Technology`… |
| `aptitude_type` | `numerics` · `reasoning` |
| `aptitude_topic` | `Simplification`, `Dice`… |
| `difficulty` | `easy` · `medium` · `hard` (default `medium`) |
| `source_url` | leave blank → auto-tagged `tnpsc-official` |

**Optional — explanations & "why wrong"**

| Column | Notes |
|---|---|
| `explanation` | why the correct answer is right |
| `why_wrong_a`…`why_wrong_d` | why that option is wrong (only the non-correct letters are kept) |

**Optional — Tamil (bilingual)**

| Column | Notes |
|---|---|
| `question_text_ta` | Tamil question |
| `option_a_ta`…`option_d_ta` | Tamil options |
| `explanation_ta` | Tamil explanation |

---

## Rules

- The header row must use these exact column names (lower-case). Extra columns
  are ignored; missing optional columns are fine.
- Import is **all-or-nothing**: if any row fails validation, nothing is imported
  and the row numbers + reasons are shown so you can fix and re-upload.
- For CSV, wrap any field containing a comma, quote, or line break in double
  quotes (`"…"`); escape a literal quote by doubling it (`""`).

## CSV example

```csv
category,subject,topic,question_text,option_a,option_b,option_c,option_d,correct_answer,explanation,why_wrong_b
pyq,Polity,Constitution,"Who is the head of the Indian State?",President,Prime Minister,Chief Justice,Speaker,A,"The President is the constitutional head of state.","The PM is head of government, not state."
```

A ready-to-fill header is in **`docs/question-import-template.csv`**.

## JSON example

```json
[
  {
    "category": "aptitude",
    "aptitude_type": "numerics",
    "aptitude_topic": "Percentage",
    "question_text": "20% of 150 = ?",
    "option_a": "25", "option_b": "30", "option_c": "35", "option_d": "40",
    "correct_answer": "B",
    "explanation": "20% of 150 = 30.",
    "why_wrong": { "A": "That is ~16.7%.", "C": "That is ~23.3%.", "D": "That is ~26.7%." }
  }
]
```
