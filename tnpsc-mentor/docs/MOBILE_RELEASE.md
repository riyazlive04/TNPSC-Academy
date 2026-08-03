# Mobile release — App Store & Google Play

Everything needed to take `com.tnpscmentor.app` from this repo to both stores.
Written against the rules in force in **August 2026**; the deadline table below is
the part that expires, so check it first.

---

## 0. Deadlines that will block you

| Requirement | Status here | Deadline |
|---|---|---|
| Play: `targetSdk 36` (Android 16) for all new submissions **and updates** | done (`android/variables.gradle`) | **31 Aug 2026** — extension to 1 Nov 2026 on request |
| App Store: built with **Xcode 26 / iOS 26 SDK** | needs Xcode 26 on your Mac | already in force (28 Apr 2026) |
| Play: in-app account deletion + public deletion URL | done | in force |
| Apple 5.1.1(v): in-app account deletion | done | in force |
| Apple 3.1.1 / Play Payments: store billing for digital content | done (IAP) | in force |

If the Play deadline is close when you read this, ship Android first — the
`targetSdk` change is already made and is the only thing gated by a date.

---

## 1. What changed, and why

The web app and the mobile apps now share one codebase but differ on four axes,
each forced by a store rule:

| Area | Web | Native (iOS + Android) | Why |
|---|---|---|---|
| Payments | Razorpay Checkout | App Store / Play billing | Apple 3.1.1; Play Payments policy |
| Coupons | shown | **hidden** | Apple 3.1.1 bars in-app codes that unlock paid content |
| Analytics | GTM + Meta Pixel + Clarity | **none loaded** | avoids App Tracking Transparency, keeps `NSPrivacyTracking=false` honest, and Apple 2.5.2 bars downloading executable code |
| Push | Web Push (VAPID) | APNs/FCM device token | WKWebView has no Push API |

The split is decided at runtime by URL (`window.__IS_NATIVE__`, set in
`index.html`), so **one build artifact serves both**. There is no separate native
build command.

Key files:

- `src/lib/purchase.ts` — the router. Every paywall calls `startPurchase()`.
- `src/lib/iap.ts` / `src/lib/iapCatalog.ts` — native purchase + product table.
- `server/src/routes/iap.ts` — receipt verification → `payments` ledger.
- `src/lib/nativePush.ts`, `server/src/lib/fcm.ts` — push.
- `src/components/Profile/AccountSection.tsx` — Restore purchases + Delete account.
- `ios/App/App/PrivacyInfo.xcprivacy` — privacy manifest (keep in sync with the
  App Store Connect questionnaire).

### The purchase ledger is unchanged

An IAP purchase writes an ordinary `paid` row into `payments`, so
`bundleAccess()` and every entitlement gate downstream needed **no changes**:

```
razorpay_order_id → 'ios:<transactionId>' | 'android:<purchaseToken>'
provider          → 'apple' | 'google'
notes             → { plan, provider, product_id, platform, environment }
```

That column's `UNIQUE` constraint is the idempotency mechanism: a replayed
receipt raises `23505` and is reported as already-recorded rather than granting a
second window of access.

---

## 2. Database migrations

Run **before** deploying the server, in this order:

```bash
cd server
node run-migration.mjs ../supabase/iap_payments.sql    # payments.provider
node run-migration.mjs ../supabase/native_push.sql     # push_devices
node run-migration.mjs ../supabase/delete_user.sql     # if not already applied
```

`delete_user.sql` is what makes account deletion actually cascade — without it
`profiles` blocks the auth delete and the Delete account button 500s. Verify:

```sql
select conname, confdeltype from pg_constraint where conname = 'profiles_id_fkey';
-- confdeltype must be 'c' (cascade)
```

---

## 3. Server environment

Add to `server/.env` (production):

```bash
# ─── App Store ───────────────────────────────────────────────────────────────
APPLE_BUNDLE_ID=com.tnpscmentor.app
# App Store Connect → your app → App Information → General → Apple ID (numeric).
# Apple requires it to verify PRODUCTION transactions; Sandbox works without.
APPLE_APP_APPLE_ID=

# ─── Google Play ─────────────────────────────────────────────────────────────
GOOGLE_PLAY_PACKAGE_NAME=com.tnpscmentor.app
# Service-account JSON key, verbatim or base64. Needs the Play Console grant
# "View financial data, orders, and cancellation survey responses".
GOOGLE_PLAY_SERVICE_ACCOUNT_JSON=

# ─── Push (FCM, covers BOTH platforms) ───────────────────────────────────────
# Falls back to GOOGLE_PLAY_SERVICE_ACCOUNT_JSON when the project is the same.
FIREBASE_SERVICE_ACCOUNT_JSON=
FIREBASE_PROJECT_ID=
```

