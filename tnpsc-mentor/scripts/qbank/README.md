# The previous-year question archive

A static, pre-rendered HTML copy of every TNPSC previous-year question we hold,
served at `https://tnpscmentors.in/questions/`. Its job is brand visibility in
search: when somebody pastes a TNPSC question into Google, the page that answers
it should be ours.

The question, both languages, every option and the correct answer are in the
markup. No JavaScript is needed to read any of it, because a crawler that does
not run JavaScript is exactly the reader we are writing for.

**The explanation is not.** That is the trade the archive exists to make.

## What is in it, and what is behind the sign-in

| | On the open web | Behind a free account |
|---|---|---|
| Question, in English and Tamil | yes | |
| All options, with figures | yes | |
| Which option is correct | yes | |
| Subject, topic, paper and year | yes | |
| Why the answer is right | | yes |
| Why each wrong option is wrong | | yes |
| The Tamil explanation | | yes |
| The question as a timed test | | yes |

Previous-year questions and their answers are TNPSC's own published material, so
putting them on the open web costs us nothing and is what earns the search
result. The explanations are ours, and they are what an account is for.

Note how `lockedExplanation()` in `render.mjs` does this. It does **not** write
the explanation into the page and hide it behind a CSS blur. A blur over real
text is undone by View Source, by Reader mode, or by any of the extensions that
strip filters — the paid asset would be a right-click away. Worse, serving a
crawler text a visitor cannot read is the cloaking Google penalises. The blurred
bars on the page are decorative `<span>`s; the sentences they stand in for are
not in the HTML at all.

What the lock *does* say is true, and comes from metadata rather than content:
how many wrong options we can account for, and whether a Tamil version exists.
That is an honest advertisement for what is behind the door, and it is why
`verify.mjs` probes the built tree for explanation text and fails if it finds
any (see below).

## How it looks, and why

It is the answer-key pages' design, not a second one: the same sticky header
with the logo mark and the violet "Mentors", the same boxed sidebar switchers,
the same four feature cards, the same footer with the social row, the same
sticky bottom bar on a phone. Those pages are what a stranger arriving from
Google already meets, and two different public faces on one domain would be
worse than either alone.

Concretely, `render.mjs` mirrors `src/components/Landing/AnswerKeyChrome.tsx`
and `src/pages/AnswerKeyPage.tsx`:

- light only — those pages call `useForceLightTheme()`, so a dark-mode archive
  would be the odd one out;
- Plus Jakarta Sans for headings, Inter for body, Noto Sans Tamil / Anek Tamil
  for Tamil, loaded from Google Fonts in one request;
- the content/sidebar grid at `1fr 300px` from 1024px up, `max-w-6xl`;
- the sidebar boxes carry the switchers (papers, subjects, topics) rather than a
  row of pills competing with the H1, so somebody who landed on the wrong paper
  is one tap from the right one — from any page.

### How a question page is laid out

Modelled on the content pages that already win this kind of search (Unacademy's
formula pages are the clearest example). A question page is not one block; it is
a run of named sections, each with a heading shaped like something somebody
would type:

```
H1   the question itself, both languages
     the options, with the correct one marked
     ── contents box, linking to each section below ──
H2   What is the correct answer?        #answer      the answer as a sentence
H2   Why is (C) the correct answer?     #explanation locked, sign-in to read
H2   About this question                #details     exam, year, subject, …
H2   More questions from TNPSC …        #more        siblings
H2   Frequently asked questions         #faq         built from this row's facts
```

Three things that matters for:

- **"What is the answer to …" is a real query.** The options list marks the
  right one, but a list is not a sentence. `answerSection()` writes it out as
  prose under a heading that asks the question back.
- **The contents box** gives the page jump-links and makes the structure legible
  before you scroll. It only renders at three sections or more.
- **The FAQ is built from the row** — this question's wording, its keyed answer,
  its paper, its subject. No two pages carry the same sentences, which is what
  separates it from the FAQ boilerplate content farms paste everywhere. It
  carries `FAQPage` markup, but be honest about what that buys: since August
  2023 Google shows FAQ rich results only for government and health sites. The
  markup is harmless; the on-page text is the part that still works.

