# Legal handoff — what only you (or your advocate) can supply

Everything that could be fixed in code has been. What remains is **8 facts** and
**5 decisions** that are yours to make. Until they're supplied, the policy pages
print *"to be confirmed"* where a registered address or a Grievance Officer
belongs — honest, but not publishable.

All 8 live in **one place**: `src/lib/legalContent.ts` → `COMPANY`.
Replace the `TODO:` string with the real value. Then:

```bash
npm run legal:export     # regenerates legal/*.md; exits non-zero while any remain
```

The dev server also shows a red banner on every policy page listing what's still
outstanding, so this cannot be forgotten quietly.

---

## The 8 facts

| Field | What's needed | Why it's not optional |
|---|---|---|
| `legalName` | Registered entity name, exactly as on the GST/incorporation certificate | Consumer Protection (E-Commerce) Rules 2020 require the seller's legal identity. "Sirah Digital" as a trade name isn't enough if the registered name differs. |
| `address` | Full registered address with PIN | Same rule. Google Play also requires a physical address for paid apps, and it's published on your store listing either way. |
| `gstin` | Your GSTIN | Required on anything functioning as a tax invoice for Indian sales. |
| `gstTreatment` | Whether displayed prices **include** or **exclude** GST | ₹1,699 means two different things to a buyer. Ambiguity here is the most common consumer-forum complaint against ed-tech. |
| `grievanceOfficerName` | A **real named person** | IT Rules 2021 and the DPDP Act both require a named grievance contact — a role mailbox alone doesn't satisfy either. |
| `grievanceEmail` | e.g. `grievance@tnpscmentors.in` | Must be monitored; you're committing to acknowledge in 48 hours and resolve in 15 days. |
| `jurisdictionCity` | Which courts have exclusive jurisdiction (e.g. Chennai) | Without it your Terms have no enforceable forum clause. |
| `liabilityCap` | e.g. "the amount you paid in the 12 months before the claim" | An uncapped liability clause is the single most expensive blank in the document. |

## The 5 decisions

**1. Is the Grievance Officer commitment real?** The policy now promises
acknowledgement in 48 hours and resolution in 15 days. If nobody can meet that,
change the numbers in `COMPANY` — an unmet published SLA is worse than a longer
honest one.

**2. Retention periods.** I've written **8 financial years** for payment records
(Indian tax/accounting practice), **90 days** for technical logs, and **35 days**
for backups. Confirm the last two match what Supabase and your host actually do —
I asserted them from a sensible default, not from your provider's contract.

**3. Past-paper and textbook content.** The app reproduces scanned figures from
official TNPSC papers and Samacheer material. The Terms now say rights in the
original papers remain with their owners and that reproduction is for educational
commentary. Whether that position is sound is a call for your advocate.

**4. Have the advocate re-review.** The previous review was 24 June 2026. Since
then the app gained in-app purchases, two app stores, native push, account
deletion and the credit system — and I rewrote every policy. **I have removed the
"reviewed and verified by an advocate" line from the pages**, because it is no
longer true of this text. Put it back once it is.

**5. The old `.docx` pack is stale.** `legal/*.docx` were generated from the
previous drafts. Regenerate with `md2docx.py` after `npm run legal:export`, and
re-send to Razorpay if they hold a copy.

---

## What was actually fixed

For your advocate's context, these were live problems, now closed:

- **Payment and Refund policies described a product that no longer exists** — a
  "one-time ₹1,699 Group 1 Prelims Kit valid until the Prelims exam". Rewritten
  to the real Premium / Vettri / Vettri-monthly plans and the credit system.
- **Refunds assumed Razorpay for everything.** App Store and Play purchases are
  refunded by Apple and Google — you *cannot* refund them. Each route is now
  documented separately.
- **Children's age was 13** (a US COPPA figure). The DPDP Act defines a child as
  **under 18**. Corrected, and a "16+ with parental consent" line in the drafts
  was removed — that carve-out requires a government designation nobody has.
- **No consent at signup.** DPDP requires clear affirmative action; "by using
  this app you agree" doesn't qualify. There is now a required checkbox covering
  both consent and the 18+ affirmation.
- **Trackers fired before consent.** GTM, Clarity and the Meta Pixel loaded on
  page load. They now load only on acceptance, and the `<noscript>` pixel
  fallbacks — which could not be gated — were removed.
- **Two divergent policy sets.** The thorough drafts in `legal/` were never
  published; the thin version was. There is now one source, and the markdown pack
  is generated from it.
- **No operator identity, no Grievance Officer, no data-location disclosure.**
  All three are now on every policy page. Data location is stated as Sydney
  (`ap-southeast-2`, via Supabase) — a cross-border transfer that had never been
  disclosed.
- **Apple's required EULA clauses were absent** — third-party beneficiary rights,
  no Apple warranty or support obligation, export representations. Added.
- **Proctoring wasn't in the privacy policy** despite recording behavioural data
  during mock tests. Now described in full, including the iOS screenshot and
  screen-recording detection.

---

**One caveat, stated plainly:** I wrote this text by reading your code against
the DPDP Act, the IT Rules, the store guidelines and Indian consumer-protection
rules. It is drafted to be accurate about *what your software actually does* —
which is the part most policy templates get wrong. It is not legal advice, and it
has not been reviewed by a lawyer. Have your advocate read it before you publish.