No Apple API key is needed: StoreKit 2 receipts are verified offline against
Apple's root CA, which is embedded in `server/src/lib/iapApple.ts`.

Frontend `.env.production` gains one variable, used only by the iOS build:

```bash
VITE_GOOGLE_IOS_CLIENT_ID=<the iOS OAuth client id>
```

---

## 4. Store product setup

Create these **identically** in both consoles. Names must match exactly or the
paywall shows a price and then fails at purchase.

| Plan | Product ID | Type (App Store) | Type (Play) | Price |
|---|---|---|---|---|
| Premium, 3 months | `com.tnpscmentor.app.premium90` | Non-Renewing Subscription | One-time product, **consumable** | ₹1,699 |
| Vettri Nichayam, full | `com.tnpscmentor.app.vettri60` | Non-Renewing Subscription | One-time product, **consumable** | ₹899 |
| Vettri Nichayam, monthly | `com.tnpscmentor.app.vettri30` | Non-Renewing Subscription | One-time product, **consumable** | ₹499 |

**Why non-renewing / consumable rather than auto-renewable:** access is a fixed
window the server owns, nothing auto-debits, and users re-buy deliberately.
Apple designates this type for time-limited content access. It also sidesteps
RBI e-mandate friction on recurring card debits in India. Put that sentence in
the review notes — a reviewer may otherwise ask why it isn't a subscription.

Consumable on Play is what lets a lapsed user buy again; the app consumes the
purchase only *after* the server has recorded it.

Store prices will not exactly equal the rupee figures above once Apple/Google
apply their price points and local tax. That is expected — the paywall displays
the **store's** localized price on native (`useStorePrice`), never the web price.

---

## 5. Google Play

### One-time setup

1. **Play Console → Setup → App signing** — note the *App signing key* SHA-256.
2. **Monetisation setup** — link a merchant account, or IAP products can't be created.
3. **Service account**: Google Cloud → IAM → create service account → JSON key →
   Play Console → Users & permissions → invite that account with *View financial
   data*. Paste the key into `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`.
4. **Firebase**: add the Android app, download `google-services.json` into
   `android/app/`. Add the iOS app too and upload the **APNs auth key** (.p8)
   under Cloud Messaging — that is what lets one FCM sender reach both platforms.

### Closed testing (personal accounts only)

Accounts created after 13 Nov 2023 need **12 testers opted in for 14 continuous
days** before production access. Organisation accounts registered to a legal
entity are exempt. Start this early — it is wall-clock time you cannot compress.

### Build

```bash
npm run sync:android
cd android && ./gradlew bundleRelease
# → android/app/build/outputs/bundle/release/app-release.aab
```

### Data safety form

| Question | Answer |
|---|---|
| Collects data? | Yes |
| Shares data with third parties? | No |
| Data encrypted in transit? | Yes |
| Users can request deletion? | Yes |
| Deletion URL | `https://tnpscmentors.in/delete-account` |

Declare, all **collected + linked to user**, none used for advertising or tracking:
Name, Email address, Phone number, User IDs, Device or other IDs, Purchase
history, App interactions, Other user-generated content (test answers).

Do **not** tick "Advertising or marketing" for any of them — the apps ship with
no ad or attribution SDK, and a false declaration is itself a violation.

### Content rating & audience

Education, target age **18+** (TNPSC is a graduate-level government exam). An
18+ target audience keeps the app out of Play's Families policy entirely.

---

## 6. App Store

### One-time setup

1. Apple Developer Program membership, **Paid Applications Agreement signed**
   with banking + tax set up. Without it IAP products stay "Missing Metadata"
   and cannot be tested.
2. App ID `com.tnpscmentor.app` with **In-App Purchase**, **Push Notifications**
   and **Associated Domains** capabilities enabled.