The meta description leads with the answer — `… Ans: (C) N. Gopalaswami
Ayyangar. Asked in TNPSC Group 1 2019.` — so the search result itself answers
the question. That is deliberate: a result that answers gets the click, and the
explanation is what the click is for.

Page weight is ~34 kB raw, ~7 kB gzipped. Turn on `gzip_static` (below) and the
whole tree serves in about 35 MB.

### Stems that are not one sentence

A tenth of this bank is match-the-following, and more again is numbered
statements or an assertion-and-reason pair. **The bank stores all of it with
real newlines, and HTML collapses newlines** — so 1,940 stems (38%) were
rendering as a single run-on paragraph:

> Match correctly with the Suitable Act. (a) Preventive Detention Act (PDA) in
> India (b) The National Emergencies Act was signed into law by President Gerald
> Ford on (c) … (a) (b) (c) (d) 1. 1971 2. 1974 3. 1950 4. 1976

`stemfmt.mjs` parses the lines back into the shape the printed paper had. Four
shapes are recognised — a match in two blocks, a match printed two-to-a-line, a
statement list, and assertion/reason — and anything not confidently one of them
falls through to plain line-preserved text, which still beats a run-on.

Because a `<table>` cannot live inside an `<h1>`, `stemHtml()` returns the
question sentence as `lead` (the heading) and the structure as `body` (a
sibling). An assertion stem with no opening sentence puts the Assertion line in
the heading instead, so no page ends up with an empty `<h1>`.

**The invariant is that nothing is lost.** Every token keeps its original line
in `raw`, and every fallback re-emits `raw`. The one thing ever discarded is the
printed answer-grid header (`     (a)  (b)  (c)  (d)`), which is the heading of
the grid that gets reproduced below as the four options and means nothing on its
own. That invariant is tested: `scratchpad/teststem.mjs` runs all 7,858 stem
fields through the parser and compares character multisets — order-insensitive,
because a match table deliberately interleaves the two columns — and fails on any
character dropped or duplicated. It currently reports **0 failures**. Re-run it
if you touch the parser; it caught three real bugs that reading the code did not
(dropped `List I` captions, a duplicated trailing line, and assertion/reason
never matching at all).

Known limit: a three-list match (`List 1 / List 2 / List 3`) has no two-column
form, so those fall through to line-preserved text rather than being paired
wrongly. There are only a handful.

### The language switch

A first-time visitor gets the same **"Select your language"** card the
answer-key pages show — a port of `src/components/Landing/LandingLangPrompt.tsx`,
same two colours, same wording. It reads and writes
**`tnpsc-landing-lang`, the same localStorage key**, so somebody who chose Tamil
on the answer-key page is not asked again here and a choice made here carries
back. A second key, `tnpsc-archive-lang-asked`, records that the question has
been put, so choosing "both" — which the landing pages cannot express, and
therefore store as nothing — does not make the card reappear on every page.

One deliberate difference from the original: this one has a way out. The app's
version has no close button, which is right for a pay page; this one is reached
from a search result, and a reader who wants the question in both languages
should not have to pick one to see it. **Show both** and Escape do that.

The card is in the HTML but `hidden`, and only the script unhides it — so with
JavaScript off, and for a crawler, it never appears and both languages stay on
the page. Worth watching in Search Console all the same: Google treats a
pop-up that covers the main content on mobile as an intrusive interstitial, and
it is not on their exempt list the way a cookie notice is. If impressions dip
after launch, the fix is to make it a bar along the bottom rather than a modal.

Behind it, the header keeps three states: **Both · English · தமிழ்**, defaulting
to Both.

A two-way toggle cannot say which language you are reading when the honest
answer is "both", and Both has to be the default so that a crawler — and anyone
with JavaScript off — still sees the Tamil question text and indexes it. The
choice is remembered in `localStorage`; with no JavaScript the control simply
does nothing and both languages stay on the page.

Two kinds of bilingual text, and they behave differently:

