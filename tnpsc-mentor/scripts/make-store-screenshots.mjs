// ─── Play Store screenshots ──────────────────────────────────────────────────
// Drives the REAL app in a headless browser and captures one PNG per screen, at
// every size Play asks for. Play requires screenshots that represent the actual
// app, so nothing here is mocked up — if a screen can't be reached, it doesn't
// get shipped.
//
//   # public pages only — no credentials needed
//   node scripts/make-store-screenshots.mjs
//
//   # the signed-in app (what you actually want)
//   SHOT_EMAIL=student@example.com SHOT_PASSWORD=... node scripts/make-store-screenshots.mjs
//
//   # against a local dev server instead of production
//   SHOT_BASE=http://localhost:5173 SHOT_EMAIL=... SHOT_PASSWORD=... node ...
//
// Output → store-assets/screenshots/<device>/NN-<label>.png
//
// Play's sizes (2-8 per set; each side 320-3840px):
//   phone       1080x1920   portrait
//   tablet7     1200x1920   portrait
//   tablet10    1600x2560   portrait
//   chromebook  1920x1080   LANDSCAPE — Play requires 16:9 landscape here

import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const BASE = process.env.SHOT_BASE ?? 'https://app.tnpscmentors.in'
const EMAIL = process.env.SHOT_EMAIL ?? ''
const PASSWORD = process.env.SHOT_PASSWORD ?? ''

// `scale` is the device pixel ratio; the CSS viewport is width/scale x height/scale
// and the written PNG is always width x height. Chromebook is the one that has to
// be chosen carefully rather than left at 2:
//
//   at scale 2 the CSS viewport is 960x540 — BELOW the app's `lg` breakpoint
//   (1024px), so the layout falls back to the phone chrome and the fixed bottom
//   tab bar sits ON TOP of the content, slicing the card row behind it in half.
//   540 CSS px of height leaves only ~415px of usable content, so nearly every
//   screen got cut mid-card.
//
//   at scale 1.5 it is 1280x720 — past `lg`, so the real desktop header nav
//   renders with nothing overlaying the content, and there is ~660px of content
//   height to work with. That is also what a Chromebook genuinely shows.
const ALL_DEVICES = [
  { name: 'phone', width: 1080, height: 1920, scale: 3 },
  { name: 'tablet7', width: 1200, height: 1920, scale: 2 },
  { name: 'tablet10', width: 1600, height: 2560, scale: 2 },
  { name: 'chromebook', width: 1920, height: 1080, scale: 1.5 },
]

