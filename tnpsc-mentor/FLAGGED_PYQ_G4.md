# Flagged Group-4 / VAO (pyq4) PYQ questions

Raised while loading the Group 4 bank (2026-07-15, 1000 rows / 5 years). Unlike the G1 and G2
lists, nothing here is OCR corruption — the source is clean. Two issues only, both **loaded and
live**; this is the review checklist, not a blocker.

## 1. Officially defective questions — 3 (keys supplied by us, not TNPSC)

These three carried `answer: ""` in the source *deliberately*: TNPSC published no key because the
question is defective. The source explanation already researched each one and named the defensible
option, so we keyed them to that and recorded the reasoning in `answer_note` (+ `defective: true`)
in `Content_materials/Group_4/2019_group4_app.json`.

**The keys are ours, not the commission's — confirm before treating them as authoritative.**

| qid | Keyed | Why it is defective |
|---|---|---|
| `2019_Q171` | **D** | The EN and TA stems ask *different questions*. EN asks which Article deals with Fundamental **Rights** — no option is correct (Part III spans Art. 12–35). TA asks Fundamental **Duties** → Art. 51A = (D). Keyed to the Tamil reading. |
| `2019_Q173` | **D** | Parliament passed the RTI Bill on 11–12 May 2005; **none of the four options is that date**. (D) 12 Oct 2005 is the *commencement* date — the only significant date offered. |
| `2019_Q174` | **A** | EN pairs cleanly as (a)-4 (b)-3 (c)-2 (d)-1 = (A). The **TA version replaced item (d) with "Republic Day"**, which matches no listed date, so the Tamil reading has no correct pairing at all. |

### Recommended follow-up
- `2019_Q171` and `2019_Q174` are **unanswerable in one language as printed**. A Tamil-mode student
  on Q174, or an English-mode student on Q171, can be marked wrong for reasoning correctly. Either
  correct the faulty stem to match its sibling, or set `active=false` on the pair. They are the most
  likely candidates to generate student error-reports (`/admin/reports`).
- Deactivate with:
  `update questions set active=false where external_id in ('pyq4-2019-Q171','pyq4-2019-Q174');`

## 2. Aptitude worked solutions with English step lines — 57 (numerics only)

The source left `explanation_ta.steps` in English on many aptitude rows. The **18 reasoning** rows
were translated (their steps are prose — "Count the smallest single-region triangles = 8" reads
badly to a Tamil student). Reasoning is now clean.

**57 of the 105 numerics rows** still carry at least one English *prose* line inside an otherwise
Tamil solution — e.g. `Let second number = y`, `Since Amount = 3P, x = 3`,
`Check (A): opposite sides parallel — true for every parallelogram`. Left as-is by decision: the
maths carries the meaning and their `given` / `key_point` / `asked` / `final` **are** in Tamil.

Beware two traps when re-checking this:

- A whole-column test (`explanation_ta !~ '[஀-௿]'`) returns **zero** — every solution has Tamil in
  its headers, so the check must be **per line**.
- A per-line "no Tamil characters" test **over-counts** (it flags 78). Most of those lines are pure
  maths — `$e^{0}$ = 1` has no Tamil because it needs none. Only lines with real English *words*
  count.

The exact rule behind the 57, reproducible from `tnpsc-mentor/server`:

```js
// node --env-file=.env  (needs pg)
const prose = (line) => {
  if (/[஀-௿]/.test(line)) return false               // has Tamil -> fine
  const s = line.replace(/\$[^$]*\$/g, ' ')          // drop inline maths
               .replace(/\\[a-zA-Z]+/g, ' ')         // drop LaTeX commands
  return (s.match(/[A-Za-z]{3,}/g) || []).length >= 2 // >=2 real English words
}
// rows where explanation_ta.split('\n').some(prose), for aptitude_type='numerics'
```

**Known false positive:** `pyq4-2024-Q200` (reasoning) trips any such check on
`Sunday = 2, Tuesday = 3, Thursday = 2`. That is the question's own coding table — the puzzle counts
vowels in **English** day names, so the English is intrinsic. Do not "fix" it.

## Not an issue (checked, recorded so it isn't re-investigated)

- **General Tamil paper is Tamil-only (500 rows).** By design — that paper has no English version.
  Stored in the PRIMARY columns with `_ta` null, per the Group 2 English/Tamil convention, so it
  renders Tamil in every language mode.
- **Option (E) "விடை தெரியவில்லை" dropped** on the 600 five-option rows. Consistent with every other
  bank: no row in `questions` has ever populated `option_e`.
- **Sub-type topics are ours, not the source's.** The source `topic` is free text (365 distinct
  values across 373 GS rows). `import_pyq4.mjs` classifies it into the picker's fixed sets; the
  original string is preserved verbatim in `aptitude_topic` and shown as the badge, so nothing is
  lost and a reclassification can be re-run at any time.