- `both(en, ta)` — **content**. Stacks: the English line, the Tamil under it.
- `one(en, ta)` — **chrome**: nav links, buttons, stat captions, sidebar
  headings. Shows English until Tamil is chosen, then shows only Tamil.
  Stacking two languages inside a pill makes the furniture taller than the
  thing it points at.

Getting this wrong is visible immediately — `both()` inside a short inline label
renders as `363 questionsவினாக்கள்`, run together. If you add a label, ask
whether it is content or furniture.

## Scope

Categories `pyq` (Group 1), `pyq2` (Group 2 / 2A) and `pyq4` (Group 4 / VAO).
Nothing else.

It is an **allow-list, not a deny-list**, in both `export.mjs` and `build.mjs`.
A category added to the table later stays off the web until somebody decides
otherwise, which is the right default when the cost of a mistake is the paid
bank on Google. In particular `mock` and `testseries` are the Mock Pack and Test
Marathon papers people pay for, and `subject` / `outer` / `aptitude` /
`current_affairs` are our own authored bank — the thing a subscription buys.
Widening the list is a pricing decision, not a build flag.

Rows with `active = false` are out too: a question hidden from the app's own
quizzes should not be the thing Google indexes.

`build.mjs` additionally holds back any question that is defective — no valid
`correct_answer`, fewer than two options, or two identical options (a real fault
in the Tamil side of the pyq2 bank). Those are listed in the build report rather
than published. **Read that list**: it is also a to-do for the bank itself.

## Shape

Papers lead, because `tnpsc group 2 2024 question paper` is a search people
make. The eight units of the Group 1 2026 preliminary paper are the second axis,
with the marks each one carries — those names and weights come from
`src/lib/answerKeyGroups.ts`, which is also what the answer-key pages show, so
the whole site speaks one vocabulary.

```
/questions/                              the hub: papers, then the 8 units
/questions/past-papers/                  every paper we hold
/questions/past-papers/group-1-2024/     one paper, paginated 50 to a page
/questions/<unit>/                       a unit, its topics, then its questions
/questions/<unit>/<topic>/               a topic, paginated
/questions/q/<slug>/                     ONE question — the page meant to rank
```

The `<slug>` is built from the question's own wording, which is the string
people search. It is assigned in `id` order, so a rebuild gives the same
question the same URL and no link ever rots. A Tamil-only stem has no
transliteration to slugify, so those fall back to `tnpsc-question-<id prefix>`.

Only `/questions/q/<slug>/` carries content. Everything else exists to get a
crawler to those pages and to give a visitor somewhere to go next — which is why
each question page also links its topic siblings, the previous and next
question, its topic and unit, and the paper it was asked in.

### It links the answer-key pages rather than competing with them

`/questions/past-papers/group-1-2024/` and the live `/tnpsc-group-1-answer-key-2024`
both answer "tnpsc group 1 2024 answer key". Left alone they would split that
query between them, so `ANSWER_KEY_PAGES` in `build.mjs` links each paper page
to its key: this page is the paper question by question, that one is the key in
order with a PDF. Add a row there whenever a new answer-key page goes live.

## Building it

```bash
# 1. See what is there, and check every subject maps onto a unit. Reads only.
STUDIO_USER=tnpscadmin STUDIO_PASSWORD=… node scripts/qbank/export.mjs --stats

# 2. Download the rows.
STUDIO_USER=tnpscadmin STUDIO_PASSWORD=… node scripts/qbank/export.mjs

# 3. Generate the tree into qbank-dist/.
node scripts/qbank/build.mjs

# 4. Check it before it goes anywhere.
node scripts/qbank/verify.mjs
```

Step 1 prints any `subject` value that maps to no 2026 unit. Fix those by adding
an alias in `taxonomy.mjs` before step 3 — anything unmapped lands in a catch-all
"General Studies" unit, which is a worse page than it needs to be.

`verify.mjs` fails the build on:

- explanation text found anywhere in the published HTML — the gate, tested
  rather than promised;
- a dead internal link, a duplicated canonical, a missing `<h1>`, an empty title
  or description;
- JSON-LD that does not parse;
- a sitemap entry pointing at a file that was never written.