// SHOT_DEVICES=tablet10,chromebook resumes a partial run instead of redoing all
// four sets — a full sweep is ~13 minutes and the browser occasionally dies
// partway through one.
const ONLY = (process.env.SHOT_DEVICES ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
const DEVICES = ONLY.length ? ALL_DEVICES.filter((d) => ONLY.includes(d.name)) : ALL_DEVICES

// Paths must match SHELL_ROUTES in src/App.tsx exactly — an invented path renders
// the 404 page, which looks like a successful capture until you open the file.
// '/' is public-only: signed in, RootRedirect bounces it to /test-arena.
const PUBLIC_ROUTES = [{ path: '/', label: 'landing' }]

/**
 * The screens the store description promises, in the order they tell the story.
 * `prep` runs after the page has settled and before the shot — use it to open a
 * tab or a modal that is part of the pitch.
 */
const APP_ROUTES = [
  { path: '/test-arena', label: 'home' },
  { path: '/test-arena/pyq', label: 'previous-year-papers' },
  { path: '/test-arena/pyq/group1', label: 'pyq-group1-subjects' },
  { path: '/test-arena/subjects', label: 'subject-practice' },
  { path: '/mock', label: 'mock-tests' },
  { path: '/test-series', label: 'test-marathon' },
  {
    path: '/test-series',
    label: 'test-marathon-analytics',
    prep: async (page) => clickByText(page, 'Analytics'),
  },
  { path: '/test-arena/current-affairs', label: 'current-affairs' },
  { path: '/daily', label: 'daily-current-affairs' },
  { path: '/revision', label: 'revision' },
  { path: '/bookmarks', label: 'bookmarks' },
  { path: '/materials', label: 'materials' },
  { path: '/insights', label: 'progress-insights' },
]

/** Click the first visible element whose text matches — resilient to markup churn. */
async function clickByText(page, text) {
  const el = page.getByText(text, { exact: false }).first()
  await el.waitFor({ state: 'visible', timeout: 8000 })
  await el.click()
  await page.waitForTimeout(900)
}

/**
 * Wait until the screen is genuinely DONE, not merely mounted. A fixed sleep was
 * producing half-drawn cards and skeletons in the captures, so this waits on the
 * app's own signals: no in-flight requests, no loading placeholders left.
 */
async function settle(page) {
  try {
    await page.waitForLoadState('networkidle', { timeout: 15_000 })
  } catch {
    // Some screens poll and never go idle; the checks below still gate the shot.
  }
  try {
    await page.waitForFunction(
      () => {
        const skeletons = document.querySelectorAll(
          '[class*="skeleton" i], [class*="animate-pulse" i], [aria-busy="true"]'
        )
        const spinners = document.querySelectorAll('[class*="spinner" i], [role="progressbar"]')
        return skeletons.length === 0 && spinners.length === 0
      },
      { timeout: 15_000 }
    )
  } catch {
    console.warn('    (loading placeholders still present — check this shot)')
  }
  // Let entrance animations RUN OUT rather than suppressing them, so elements
  // land at their final opacity/transform instead of freezing at the start.
  try {
    await page.waitForFunction(
      () =>
        !document.getAnimations ||
        document.getAnimations().every((a) => a.playState !== 'running'),
      { timeout: 8000 }
    )
  } catch {
    // Looping decorative animations never finish — the waits around this cover it.
  }
  // Images decode after layout; a shot taken too early shows grey boxes.
  try {
    await page.waitForFunction(
      () => Array.from(document.images).every((i) => !i.src || i.complete),
      { timeout: 10_000 }
    )
  } catch {
    /* a slow remote image shouldn't block the whole run */
  }
  await page.waitForTimeout(600)
}

/** Every scroll position back to the start — the page itself and each pane. */
const RESET_SCROLL = () => {
  window.scrollTo(0, 0)
  document.querySelectorAll('*').forEach((el) => {
    if (el.scrollLeft) el.scrollLeft = 0
    if (el.scrollTop && el !== document.scrollingElement) el.scrollTop = 0
  })
}

/**
 * Put the view in its resting state. Horizontal carousels auto-advance and the
 * page can be mid-scroll, which is what clipped the current-affairs cards at the
 * frame edge in the first pass.
 *
 * Note the CA strip is a rAF ticker, not a CSS animation, so it keeps writing
 * scrollLeft every frame and settle() can't wait it out — this reset only holds
 * for as long as the next wait. resetScroll() below runs again immediately
 * before the shutter, which is what actually pins it.
 */
async function composeFrame(page) {
  await page.evaluate(RESET_SCROLL)
  await page.waitForTimeout(500)
}

/** Re-pin scroll with nothing awaited afterwards, so a running ticker has at
 *  most one frame (<1px) to drift before the capture. */
async function resetScroll(page) {
  await page.evaluate(RESET_SCROLL)
}

/**
 * Hide whatever the bottom edge of the frame cuts through.
 *
 * A viewport capture cuts wherever the fold lands, and a card sliced through its
 * middle is the most obvious tell that a listing image is a raw screenshot —
 * it's what made the chromebook set look broken. This walks the content and,
 * for anything the edge crosses, either descends (containers, so only the
 * offending row is touched) or hides it (cards and text, which read as one
 * unit). `visibility` rather than `display` so nothing reflows and the frame
 * above the cut stays exactly as composed.
 */
async function trimPartials(page) {
  await page.evaluate(() => {
    const H = window.innerHeight
    // Things that must be shown whole or not at all — recursion stops here.
    const ATOMIC =
      'button, a, li, article, img, svg, [class*="rounded-card"], [class*="rounded-xl"], [class*="rounded-2xl"], [class*="rounded-hero"]'
    // Glows, gradient washes and grid overlays are positioned layers with no
    // words in them. They bleed past the fold BY DESIGN, and hiding one changes
    // the artwork above the cut — which is the opposite of the point.
    const isDecoration = (el, st) =>
      (st.position === 'absolute' || st.pointerEvents === 'none') &&
      !el.textContent.trim() &&
      !el.querySelector('img, svg')

    const walk = (el) => {
      for (const child of Array.from(el.children)) {
        const st = getComputedStyle(child)
        // The header/tab bar are pinned to the frame, never cut by it.
        if (st.position === 'fixed' || st.display === 'none' || st.visibility === 'hidden') continue
        if (isDecoration(child, st)) continue
        const r = child.getBoundingClientRect()
        if (r.height === 0 || r.top >= H) continue // nothing of it is on screen
        if (r.bottom <= H) continue // sits entirely inside the frame
        if (child.matches(ATOMIC) || child.children.length === 0) {
          child.style.visibility = 'hidden'
        } else {
          walk(child)
        }
      }
    }
    walk(document.body)
  })
}

/**
 * Sign in through the real login form, so the captured session is a real one.
 *
 * The account is capped at 2 signed-in devices and every run mints a fresh device
 * id, so a second run is met with the device-limit modal rather than a redirect.
 * We clear the FIRST listed device — on a screenshot account that is a previous
 * capture run. Point this at an account a person actually uses and it will sign
 * one of their devices out.
 */
async function signIn(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  await page.click('button[type="submit"]')

  const freeUpSlot = page.getByText('Sign out & continue here').first()
  const landed = page
    .waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20_000 })
    .then(() => 'in')
    .catch(() => 'stuck')
  const blocked = freeUpSlot
    .waitFor({ state: 'visible', timeout: 20_000 })
    .then(() => 'limit')
    .catch(() => 'stuck')

  if ((await Promise.race([landed, blocked])) === 'limit') {
    console.log('device limit hit — freeing the oldest slot')
    await freeUpSlot.click()
    await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 })
  }
  await settle(page)
}

