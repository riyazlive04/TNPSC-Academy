// TEMP screenshot harness (delete after). Renders the redesigned Home in the
// app's UI-preview mode (no backend/login) at mobile width, light + dark.
import { chromium } from 'playwright'

const BASE = 'http://localhost:5173'
const shots = [
  { name: 'profile-light', theme: 'light', path: '/preview-profile', w: 430, h: 1400 },
  { name: 'profile-dark', theme: 'dark', path: '/preview-profile', w: 430, h: 1400 },
]

const browser = await chromium.launch()
for (const s of shots) {
  const ctx = await browser.newContext({
    viewport: { width: s.w, height: s.h },
    deviceScaleFactor: 2,
    isMobile: s.w < 600,
  })
  await ctx.addInitScript((theme) => {
    localStorage.setItem('tnpsc:theme', theme)
  }, s.theme)
  const page = await ctx.newPage()
  await page.goto(BASE + s.path, { waitUntil: 'domcontentloaded' })
  // Let fonts, the gradient hero and the entrance settle.
  await page.waitForSelector('main', { timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(1800)
  await page.screenshot({ path: `shots/${s.name}.png`, fullPage: true })
  console.log('captured', s.name)
  await ctx.close()
}
await browser.close()
console.log('done')
