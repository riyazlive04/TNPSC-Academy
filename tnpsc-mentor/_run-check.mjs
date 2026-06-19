// TEMP run-check: load the live app and screenshot the landing screen.
import { chromium } from 'playwright'

const BASE = 'http://localhost:5173'
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 })
const page = await ctx.newPage()
const errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
const resp = await page.goto(BASE, { waitUntil: 'networkidle', timeout: 20000 })
console.log('HTTP status:', resp?.status())
await page.waitForTimeout(1500)
console.log('Page title:', await page.title())
const bodyText = (await page.locator('body').innerText()).slice(0, 300).replace(/\n+/g, ' | ')
console.log('Visible text:', bodyText)
console.log('Console errors:', errors.length ? errors.slice(0, 5) : 'none')
await page.screenshot({ path: 'shots/run-check.png', fullPage: false })
console.log('screenshot -> shots/run-check.png')
await browser.close()
