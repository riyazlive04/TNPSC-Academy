# Sales Plan — converting free aspirants to Premium / Vettri Nichayam

Written 2026-07-28. Companion to the dashboard change that removed the permanent
payment banner from the Test Arena and replaced it with a **credit-triggered**
one (`src/components/UI/CreditWall.tsx`).

---

## 1. What we sell (fixed facts)

| Plan | Price | Period | Core promise |
| --- | --- | --- | --- |
| **Vettri Nichayam — full** | ₹899 | 2 months | 13-paper Test Marathon + unlimited PYQ + unlimited Current Affairs |
| **Vettri Nichayam — monthly** | ₹499 | 1 month (pay again for month 2) | Same, half the commitment |
| **Premium** | ₹1,699 | 3 months (90 days) | Everything: unlimited tests everywhere, all mock exams, the Marathon, PDFs, insights |

Free tier is a **credit meter**, not a feature lock:

- 50 credits at signup, **+10 per day** from the day after signup (login required)
- **1 credit = 1 question** — a 20-question test costs 20, a 200-question mock costs 200
- The daily 10 **expire at IST midnight** — they cannot be banked
- +25 one-time bonus when the first test is graded; free users get **1 mock exam ever**

The consequence worth naming plainly: **a free user can never afford a full mock
exam** (200 credits vs 10/day that expire). Credits buy taste, not preparation.
That is the entire sales argument, and every message below is a restatement of it.

---

## 2. Why the always-on banner was the wrong instrument

The dashboard used to render `VettriCard` + `PremiumCard` on every visit for
every free user. That has three costs:

1. **Banner blindness.** A card seen 40 times without intent is furniture. By the
   day it matters, the eye skips it.
2. **No felt problem.** A learner with 300 credits reads "unlimited tests" as an
   abstraction. Pricing answers a question they haven't asked yet.
3. **Dashboard dilution.** Two large pricing cards push practice entry points
   below the fold — we sell slightly worse *and* teach slightly worse.

The fix is not "sell less". It is **sell at the moment of blockage**, which is
also the moment the offer is objectively true.

---

## 3. The conversion moment: credit exhaustion

Every free learner hits the same wall on a predictable schedule. Ordering the
funnel around that wall is the plan.

```
  Signup (50cr)  →  first tests  →  balance drains  →  <20cr  →  0cr  →  DECISION
      │                  │                              │         │
      │                  └─ +25 first-test bonus        │         └─ full payment banner
      └─ tour + Starter Challenge                       └─ "only N left" strip
```

**Now live (this change)** — `CreditWall` on the Test Arena dashboard:

| Balance | Surface | Intent |
| --- | --- | --- |
| ≥ 20 | nothing | Keep the dashboard about studying |
| 1–19 | Compact amber strip: *"Only N credits left — that's not enough for one full test"* → opens the upsell modal | Warn **before** the wall, while motivation is still high |
| 0 | Full banner: *"Your practice is paused — not your exam date"* + Vettri card + Premium card | Convert at maximum felt cost |

Plans stay discoverable for everyone else through the Vettri tile in the practice
grid, the Test Marathon tile, and the Profile screen — nothing is hidden, it just
stops shouting.

**Already live elsewhere** (unchanged): the forced `UpsellModal` on a 402
`insufficient_credits`, on a locked mock/Marathon/Vettri tap; pricing cards on
Mock Test, Subject Practice, PYQ, Current Affairs, Test Series, Vettri and
Profile pages.

---

## 4. The offer ladder

Never present one price to a hesitant buyer; present a *choice of yes*.

1. **₹499 monthly Vettri** — the objection-killer. "One month, less than a
   coffee a week." Lead with this for price-sensitive and first-time buyers.
2. **₹899 full Vettri** — the value anchor. Show the per-month maths (₹449.50/mo)
   next to ₹499 so the full plan reads as the obvious choice.
3. **₹1,699 Premium** — the completionist. Position as "everything, for the whole
   exam cycle" (≈ ₹566/month), not as "the expensive one".

The `VettriSuggestModal` already intercepts a Premium tap with the cheaper
bundle. Keep that — down-selling a hesitant buyer beats losing them, and Vettri
buyers upgrade to Premium later from Profile.

---

## 5. Message per moment (bilingual, always)

Copy rules for this audience: **Tamil first in tone**, concrete, exam-dated, no
marketing abstractions. Every string goes through `src/lib/i18n.ts` with a real
Tamil translation — never an English-only sell.