3. Google Cloud → Credentials → create an **iOS** OAuth client (bundle id
   `com.tnpscmentor.app`). Then:
   - put it in `VITE_GOOGLE_IOS_CLIENT_ID`,
   - put its **reversed** form in `ios/App/App/Info.plist` →
     `CFBundleURLSchemes` (replace `REPLACE_WITH_REVERSED_IOS_CLIENT_ID`),
   - **add it to Supabase → Authentication → Providers → Google → Authorized
     Client IDs**, alongside the existing web client.

   That last step is the one that bites: Google's iOS SDK signs the ID token for
   the *iOS* client, not the web client, so without it every iOS Google sign-in
   returns a bare 401.

### Build

```bash
npm run sync:ios
npx cap open ios
```

In Xcode: select the team, confirm **Signing & Capabilities** shows In-App
Purchase, Push Notifications and Associated Domains, then Product → Archive →
Distribute App.

Already configured for you: `MARKETING_VERSION 2.0.0`, deployment target iOS 15,
`arm64` only, `ITSAppUsesNonExemptEncryption=false` (no export-compliance prompt
on every upload), and `TARGETED_DEVICE_FAMILY = 1`.

> **iPhone-only, deliberately.** The layout is responsive and will very likely be
> fine on iPad, but "very likely" untested is how 4.0 Design rejections happen.
> To add iPad later: set `TARGETED_DEVICE_FAMILY = "1,2"`, verify every screen in
> the iPad simulator (especially the OMR mock-test grid), and add iPad
> screenshots. Widening device support later carries no penalty.

### Privacy questionnaire

Must match `ios/App/App/PrivacyInfo.xcprivacy` — Apple cross-checks them.

- **Data used to track you:** *none*.
- **Data linked to you:** Email, Name, Phone Number, User ID, Device ID,
  Purchase History, Product Interaction, Other User Content.
- **Data not linked to you:** none.

If an ad or attribution SDK is ever added, all three of these must change
together: the manifest's `NSPrivacyTracking`, this questionnaire, and an ATT
prompt before the SDK initialises.

---

## 7. App Review notes

Paste into App Store Connect → App Review Information → Notes, and the Play
Console equivalent:

```
DEMO ACCOUNT
  Email:    review@tnpscmentors.in
  Password: <set one before submitting>
This account is pre-loaded with credits so every flow can be exercised without
paying. To test a purchase, use a Sandbox tester account — the server accepts
Sandbox receipts and grants the same entitlement.

WHAT THE APP DOES
TNPSC Mentors is exam preparation for the Tamil Nadu Public Service Commission
(TNPSC) — a state government recruitment exam in India. Fully bilingual, English
and Tamil. Learners take timed practice tests and full-length mock exams, review
previous-year questions with explanations, follow a daily current-affairs test,
and track progress with spaced-repetition revision.

PAID CONTENT
Two plans, both sold through in-app purchase:
  • Premium — 3 months of full access
  • Vettri Nichayam — a 13-paper scheduled mock-exam programme (full or monthly)
Both are NON-RENEWING subscriptions: access is a fixed window our server owns,
nothing auto-renews, and users re-purchase deliberately. This suits a fixed-term
exam programme, and avoids the recurring-mandate (RBI e-mandate) friction that
auto-renewing charges carry in India. "Restore purchases" is in Profile → Account.

ACCOUNT DELETION
Profile → Account → Delete account. Type DELETE to confirm. The account and all
associated data are removed immediately. Also documented publicly at
https://tnpscmentors.in/delete-account

NOTES FOR THE REVIEWER
• Full-screen / proctoring: mock exams request full screen and record when the
  app is backgrounded, to keep timed practice honest. This is disclosed on the
  instructions screen before every exam starts and cannot record anything outside
  the app.
• The app contains no third-party advertising, analytics or tracking SDK, which
  is why no App Tracking Transparency prompt appears.
• Some questions carry scanned figures from official past papers, used for
  educational commentary and preparation.
```

---

## 8. Pre-submission checklist

Build and install a **release** build on a real device, then:

