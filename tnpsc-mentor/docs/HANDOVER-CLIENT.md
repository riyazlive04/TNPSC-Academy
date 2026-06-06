# TNPSC Mentor — Client Overview

A bilingual (English / Tamil) TNPSC exam-preparation app with a large, well-organised
question bank, auto-graded tests, written explanations for every question, progress
analytics, revision, and current affairs that update automatically every month.

---

## 1. What the question bank contains

Around **12,700 multiple-choice questions** (settling to ~**10,300 unique** after a
duplicate-cleanup pass), and **94% are available in both Tamil and English**. Every
question has four options, the correct answer, and a written explanation.

| Section | Approx. questions | What it covers |
|---|---:|---|
| **Previous Year / Subject-wise GK** | ~8,500 | History, Polity, Geography, Economy, Science (Physics/Chemistry/Biology), Tamil Nadu history & administration, plus General Tamil & General English |
| **Current Affairs** | ~1,875 | Month-wise and topic-wise (awards, defence, economy, environment, schemes, polity, science, sports, places in news) |
| **Samacheer (State Board)** | ~1,190 | School-syllabus foundation questions |
| **Aptitude & Reasoning** | ~1,075 | Quantitative aptitude + logical/verbal/non-verbal reasoning |

The app is organised the way the exam is: **Group 1, Group 2/2A, and Group 4 & VAO**,
each showing its relevant **subjects** (Group 2/4 also include the General Tamil and
General English papers).

## 2. Where the questions come from

Every question records the exact web link it was collected from. Sources, in plain terms:

| Source | What it provides | Tamil? |
|---|---|---|
| **TNPSC Master** | TNPSC subject-wise questions **with explanations** | ✅ Yes |
| **TNPSC Guru** | TNPSC subject-wise practice questions | ✅ Yes |
| **Shankar IAS Academy** (via TNPSC Thervu Pettagam) | Monthly current-affairs quizzes | ✅ Yes |
| **GKToday** | Current affairs (monthly + topic-wise) | Added via translation |
| **IndiaBix** | General knowledge, aptitude & reasoning practice | Added via translation |
| **Genuine previous-year papers** | Real past TNPSC questions (from paper archives) | Partial |

A small set of native Tamil questions also came from an open academic dataset.

## 3. Language support

The interface, labels, and explanations are bilingual. **Questions are kept in English**
(as requested), with **Tamil versions provided for 94% of them**, so learners can study
in English, Tamil, or both — and switch anytime.

## 4. How the explanations help learners

Every question has an explanation that does two things, honestly:
1. explains **why the correct answer is correct**, and
2. explains **why each wrong option is wrong** — so a student who picks the wrong
   choice is told exactly why it was wrong.

These are AI-assisted but **anchored to the verified correct answer** (the AI only
explains the known answer, it never decides it), which prevents misleading guidance.
Answers and explanations appear **only after the test is submitted**, on a consolidated
results page — never during the test.

## 5. Staying current

Current affairs refresh **automatically every month** with no manual work — a scheduled
job collects the latest questions and adds only new ones, keeping the section relevant
throughout the exam cycle.

## 6. Important note on sources & copyright

*This is general information, not legal advice — please get an Indian IP lawyer's sign-off
before charging users at scale.*

Most questions are gathered from **public** TNPSC practice websites for educational
preparation. Two points to be aware of:

- **Facts and answers cannot be copyrighted** — a factual question and its answer are free
  to use. We have also **written our own explanations** (not copied from the sources) and
  **paraphrased the question wording into original phrasing**, which removes the main
  copyright exposure. Genuine past exam-paper questions are kept exactly as they appeared.
- **Before monetising at scale**, it is worth (a) paraphrasing/originating any remaining
  verbatim content, (b) keeping our own explanations, (c) gradually replacing or licensing
  the highest-risk items, and (d) not displaying competitor source links to end-users
  (they are stored internally only). The per-question source link makes this easy to manage.

This is a normal, expected step for a content app — flagged here for full transparency.

---

*Full question listings (every question with options, the correct answer, the explanation,
and its source link, grouped by category) are provided separately in the
`question-bank/` documents.*