| Moment | Message | Emotional lever |
| --- | --- | --- |
| Low credits (1–19) | "Only N left — not enough for one full test" | Loss aversion, pre-emptive |
| Zero credits | "Your practice is paused — not your exam date" | Urgency against a fixed deadline |
| Blocked mock start | "This test needs 200 credits, you have N. Free credits will never cover a full mock." | Honest arithmetic |
| After a weak result (<50%) | "This topic needs 3 more tests this week — go unlimited" | Self-diagnosis, not sales |
| After a strong result (≥80%) | "You're ready for a full 200-question mock" | Aspiration at peak confidence |
| Streak at risk with 0 credits | "Your N-day streak ends tonight" | Sunk cost + streak protection |
| Marathon paper day | "Paper 7 goes live tomorrow — N aspirants are attempting it" | Social proof + FOMO |

---

## 6. Lifecycle campaigns (existing infrastructure, no new stack)

All four channels already exist: Web Push (VAPID), in-app notification feed,
`app_alerts` popup announcements, and targeted `notifyUser`.

| Day | Trigger | Channel | Message |
| --- | --- | --- | --- |
| 0 | Signup | Tour + Starter Challenge | Establish the habit before selling anything |
| 1 | First test graded | In-app | "+25 bonus credits — here's your weak subject" |
| 3–5 | Balance first hits 0 | Push + in-app | "You're out of credits. 10 free tomorrow, or go unlimited today" |
| 7 | 3rd zero-credit day | Push + `app_alerts` popup | ₹499 monthly Vettri pitched by name, with a coupon |
| 10 | Mock exam blocked | In-app | "Free credits can't cover a 200-question mock — see what a real exam feels like" |
| 14 | Still free, ≥5 tests taken | WhatsApp/push | High-intent segment: a 48-hour coupon |
| Any | Marathon paper T-1 | Push | Date-driven urgency (best-performing trigger — a real event, not a promo) |

Frequency discipline: **at most one monetisation message per 48 hours**, and
never during the first-run tour. An uninstall costs more than a discount.

---

## 7. Pricing levers, in the order to pull them

1. **Urgency, not discount, first.** TNPSC exam dates and Marathon paper dates
   are real deadlines — use them before touching price.
2. **Coupons (live).** Promoter codes work end-to-end including 100%-free. Use
   time-boxed codes (48h) on the day-14 high-intent segment. Never a standing
   public discount — it teaches waiting.
3. **Credit top-ups as an anchor, not a product.** If a paid top-up is ever
   added, price it so that ~2 top-ups ≥ ₹499. Its job is to make the subscription
   look obvious, not to earn revenue.
4. **First-test bonus (live, +25).** Cheap habit fuel; keep it.

---

## 8. Instrumentation — what to watch

Already wired: `trackInitiateCheckout` (recap/suggest opened) and
`trackCheckoutConfirmed` (Razorpay opening) via GTM + Meta Pixel; Clarity for
session replay; superadmin console for revenue and user metrics.

Worth adding (small, one event each):

- `credit_wall_view` with the balance state (`low` / `zero`) — the denominator
  for everything below
- `upsell_modal_open` with its variant (`credits` / `premium` / `bundle`)
- `plan_selected` with the plan id, so ₹499 vs ₹899 vs ₹1,699 preference is visible

Funnel to report weekly:

```
zero-credit users → banner viewed → checkout initiated → confirmed → paid
```

Benchmarks to hold ourselves to (30-day cohort): **≥60%** of zero-credit users see
the banner (the rest bounce before the dashboard — a routing problem, not a copy
problem), **≥15%** initiate checkout, **≥35%** of those pay. Anything below and the
weak stage is diagnosable rather than guessable.

---

## 9. Backlog, ranked by expected return per hour of work

1. **Result-page upsell** — no pricing surface exists on `ResultPage` today, and
   it is the highest-emotion screen in the app. Score-conditional copy (§5).
2. **Zero-credit push notification** — the only way to reach a user who stopped
   opening the app. Infrastructure exists; the trigger doesn't.
3. **Per-plan analytics events** — §8; cheap, and every later decision depends on it.
4. **Credit forecast on the dashboard** — "at 10/day, your next full mock is 20
   days away" makes the arithmetic undeniable without a single sales word.
5. **Social proof on the pricing cards** — "N aspirants took Paper 6 this week",
   read from real attempt counts. Only ship with real numbers.
6. **Win-back for lapsed paid users** — an expiring plan is the warmest lead we
   will ever have; today it expires silently.

---

## 10. Guardrails

- The payment banner appears **only** when a paywall genuinely blocks the user.
  No timed pop-ups, no interstitials over study screens.
- Every paid claim must be true on the day it is shown — if the Marathon is off,
  its perk is not pitched.
- Nothing already paid for is ever re-pitched; cards self-hide on entitlement.
- Bilingual or it doesn't ship.
- The free tier must stay genuinely useful. 10 credits a day is a real daily
  practice habit — the habit is what makes the plan worth buying.
