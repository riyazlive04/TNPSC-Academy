# Flagged Group-4 / VAO (pyq4) PYQ questions

Raised while loading the Group 4 bank (2026-07-15, 1000 rows / 5 years; extended 2026-08-13 to
1400 rows / 9 years). Unlike the G1 and G2 lists, nothing here is OCR corruption — the source is
clean. Everything below is **loaded and live**; this is the review checklist, not a blocker.

Sections 1 and 2 came from the 2018–2025 load; section 3 from the 2011/2012/2014/2016 load.

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

## 3. 2011 / 2012 / 2014 / 2016 load — verification findings

All 400 questions were answer-checked before loading. Every key verified correct except the rows
below. Nothing was silently changed: the printed/source key was kept in all cases.

### 3a. Officially defective — no single correct option (3)

| qid | Keyed | Why it is defective |
|---|---|---|
| `2011_Q92` | **D** | "World Diabetes Day is observed on" — options are May 27 / April 27 / June 27 / July 27. The real date is **14 November**. *No option is correct.* Best candidate for `active=false`. |
| `2014_Q141` | **D** | "Choose the incorrect pair" — **two** options are incorrect pairs: (C) Sebastian Vettel–Tennis (he is Formula 1) and (D) Dale Steyn–Hockey (cricket). A student picking C is right and marked wrong. |
| `2014_Q180` | **B** | "Registration of Partnership is" — (B) *Optional* and (D) *Not compulsory* mean the same thing. Both are true; only B is keyed. |

Deactivate the worst of them with:
`update questions set active=false where external_id in ('pyq4-2011-Q92','pyq4-2014-Q141','pyq4-2014-Q180');`

### 3b. One distractor wrong, but the key is still forced (2)

Left live — three of the four pairs pin the answer, so the intended option is unambiguous.

- `2012_Q100` — maps **Cristiano Ronaldo → Netherlands**; he is Portuguese, and Portugal is not in
  List II. Rooney→England, Maradona→Argentina, Ronaldinho→Brazil force (C) regardless.
- `2014_Q197` — maps **Armed Forces Flag Day → Dec 10**; it is **Dec 7** (Dec 10 is Human Rights
  Day). The other three pairs force (B).

### 3c. Debatable keys — source key retained (4)

Worth a second opinion if student reports come in, but each is defensible as printed.

- `2011_Q46` — "the cutting action of waves against the base of coastal land *initially* produces":
  keyed **Cliff**; the erosional sequence notch → sea cave → cliff argues for *Sea cave*. The author
  flagged this one too.
- `2011_Q82` — India's cyber crime regulation court year, keyed **2008**; not independently
  cross-verifiable (CRAT dates to 2006, the IT Act amendment to 2008).
- `2012_Q16` — Assertion–Reason on the 1905 Bengal partition, keyed **(A) R is not the correct
  explanation**. Curzon's divisive motive arguably *is* the explanation, i.e. (B).
- `2014_Q164` — Reason says a Governor's ordinance "must be approved by the legislative within
  **six months**"; Art. 213 actually gives **six weeks from reassembly**. Keyed (D) both true.

`2011_Q93` (first woman electric train driver) and `2011_Q80` carry the author's note that they were
corrected against an independently-found 2011-era TNPSC key — trusted, but not from an official PDF.

### 3d. Tamil steps in English — 33 more rows

Same pattern as section 2, now spanning the new years: 2011 (4), 2012 (10), 2014 (13), 2016 (6).
Same decision — the maths carries the meaning and the Tamil headers are intact.

### 3e. Figures — audited, clean

7 crops (2012_Q51; 2014_Q115/119/126/166/171/176). Each was **viewed before upload** for the
answer-key leak that hit two earlier Group 4 crops — all clean, none shows a key. Each of these
stems also carries a bracketed prose description of its figure, so the question stays solvable if
the image ever fails to load.

## Not an issue (checked, recorded so it isn't re-investigated)

- **2011/2012/2014/2016 are 100 rows each, not 200.** Those sources carry the GS+Maths paper only;
  there is no General Tamil half for them. So the Tamil section still spans 2018–2025 only, while
  General Studies and Aptitude span 2011–2025.
- **General Tamil paper is Tamil-only (500 rows).** By design — that paper has no English version.
  Stored in the PRIMARY columns with `_ta` null, per the Group 2 English/Tamil convention, so it
  renders Tamil in every language mode.
- **Option (E) "விடை தெரியவில்லை" dropped** on the 600 five-option rows. Consistent with every other
  bank: no row in `questions` has ever populated `option_e`.
- **Sub-type topics are ours, not the source's.** The source `topic` is free text (365 distinct
  values across 373 GS rows). `import_pyq4.mjs` classifies it into the picker's fixed sets; the
  original string is preserved verbatim in `aptitude_topic` and shown as the badge, so nothing is
  lost and a reclassification can be re-run at any time.
