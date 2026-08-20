// ─── Web analytics (GA4 via GTM + Meta Pixel) ───────────────────────────────
// Two destinations, one set of call-sites:
//   • GA4  — we push named events onto window.dataLayer; the GTM container
//            (GTM-P4WXHVR8, loaded in index.html) maps them onto GA4 tags, so
//            tag config stays out of the code and is editable in the dashboard.
//   • Meta — we call the Pixel directly via window.fbq (the pixel base + init
//            live in index.html, id 1006796038910199), firing the equivalent
//            standard/custom event next to each dataLayer push.
//
// WEB ONLY. Neither tag is loaded inside the installed apps (see the reasoning
// in index.html — App Tracking Transparency, guideline 2.5.2, and the
// NSPrivacyTracking=false declaration in the privacy manifest all depend on it).
// Every emitter below therefore short-circuits on native rather than each call
// site having to remember: `window.fbq` and the GTM container simply don't exist
// there, so an ungated call would silently build a dataLayer nothing consumes.
//
// NOTE: this is *page/usage* analytics. It is deliberately separate from
// `lib/analytics.ts`, which is internal test-score aggregation, not web tracking.

type DataLayerObject = Record<string, unknown>

/**
 * True whenever nothing should be emitted:
 *
 *  • native / dev  — set in index.html; the tags are never loaded there.
 *  • no consent    — the visitor has not accepted, or has rejected. GTM and the
 *                    Pixel are not loaded in that case, so an ungated push would
 *                    quietly accumulate a dataLayer that a later "accept" would
 *                    then flush to Google — replaying events gathered while the
 *                    visitor had refused. Checking here is what stops that.
 */
function trackingDisabled(): boolean {
  if (typeof window === 'undefined' || window.__IS_NATIVE__ === true) return true
  return window.__trackersLoaded !== true
}

declare global {
  interface Window {
    dataLayer?: DataLayerObject[]
    /** Meta (Facebook) Pixel — initialised in index.html (id 1006796038910199). */
    fbq?: (...args: unknown[]) => void
    /** Set in index.html: true inside the Capacitor WebView (and in local dev). */
    __IS_NATIVE__?: boolean
  }
}

// ─── Meta Pixel ─────────────────────────────────────────────────────────────
// The pixel base code + init live in index.html. Here we fire the *events*: a
// PageView on each SPA navigation plus standard/custom conversions, mirroring the
// GA4 events below. No-ops safely if the pixel was blocked or hasn't loaded.

/** Fire a Meta standard event (PageView, CompleteRegistration, Purchase, …). */
function metaTrack(event: string, params?: Record<string, unknown>): void {
  if (trackingDisabled()) return
  try {
    window.fbq?.('track', event, params)
  } catch {
    /* best-effort — never throw into app code */
  }
}

/** Fire a Meta custom event (app-specific actions with no standard equivalent). */
function metaTrackCustom(event: string, params?: Record<string, unknown>): void {
  if (trackingDisabled()) return
  try {
    window.fbq?.('trackCustom', event, params)
  } catch {
    /* best-effort */
  }
}

/**
 * Low-level push onto the GTM dataLayer. Safe before GTM has loaded (the snippet
 * in index.html pre-creates the array) and a no-op if it's somehow missing —
 * analytics must never break the app. Use this for keyless pushes (e.g. setting
 * a sticky value like `user_id`, or clearing `ecommerce`).
 */
function pushRaw(obj: DataLayerObject): void {
  if (trackingDisabled()) return
  try {
    const w = window as Window & typeof globalThis
    w.dataLayer = w.dataLayer || []
    w.dataLayer.push(obj)
  } catch {
    /* analytics is best-effort — never throw into app code */
  }
}

/** Push a named event onto the GTM dataLayer. */
export function track(event: string, params: DataLayerObject = {}): void {
  pushRaw({ event, ...params })
}