const browser = await chromium.launch()
const routes = EMAIL && PASSWORD ? APP_ROUTES : PUBLIC_ROUTES
if (!EMAIL) console.log('No SHOT_EMAIL/SHOT_PASSWORD set — capturing public routes only.\n')

// Sign in ONCE and reuse the storage state across every device context. The app
// caps an account at 2 signed-in devices, and each fresh context mints its own
// device id — so signing in per device would trip the cap on the third size and
// evict a real session. Sharing the state means all four sizes ride one device.
let storageState
if (EMAIL && PASSWORD) {
  const ctx = await browser.newContext()
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('tnpsc:cookie-consent', 'rejected')
    } catch {
      /* ignore */
    }
  })
  const page = await ctx.newPage()
  await signIn(page)
  storageState = await ctx.storageState()
  await ctx.close()
  console.log('signed in once; reusing the session for all four sizes\n')
}

for (const device of DEVICES) {
  const dir = join(root, 'store-assets', 'screenshots', device.name)
  mkdirSync(dir, { recursive: true })

  const context = await browser.newContext({
    viewport: { width: device.width / device.scale, height: device.height / device.scale },
    deviceScaleFactor: device.scale,
    isMobile: device.name === 'phone',
    hasTouch: device.name !== 'chromebook',
    // Deliberately NOT reducedMotion:'reduce' — same reason as the style tag
    // below: entrance animations must be allowed to RUN to completion, not be
    // suppressed, or elements stay at their opacity:0 start state.
    ...(storageState ? { storageState } : {}),
  })

  // Pre-answer the cookie banner, which otherwise covers the lower half of every
  // web capture. 'rejected' rather than 'accepted' so the run never loads GTM,
  // Clarity or the Meta Pixel — a screenshot job has no business in analytics.
  await context.addInitScript(() => {
    try {
      localStorage.setItem('tnpsc:cookie-consent', 'rejected')
    } catch {
      /* storage blocked — the banner just stays up */
    }
  })

  const page = await context.newPage()

  let n = 0
  for (const route of routes) {
    n += 1
    const file = join(dir, `${String(n).padStart(2, '0')}-${route.label}.png`)
    try {
      await page.goto(`${BASE}${route.path}`, {
        waitUntil: 'domcontentloaded',
        timeout: 30_000,
      })
      // NOTE: do NOT inject `animation:none`. The app animates cards in from
      // opacity:0, so killing animations freezes them invisible — it emptied the
      // PYQ chooser of its group cards while still looking like a clean capture.
      // settle() below is what guarantees a finished frame.
      await settle(page)
      if (route.prep) await route.prep(page)
      await composeFrame(page)
      await trimPartials(page)
      await resetScroll(page)
      await page.screenshot({ path: file })
      console.log(`wrote ${device.name}/${String(n).padStart(2, '0')}-${route.label}.png`)
    } catch (e) {
      console.error(`  skipped ${device.name}${route.path} — ${e.message.split('\n')[0]}`)
    }
  }
  await context.close()
}
await browser.close()
console.log('\nDone. Review every shot before uploading — Play rejects blank or error screens.')
