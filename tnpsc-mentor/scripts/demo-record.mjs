// TNPSC Mentor — demo screen recording
//   node scripts/demo-record.mjs
//
// Walks the core student "practice loop" and records it to recordings/*.webm:
//   Login → Dashboard → PYQ → Group 1 → Polity → set up test →
//   answer 5 questions (honouring the 7s/question minimum) → Submit → Result.
//
// Prereqs (already true in this workspace):
//   • Vite dev server on http://localhost:5173, Express API on :4000
//   • A seeded demo student account (server/_seed-demo.mjs) — premium, so the
//     per-topic free gate never interrupts the run.
//   • Its device sessions cleared just before running (2-device cap) —
//     APPLY=1 node server/_clear-sessions.mjs <email>
//
// Env overrides: BASE_URL, EMAIL, PASSWORD, HEADFUL=1, QUESTIONS, SUBJECT.

import { chromium } from 'playwright'
import { execFileSync } from 'node:child_process'

const LETTERS = ['A', 'B', 'C', 'D']
// Answer this question index wrong on purpose so the score reads 4/5 (a believable
// "strong but not suspiciously perfect" result) instead of a flawless 100%.
const MISS_INDEX = 2

/** Look up the correct letter for each question id via the server helper (which
 *  has DB access). Returns a { id: 'A'|'B'|'C'|'D' } map, or {} on any failure. */
function resolveAnswers(ids) {
  try {
    const out = execFileSync('node', ['_answers.mjs', JSON.stringify(ids)], {
      cwd: 'server', // so dotenv picks up server/.env and supabase-js resolves
      encoding: 'utf8',
    })
    return JSON.parse(out.trim().split('\n').pop())
  } catch (e) {
    console.warn('   (could not resolve answers, will answer sequentially):', e.message)
    return {}
  }
}

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:5173'
const EMAIL = process.env.EMAIL ?? 'demo.aspirant@tnpscmentor.app'
const PASSWORD = process.env.PASSWORD ?? 'DemoAspirant#2026'
const SUBJECT = process.env.SUBJECT ?? 'Polity'
const QUESTIONS = Number(process.env.QUESTIONS ?? 5)
const MIN_SEC_PER_Q = 7 // mirrors MIN_SECONDS_PER_QUESTION in the app

const VIEWPORT = { width: 1280, height: 800 }

// A little slower than real use so the recording reads naturally on playback.
const pause = (page, ms) => page.waitForTimeout(ms)

let stepN = 0
const step = (msg) => console.log(`  ${String(++stepN).padStart(2, '0')}. ${msg}`)

