# Analytics: GA4 via Google Tag Manager

This app sends **all** web analytics through the existing GTM container
**`GTM-P4WXHVR8`** (loaded in `index.html`). The app never calls `gtag.js`
directly — it only pushes named events onto `window.dataLayer`, and GTM maps
them onto GA4 (and the Meta Pixel `1006796038910199`). You can add or retarget
tags in the GTM dashboard without redeploying the app.

## Code: what pushes to the dataLayer

All tracking goes through `src/lib/tracking.ts` (do not confuse with
`src/lib/analytics.ts`, which is internal test-score math, not web analytics).

| Event           | Fired from                              | Key params                                             |
| --------------- | --------------------------------------- | ------------------------------------------------------ |
| `page_view`     | `App.tsx` (on every route change)       | `page_path`, `page_location`, `page_title`             |
| `login`         | `store/authStore.ts`                    | `method` (`password` \| `google` \| `otp`)             |
| `sign_up`       | `store/authStore.ts`                    | `method` (`password`)                                  |
| `start_test`    | `hooks/useStartTest.ts`                 | `category`, `subject`, `topic`                         |
| `submit_test`   | `lib/submitTest.ts`                     | `category`, `subject`, `total_questions`, `attempted`, `score_percentage` |
| `view_result`   | `pages/ResultPage.tsx`                  | `category`, `score_percentage`, `passed`               |
| `purchase`      | `lib/razorpay.ts` (after verification)  | GA4 `ecommerce` object: `transaction_id`, `value` (rupees), `currency`, `items[]` |
| `apk_download`  | `pages/LandingPage.tsx`                 | `source`                                               |

Plus a sticky **`user_id`** value pushed by `store/authStore.ts` on every auth
transition (login / sign-in / boot / sign-out). It's not an event — it sets the
GA4 User-ID so a user's sessions tie together across devices.

> SPA note: because this is a React Router single-page app, GTM/GA4/Meta only
> fire a pageview on the **first** HTML load. The `page_view` push in `App.tsx`
> is what makes in-app navigation show up in GA4 — do not remove it.

## Meta (Facebook) Pixel

The pixel (id `1006796038910199`) base code + `init` live in `index.html`. The
**events** are fired directly via `window.fbq` from `src/lib/tracking.ts`, right
next to each GA4 dataLayer push — no GTM tag needed. The CSP in `vercel.json`
must allow `connect.facebook.net` + `www.facebook.com` (it does).

| App action    | Meta event        | Type     | Params                         |
| ------------- | ----------------- | -------- | ------------------------------ |
| route change  | `PageView`        | standard | — (first load fired by base code; SPA hook fires the rest) |
| sign up       | `CompleteRegistration` | standard | `method`                  |
| login         | `Login`           | custom   | `method`                       |
| start test    | `StartTest`       | custom   | `category`, `subject`          |
| submit test   | `SubmitTest`      | custom   | `category`, `subject`, `score_percentage` |
| view result   | `ViewResult`      | custom   | `category`, `score_percentage`, `passed` |
| purchase      | `Purchase`        | standard | `value`, `currency`, `content_name` |
| APK download  | `APKDownload`     | custom   | `source`                       |

Verify in **Meta Events Manager → Test Events** (or the Meta Pixel Helper
extension). Mark `Purchase` and `CompleteRegistration` as your conversion
events for ad optimisation. Custom events (StartTest, etc.) can be turned into
**Custom Conversions** in Events Manager if you want to optimise on them.

## GTM dashboard setup (one-time)

Do this once in <https://tagmanager.google.com> for container `GTM-P4WXHVR8`.

### 1. GA4 Configuration tag

1. **Tags → New → Google Analytics: GA4 Configuration**.
2. Paste your **Measurement ID** (`G-XXXXXXXXXX`).
3. **Important (SPA):** open the tag's settings and **uncheck** "Send a page
   view event when this configuration loads" — we send page views ourselves via
   the `page_view` dataLayer event, so leaving it on double-counts the first
   load.
4. Trigger: **Initialization – All Pages**.

### 2. Custom Event trigger + GA4 Event tag for page views

1. **Triggers → New → Custom Event**, Event name = `page_view`. Name it
   `CE - page_view`.
2. **Tags → New → Google Analytics: GA4 Event**, select the config tag above,
   Event Name = `page_view`. Add event parameters:
   `page_path = {{DLV - page_path}}`, `page_location = {{DLV - page_location}}`,
   `page_title = {{DLV - page_title}}`. Trigger = `CE - page_view`.

   (`{{DLV - x}}` = a **Data Layer Variable** with Variable Name `x`; create one
   per param under **Variables → User-Defined → New → Data Layer Variable**.)

### 3. Repeat the Event-tag pattern for the rest

For each of `login`, `sign_up`, `start_test`, `submit_test`, `view_result`,
`purchase`, `apk_download`:

- Custom Event trigger matching the event name.
- GA4 Event tag with the matching Event Name + Data Layer Variables for its
  params (see the table above), fired by that trigger.

For `purchase`, map `value` and `currency` so it registers as a GA4 revenue/
conversion event. Mark `sign_up`, `purchase`, `submit_test` (and any others you
care about) as **Conversions** under GA4 → Admin → Events.

### 4. Test & publish

- Use **Preview** (Tag Assistant) and click through: load a page, navigate
  between routes, log in, start + submit a test, view the result. Confirm each
  `page_view` and event appears and fires its GA4 tag.
- In GA4 → **Realtime** / **DebugView**, confirm events arrive.
- **Submit / Publish** the container version.

## Verifying in the browser (no GTM access needed)

Open DevTools console on the site and run `window.dataLayer` — you'll see the
pushed events accumulate as you navigate and act. That confirms the app side is
working even before the GTM tags are wired.