- [ ] Sign up, sign out, sign in with email/password
- [ ] Google sign-in **on both platforms** (iOS is the one that breaks — see §6.3)
- [ ] Buy each of the 3 products with a sandbox/test account
- [ ] Kill the app mid-purchase → reopen → entitlement arrives via the recovery sweep
- [ ] Restore purchases on a second device with the same account
- [ ] Confirm **no coupon text field** appears anywhere in the app (§9)
- [ ] iOS: "Have a code?" opens Apple's redemption sheet; a real offer code grants the plan
- [ ] Android: the Play payment sheet shows "Redeem code" during checkout
- [ ] Confirm the paywall shows the **store's** price, not ₹1,699 hardcoded
- [ ] Enable notifications → send one from the superadmin console → tap it → lands on the right screen
- [ ] Airplane mode → offline banner appears → restores when reconnected
- [ ] Start a mock exam → check the header clears the status bar / notch
- [ ] Android: hardware back mid-exam still warns before leaving
- [ ] Delete account → confirm sign-out, and that the email can register again
- [ ] Open `https://app.tnpscmentors.in/pyq` from another app → opens in-app
- [ ] Tamil interface: switch language and check nothing clips on the smallest device

## 9. Coupons and discount codes

Your promoter codes live in the `coupons` table with flat/percent discounts and
per-promoter attribution. **Those codes do not work inside the apps**, and cannot
be made to: Apple 3.1.1 calls a self-issued code that unlocks paid content an
"own mechanism to unlock content, such as license keys". So each platform uses
whoever's codes it is allowed to use.

| | Who issues the code | How it's redeemed | Attribution |
|---|---|---|---|
| Web | you (`coupons` table) | text field → Razorpay | full, in your DB |
| iOS | Apple (Offer Codes) | in-app redemption sheet | App Store Connect, per code |
| Android | Google (Play promotions) | "Redeem code" in the Play payment sheet | Play Console, per code |

`couponMode()` in `src/lib/purchase.ts` picks the right one; the paywall renders
either the coupon field or `StoreCodeRow`.

### Creating App Store offer codes

Apple retired IAP promo codes on **26 March 2026** and replaced them with Offer
Codes, which — unlike the old promo codes — support **non-renewing subscriptions**
(what this app sells) and can be **free or discounted**.

App Store Connect → your app → the In-App Purchase → **Offer Codes** → create a
campaign. Choose **Custom codes** to mint a memorable string per promoter
(`RAVI20`, `TOPPER50`) so redemptions attribute cleanly in the reports; choose
**One-time use codes** for support remediation and giveaways. Limit is 1,000,000
redemptions per app per quarter.

Redemption happens through the sheet opened by `redeemOfferCode()`
(`presentOfferCodeRedeemSheet`, **iOS 16+**). Apple grants the purchase
out-of-band and hands the app nothing, so the code re-runs the recovery sweep
afterwards — that is what actually finds the transaction, verifies it server-side
and writes the entitlement. On iOS 15 the button explains that and points at the
website.

### Creating Play promotions

Play Console → Monetise → **Promotions** → create a promotion against the
one-time product. One-time codes are capped at 10,000 per quarter per product and
unused ones expire at quarter end.

There is nothing to build on Android: the Google Play payment sheet already
carries a **"Redeem code"** link during checkout, and the plugin's
`presentOfferCodeRedeemSheet` is iOS-only (it hard-rejects on Android). The app
just tells buyers where the link is, because they do not find it unaided.

### Keeping promoter economics working

Store codes are a fixed free-or-discounted price, not a percentage, and their
redemptions land in the store consoles rather than your `coupons` table. So:

- **Percentage-based affiliate deals stay on the website.** That is where your
  table computes the discount and counts redemptions per promoter, and it is
  also where you keep 100% of the money instead of 85%.
- **Mirror only the codes that matter** as store offer codes — a launch
  promotion, an influencer partnership — and reconcile those from the store
  reports at payout time.
- A store-code purchase still writes a normal `payments` row through
  `/api/iap/verify`, so entitlement, expiry and revenue reporting are unaffected;
  the row simply has no `coupon_code`.

> **The one thing not to do:** discounting by pointing app users at the website
> to pay. Outside the US storefront that is anti-steering under 3.1.1(a) and gets
> the app pulled. Users finding the website themselves is fine; the app telling
> them to is not.

## 10. Known gaps

- **`google-services.json` is not in the repo.** Android push is inert until it
  is placed in `android/app/`.
- **Placeholders to fill before the first device build:**
  `REPLACE_WITH_REVERSED_IOS_CLIENT_ID` (Info.plist), `REPLACE_TEAM_ID`
  (apple-app-site-association), `REPLACE_WITH_*_SHA256` (assetlinks.json — run
  `deploy/make-assetlinks.sh`).
- **`minifyEnabled` is off** for release Android builds, unchanged from before.
  Turning it on shrinks the binary but needs a full regression pass first.
