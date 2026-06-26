// ─── Web analytics (GA4 via GTM + Meta Pixel) ───────────────────────────────
// Two destinations, one set of call-sites:
//   • GA4  — we push named events onto window.dataLayer; the GTM container
//            (GTM-P4WXHVR8, loaded in index.html) maps them onto GA4 tags, so
//            tag config stays out of the code and is editable in the dashboard.
//   • Meta — we call the Pixel directly via window.fbq (the pixel base + init
//            live in index.html, id 1006796038910199), firing the equivalent
//            standard/custom event next to each dataLayer push.
//
// NOTE: this is *page/usage* analytics. It is deliberately separate from
// `lib/analytics.ts`, which is internal test-score aggregation, not web tracking.

type DataLayerObject = Record<string, unknown>

declare global {
  interface Window {
    dataLayer?: DataLayerObject[]
    /** Meta (Facebook) Pixel — initialised in index.html (id 1006796038910199). */
    fbq?: (...args: unknown[]) => void
  }
}

// ─── Meta Pixel ─────────────────────────────────────────────────────────────
// The pixel base code + init live in index.html. Here we fire the *events*: a
// PageView on each SPA navigation plus standard/custom conversions, mirroring the
// GA4 events below. No-ops safely if the pixel was blocked or hasn't loaded.

/** Fire a Meta standard event (PageView, CompleteRegistration, Purchase, …). */
function metaTrack(event: string, params?: Record<string, unknown>): void {
  try {
    window.fbq?.('track', event, params)
  } catch {
    /* best-effort — never throw into app code */
  }
}

/** Fire a Meta custom event (app-specific actions with no standard equivalent). */
function metaTrackCustom(event: string, params?: Record<string, unknown>): void {
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
}

/** Android APK download initiated from the public landing page. */
export function trackApkDownload(source: string): void {
  track('apk_download', { source })
  metaTrackCustom('APKDownload', { source })
}
