# web-pages — converting the pages, group by group

Each group = one commit, after `web-shell` + `web-page-kit`. Every page gets: Crumbs, PageGrid (aside where there is a natural sidebar), SectionBlock/Tile instead of bespoke cards, `web:` classes only. Native output must not change.

## Shared rules
- **Purpose**: browser pages look like the website; no behaviour change.
- **Impact (all groups)**: page files only + kit; no API/DB/route change. Risk = broken click targets, lost gating (credit wall, premium lock, free gate, feature flags), Tamil overflow.
- **Edge cases (all groups)**: empty/loading/error states keep `ErrorState`/`Skeleton`; locked items stay locked; 320px Tamil; dark mode; signed-out redirect unchanged.
- **Acceptance (all groups)**: Playwright screenshots 320/768/1280 × EN/TA × light/dark on web; native screenshot diff = 0; existing vitest passes; no console errors; every gate still blocks (manual check list per group in TESTING.md).

## Groups
| # | Group | Pages | Sidebar (desktop) | Group-specific risk |
|---|---|---|---|---|
| 3 | public — SKIPPED 2026-11-24: already website-style (own header, full footer w/ support + legal); swapping in the archive footer would drop those | Group1Landing, RankBooster, MockPack, TargetG2, AnswerKey, PastAnswerKey, Group4Notification | existing side boxes | pay links + GA4 events + OG share pages (`shareMeta.ts`) |
| 4 | home | TestArena | credits, streak, Thirukkural, CA carousel | SDUI regions, tour spotlight anchors, PushNudge, Starter Challenge CTA |
| 5 | practice | SubjectPractice, PreviousYear, PyqGroupChooser, PyqGroup, PyqSection, PyqAptitude, Aptitude, Samacheer, HistoryPeriods, Daily, ThirukuralQuiz | topic list / year filter | subject free gate, CreditConfirmPopup, year chips |
| 6 | ca | CurrentAffairs, CaQuestions, CaMagazineLink, CaTestLink, Materials, FlashcardDeck | day picker / months | signed URLs, share links, flashcards flag |
| 7 | tests | MockTest, MockInstructions, QuizInstructions, TestSeries, Vettri, Result; Quiz + MockQuiz question styling only | paper list / analytics | fullscreen proctoring, 2-attempt cap, no mid-test reveal, date gating |
| 8 | account | Profile, Insights, History, Revision, Bookmarks, Messages, PaymentSuccess, Policy | profile summary | sign-out, MFA, payment verify page, tour replay |
| 9 | auth | Login, Register, ForgotPassword, ResetPassword, CompleteProfile, LanguageScreen, WelcomeIntro, Setup | value-prop box | device-limit modal, Google button order, WhatsApp check, GA4 funnel |
| 10 | admin | AdminQuestions, AdminReports, SuperAdmin, Crm, SduiScreen | none | dense tables stay tables; shell + tokens only (pending decision) |

Not converted: `LandingPage.tsx` (unrouted).

## As built (2026-11-24)
- Groups 6–8: shell + kit primitives + `.card` (already the archive card) cover the look. Only grid-heavy pages widen to the website width (`web:max-w-6xl`): Materials, Insights, TestSeries, Bookmarks. Reading pages (instructions, policy, result, profile, revision, CA magazine) keep their narrow measure on purpose.
- CurrentAffairs + CaQuestions came in with PickerPage (group 5 commit).
- Quiz/MockQuiz: render outside AppLayout's chrome as before; no change.
- Group 9: `AuthShell` gets the website header (brand → `/`, language + theme) and `SiteFooter` on web → Login/Register/Forgot/Reset/CompleteProfile. LanguageScreen, WelcomeIntro, Setup left as full-screen first-run steps.
- Footer copy/links moved from AppLayout into `SiteFooter` (Site/PageKit.tsx) — one source for AppLayout + AuthShell.
- Group 10 (admin): shell already applies (all are AppLayout routes). Token pass: AdminQuestions correct-option green-50/700/500 → `correct` token (was wrong in dark mode). Kept on purpose: white toggle knobs, WhatsApp brand green, amber warning chips in SuperAdmin.