All of those are cheap to fix now and expensive to discover in Search Console in
three weeks.

To look at the result before it goes anywhere:

```bash
node scripts/qbank/serve.mjs      # http://localhost:4178/questions/
```

That server copies production's `try_files $uri $uri/index.html $uri/` instead
of being a forgiving dev server, and mounts the tree at `/questions/` — the path
every canonical and internal link is written against. A link that resolves there
resolves on the VPS, and 404s print to the console as you browse.

To work on the templates without touching the database:

```bash
node scripts/qbank/make-fixture.mjs
node scripts/qbank/build.mjs  --src server/_qbank/fixture.ndjson --out qbank-sample
node scripts/qbank/verify.mjs --src server/_qbank/fixture.ndjson --out qbank-sample
npx serve qbank-sample      # or any static server
```

The fixture deliberately includes the cases that have broken things before: a
Tamil-only stem, LaTeX in an aptitude stem, a figure question, currency amounts
that must not be typeset as mathematics, two identical options, a null
`correct_answer`, a subject that maps to no unit, and rows from categories
outside the published scope so the scope guard is exercised every single build.

## Serving it

`/var/www/tnpsc` is the main domain's root and its nginx `location /` already
does `try_files $uri $uri/index.html $uri/ /index.html`, so a directory of
`index.html` files under `questions/` resolves with **no nginx change at all**.

```bash
# from the laptop, after building and verifying
bash scripts/qbank/deploy.sh <user>@srv1778326.hstgr.cloud
```

That script re-runs `verify.mjs`, stages through `/tmp/qbank/`, installs with
`--delete`, regenerates the `.gz` files and then curls the live URLs. Doing it by
hand is the same two rsyncs:

```bash
rsync -az --delete qbank-dist/ <user>@srv1778326.hstgr.cloud:/tmp/qbank/
ssh <user>@srv1778326.hstgr.cloud 'sudo rsync -a --delete /tmp/qbank/ /var/www/tnpsc/questions/'
```

`deploy/deploy.sh` excludes `/questions/` from its own `rsync --delete`, so an
ordinary app deploy no longer wipes the archive. It is kept out of `dist/` on
purpose: `cap sync` bundles `dist/` into the Android app, and the archive has no
business in an APK.

Worth turning on, since the archive is compressible text — in the main server
block:

```nginx
gzip_static on;   # serves pre-compressed .gz when present
```

and then `find /var/www/tnpsc/questions -name '*.html' -exec gzip -9 -k {} \;`
after each sync. **Edit nginx on the box with `sed`, never by copying
`deploy/nginx-tnpsc.conf` over it** — the live config has certbot's changes in it
that the repo copy does not.

## Telling Google about it

1. `public/robots.txt` lists the archive's sitemap index (already added).
2. `public/sitemap.xml` lists the archive hub and the past-papers hub as ordinary
   URLs (already added). It is a `<urlset>`, so it cannot nest a sitemap index —
   robots.txt is what points crawlers at `/questions/sitemap.xml`.
3. In Search Console, submit `https://tnpscmentors.in/questions/sitemap.xml`.
4. Expect it to take weeks. The internal linking between sibling questions is
   what gets the long tail picked up, so do not strip it.

## Keeping it current

Re-run the four steps whenever a PYQ bank changes — a newly loaded paper, a batch
of fixed explanations, a round of disabled rows. Nothing is incremental; a
rebuild is a full rebuild, which is also what keeps slugs stable.

## When the app's rendering changes

`render.mjs` carries its own copy of two things from the app:

- the palette from `src/index.css`, as literal hex;
- the math rules from `src/components/UI/MathText.tsx`.

They are duplicated because this tree is built outside Vite and loads neither
Tailwind nor React. If either changes in the app, change it here too — the two
are meant to look like one site, and as of 2026-10-03 `isLiteralDollarSpan` is
character-for-character the same in both. Two of its rules were found by this
archive and ported back into the app: a currency span like `$400 to $500`, and
Tamil prose caught between two stray dollar signs. Both used to be typeset as
mathematics and came out as unreadable italics.