async function run() {
  const browser = await chromium.launch({ headless: process.env.HEADFUL !== '1' })
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2, // crisper capture
    recordVideo: { dir: 'recordings/', size: VIEWPORT },
  })

  // Pre-seed the two first-run choices so the flow lands straight on the
  // dashboard after login (no /language screen, no spotlight tour overlay).
  // Both are zustand-persist blobs in localStorage.
  await context.addInitScript(() => {
    localStorage.setItem('tnpsc-mentor-lang', JSON.stringify({ state: { lang: 'en' }, version: 0 }))
    localStorage.setItem(
      'tnpsc-mentor-onboarding',
      JSON.stringify({ state: { pending: false }, version: 0 })
    )
  })

  const page = await context.newPage()
  page.setDefaultTimeout(20_000)

  // Capture the quiz payload as it loads so we know the questions (and their
  // order) the engine will show. The response omits correct_answer by design; we
  // resolve those separately via the server helper.
  let quizSet = null
  page.on('response', async (resp) => {
    if (quizSet || !resp.url().includes('/api/questions/quiz')) return
    try {
      const j = await resp.json()
      if (j?.questions?.length) quizSet = j.questions
    } catch {}
  })

  try {
    // ── 1. Login ──────────────────────────────────────────────────────────────
    step('Open the sign-in screen')
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' })
    await pause(page, 1400)

    step('Type the aspirant credentials')
    await page.locator('#login-email').pressSequentially(EMAIL, { delay: 45 })
    await pause(page, 500)
    await page.locator('#login-password').pressSequentially(PASSWORD, { delay: 45 })
    await pause(page, 900)

    step('Sign in')
    await page.locator('button[type="submit"]').click()
    await page.waitForURL('**/test-arena', { timeout: 20_000 })
    await pause(page, 1800) // let the dashboard settle in

    // ── 2. Into Previous-Year Questions → Group 1 → subject ────────────────────
    step('Open Previous Year Question Papers')
    await page.getByRole('button', { name: /previous year question papers/i }).click()
    await page.waitForURL('**/test-arena/pyq')
    await pause(page, 1100)

    step('Choose Group 1')
    await page.getByRole('button', { name: /group 1 pyq/i }).click()
    await page.waitForURL('**/test-arena/pyq/group1')

    step(`Pick the subject: ${SUBJECT}`)
    const subjectRow = page.getByRole('button', { name: new RegExp(SUBJECT, 'i') })
    await subjectRow.waitFor({ state: 'visible' }) // waits out the counts spinner
    await pause(page, 1000)
    await subjectRow.click()
    await page.waitForURL('**/quiz/instructions')
    await pause(page, 1200)

    // ── 3. Configure the practice test ─────────────────────────────────────────
    step(`Set the test to ${QUESTIONS} questions`)
    const countSlider = page.locator('input[type="range"]').first()
    await countSlider.focus()
    await countSlider.press('Home') // jump to the minimum (5)
    // Nudge up to the requested count from the minimum of 5.
    for (let i = 5; i < QUESTIONS; i++) await countSlider.press('ArrowRight')
    await pause(page, 900)

    step('Agree to the exam rules and begin')
    await page.locator('input[type="checkbox"]').check()
    await pause(page, 900)
    await page.getByRole('button', { name: /enter full-screen & begin/i }).click()
    await page.waitForURL('**/quiz')

    // ── 4. Take the test ───────────────────────────────────────────────────────
    step('Wait for the question engine to load')
    const options = page.locator('button.rounded-field.border-2')
    await options.first().waitFor({ state: 'visible', timeout: 25_000 })

    // Resolve the correct answers for the captured question set so the run scores
    // realistically. `quizSet` order == on-screen order (server pre-randomises,
    // client never reshuffles).
    for (let i = 0; i < 20 && !quizSet; i++) await pause(page, 150)
    const answerMap = quizSet ? resolveAnswers(quizSet.map((q) => q.id)) : {}

    for (let q = 0; q < QUESTIONS; q++) {
      const shownAt = Date.now()
      step(`Q${q + 1}/${QUESTIONS}: read, then answer`)
      await pause(page, 3200) // read the question

      const count = await options.count()
      const correctLetter = quizSet?.[q] ? answerMap[quizSet[q].id] : undefined
      let pick = correctLetter ? LETTERS.indexOf(correctLetter) : q % count
      if (pick < 0 || pick >= count) pick = q % count
      if (q === MISS_INDEX) pick = (pick + 1) % count // one deliberate miss → 4/5
      await options.nth(pick).click()
      await pause(page, 1400)

      // Honour the app's 7s-per-question minimum before Next/Submit is allowed.
      const elapsed = Date.now() - shownAt
      const remaining = MIN_SEC_PER_Q * 1000 + 900 - elapsed
      if (remaining > 0) await pause(page, remaining)

      if (q < QUESTIONS - 1) {
        await page.getByRole('button', { name: /^Next$/ }).click()
        await pause(page, 1300) // let the next question animate in
      } else {
        step('Submit the test')
        await page.getByRole('button', { name: /submit test/i }).click()
      }
    }

    // ── 5. Result ──────────────────────────────────────────────────────────────
    await page.waitForURL('**/result', { timeout: 25_000 })
    step('Show the score')
    await pause(page, 2600)
    step('Scroll through the answer review + explanations')
    await page.mouse.wheel(0, 700)
    await pause(page, 2400)
    await page.mouse.wheel(0, 700)
    await pause(page, 2600)

    console.log('\n✅ Flow complete — finalising the video…')
  } catch (err) {
    console.error('\n❌ Flow failed:', err.message)
    try {
      await page.screenshot({ path: 'recordings/_failure.png', fullPage: true })
      console.error('   Saved recordings/_failure.png and the URL was:', page.url())
    } catch {}
    process.exitCode = 1
  } finally {
    // close() finalises the .webm; grab its path to print for convenience.
    const video = page.video()
    await context.close()
    await browser.close()
    if (video) {
      const p = await video.path().catch(() => null)
      if (p) console.log('🎬 Recording saved to:', p)
    }
  }
}

run()