/**
 * Associate all subsequent events with a signed-in user (GA4 User-ID feature —
 * ties a user's sessions together across devices). The value is sticky in the
 * dataLayer, so the GTM Google tag reads it as the `user_id` User Property on
 * every later event. Pass null on sign-out to detach the identity.
 */
export function setUserId(userId: string | null): void {
  pushRaw({ user_id: userId ?? undefined })
}

// ─── Named events ───────────────────────────────────────────────────────────
// Centralised so event names + param shapes stay consistent across the app and
// match what's configured as triggers/tags in GTM. Add new ones here, not inline.

let metaFirstPageViewSkipped = false

/** SPA route change. Fired on every navigation from App's useEffect on location. */
export function trackPageView(path: string, title?: string): void {
  track('page_view', {
    page_path: path,
    page_location: window.location.href,
    page_title: title ?? document.title,
  })
  // Meta: the pixel base code in index.html already fires a PageView on the first
  // HTML load, so skip our first call and only fire on subsequent SPA navigations
  // — otherwise the initial page would be double-counted.
  if (!metaFirstPageViewSkipped) {
    metaFirstPageViewSkipped = true
  } else {
    metaTrack('PageView')
  }
}

/**
 * A key content page was reached (currently the register page). Fires Meta's
 * ViewContent standard event — the top of the signup funnel, so ad campaigns can
 * optimise for people who actually land on the form, not just the site. Also
 * pushed to the dataLayer as `view_content` for GA4 parity.
 */
export function trackViewContent(params: {
  contentName: string
  contentCategory?: string
}): void {
  track('view_content', {
    content_name: params.contentName,
    content_category: params.contentCategory ?? undefined,
  })
  metaTrack('ViewContent', {
    content_name: params.contentName,
    content_category: params.contentCategory ?? undefined,
  })
}

/** A returning user signed in. `method` = password | google | otp. */
export function trackLogin(method: string): void {
  track('login', { method })
  metaTrackCustom('Login', { method })
}

/** A new account was created. `method` = password | google. */
export function trackSignUp(method: string): void {
  track('sign_up', { method })
  // Meta standard conversion event for a completed signup.
  metaTrack('CompleteRegistration', { method })
}

/** User kicked off a test from any of the test-arena flows. */
export function trackStartTest(params: {
  category?: string | null
  subject?: string | null
  topic?: string | null
}): void {
  track('start_test', {
    category: params.category ?? undefined,
    subject: params.subject ?? undefined,
    topic: params.topic ?? undefined,
  })
  metaTrackCustom('StartTest', {
    category: params.category ?? undefined,
    subject: params.subject ?? undefined,
  })
}

/** A test was graded. Carries the headline result metrics for funnel analysis. */
export function trackSubmitTest(params: {
  category?: string | null
  subject?: string | null
  totalQuestions: number
  attempted: number
  scorePercentage: number
}): void {
  track('submit_test', {
    category: params.category ?? undefined,
    subject: params.subject ?? undefined,
    total_questions: params.totalQuestions,
    attempted: params.attempted,
    score_percentage: params.scorePercentage,
  })
  metaTrackCustom('SubmitTest', {
    category: params.category ?? undefined,
    subject: params.subject ?? undefined,
    score_percentage: params.scorePercentage,
  })
}

/** The result screen was shown for a finished test. */
export function trackViewResult(params: {
  category?: string | null
  scorePercentage: number
  passed: boolean
}): void {
  track('view_result', {
    category: params.category ?? undefined,
    score_percentage: params.scorePercentage,
    passed: params.passed,
  })
  metaTrackCustom('ViewResult', {
    category: params.category ?? undefined,
    score_percentage: params.scorePercentage,
    passed: params.passed,
  })
}

/**
 * A Razorpay payment was verified as paid. Pushes a GA4-standard `ecommerce`
 * object so the GTM purchase tag can read transaction_id/value/currency/items
 * straight from the data layer (set "Send Ecommerce data → From Data Layer" on
 * that tag). `transactionId` lets GA4 de-duplicate purchases; `value` is in
 * rupees (not paise). We null out `ecommerce` first so values can't bleed in
 * from a previous event.
 *
 * Also fires Meta's CompleteRegistration on the verified payment itself — this
 * is the single choke point every web payment flow (Premium, Vettri, Rank
 * Booster, ...) resolves through in razorpay.ts, so it's guaranteed to reflect
 * an actual successful payment rather than checkout intent. This is on top of,
 * not instead of, the pre-payment CompleteRegistration in
 * trackCheckoutConfirmed() below — a real purchase now fires it twice
 * (confirm + success), by deliberate choice.
 */
export function trackPurchase(params: {
  transactionId: string
  value: number
  currency?: string
  description?: string
}): void {
  const currency = params.currency ?? 'INR'
  const itemName = params.description ?? 'TNPSC Mentors purchase'
  pushRaw({ ecommerce: null })
  track('purchase', {
    ecommerce: {
      transaction_id: params.transactionId,
      value: params.value,
      currency,
      items: [
        {
          item_id: params.transactionId,
          item_name: itemName,
          price: params.value,
          quantity: 1,
        },
      ],
    },
  })
  // Meta standard Purchase conversion (the key event for ad optimisation).
  metaTrack('Purchase', {
    value: params.value,
    currency,
    content_name: itemName,
  })
  // Meta CompleteRegistration, fired again here on the verified payment itself
  // (see doc comment above) so it reliably reflects a successful payment.
  metaTrack('CompleteRegistration', {
    value: params.value,
    currency,
    content_name: itemName,
  })
}

/**
 * Buyer opened checkout from a payment banner (tapped "Get Premium/Vettri",
 * before the recap/confirm modal). Fires Meta's InitiateCheckout — a
 * top-of-checkout-funnel standard conversion for ad optimisation. Meta-only by
 * design (no GA4 push requested here). `value` is in rupees, not paise; it's the
 * post-coupon amount the buyer is expected to pay.
 */
export function trackInitiateCheckout(params: {
  value: number
  currency?: string
  description?: string
}): void {
  metaTrack('InitiateCheckout', {
    value: params.value,
    currency: params.currency ?? 'INR',
    content_name: params.description ?? 'TNPSC Mentors purchase',
  })
}

/**
 * Buyer confirmed the recap popup and the Razorpay sheet is opening. Fires Meta's
 * CompleteRegistration as a high-intent lead signal for the payment funnel.
 * Meta-only, no GA4 push.
 * NOTE: this is a deliberate reuse of CompleteRegistration — trackSignUp() fires
 * it at account creation, and trackPurchase() fires it again on the verified
 * payment itself, so this Meta standard event now counts new signups, buyers
 * proceeding to pay, and successful payments. Segment in Ads Manager if you need
 * them apart (e.g. by the presence of `value`, or a custom param).
 */
export function trackCheckoutConfirmed(params: {
  value: number
  currency?: string
  description?: string
}): void {
  metaTrack('CompleteRegistration', {
    value: params.value,
    currency: params.currency ?? 'INR',
    content_name: params.description ?? 'TNPSC Mentors purchase',
  })
}

/** Android APK download initiated from the public landing page. */
export function trackApkDownload(source: string): void {
  track('apk_download', { source })
  metaTrackCustom('APKDownload', { source })
}

/** A study material file was downloaded from the Materials hub / Profile videos. */
export function trackDownloadMaterial(params: {
  id: string
  title?: string | null
  kind?: string | null
}): void {
  track('download_material', {
    material_id: params.id,
    material_title: params.title ?? undefined,
    material_kind: params.kind ?? undefined,
  })
  metaTrackCustom('DownloadMaterial', {
    material_id: params.id,
    material_kind: params.kind ?? undefined,
  })
}
