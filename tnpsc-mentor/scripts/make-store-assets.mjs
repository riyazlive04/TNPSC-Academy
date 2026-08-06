// ─── Play Store graphic assets ───────────────────────────────────────────────
// Renders the store icon and feature graphic from the SAME brand mark the app
// ships (public/logo-mark.png), so the Play listing, the installed launcher icon
// and the app header can never drift apart.
//
//   node scripts/make-store-assets.mjs
//
// Output → store-assets/. Play's requirements, which the sizes below satisfy:
//   icon            512x512 PNG, 32-bit, <1 MB
//   feature graphic 1024x500 PNG/JPG, NO alpha channel
//
// Two icon variants are produced. `icon-512-white.png` matches the installed
// launcher icon (white plate, colour mark) and is the one to upload for a
// consistent brand; `icon-512-violet.png` is the higher-contrast alternative for
// dark store themes. Pick one — don't ship both.

import { chromium } from 'playwright'
import { mkdirSync, readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const out = join(root, 'store-assets')
mkdirSync(out, { recursive: true })

// Inlined as a data URI, not a file:// src: setContent() leaves the page on an
// about:blank origin, which blocks file:// subresources — the mark silently
// renders as a broken-image box.
const MARK = `data:image/png;base64,${readFileSync(
  join(root, 'public', 'logo-mark.png')
).toString('base64')}`

// Brand tokens, matching package.json's `assets` script and the app's theme.
const VIOLET = '#7C5CFF'
const VIOLET_DEEP = '#4C1D95'
const INK = '#181527'
const ORANGE = '#FB6D2E'

const FONT =
  "'Segoe UI', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif"

/** White plate + colour mark — the launcher icon, at store resolution. */
const iconWhite = `
<div style="width:512px;height:512px;background:#fff;display:flex;
            align-items:center;justify-content:center">
  <img src="${MARK}" style="width:82%;height:82%;object-fit:contain">
</div>`

/** Violet gradient + the mark on a white disc, for higher contrast. */
const iconViolet = `
<div style="width:512px;height:512px;
            background:linear-gradient(135deg,${VIOLET} 0%,${VIOLET_DEEP} 100%);
            display:flex;align-items:center;justify-content:center">
  <div style="width:78%;height:78%;border-radius:50%;background:#fff;
              display:flex;align-items:center;justify-content:center;
              box-shadow:0 18px 48px rgba(0,0,0,.22)">
    <img src="${MARK}" style="width:74%;height:74%;object-fit:contain">
  </div>
</div>`

/**
 * A real phone screenshot for the feature graphic. A logo on a gradient tells a
 * browsing user nothing; the actual product does the selling. Falls back to the
 * logo lockup if the screenshots haven't been captured yet.
 */
const SHOT_FILE = join(root, 'store-assets', 'screenshots', 'phone', '02-previous-year-papers.png')
const SHOT = existsSync(SHOT_FILE)
  ? `data:image/png;base64,${readFileSync(SHOT_FILE).toString('base64')}`
  : null

/**
 * 1024x500. Play crops the edges on some surfaces and scales this down hard in
 * search results, so: few words, big type, and nothing load-bearing near a
 * border. The device sits flush to the right edge and bleeds off the bottom —
 * depth without risking a crop through the headline.
 */
const feature = `
<div style="width:1024px;height:500px;position:relative;overflow:hidden;
            background:radial-gradient(120% 140% at 8% 12%, #6D28D9 0%, ${VIOLET_DEEP} 45%, #2E1065 100%);
            font-family:${FONT}">
  <!-- Depth: one warm glow to pick up the mark's orange, one cool rim light. -->
  <div style="position:absolute;width:520px;height:520px;border-radius:50%;
              left:-160px;bottom:-260px;background:rgba(251,109,46,.16);filter:blur(10px)"></div>
  <div style="position:absolute;width:760px;height:760px;border-radius:50%;
              right:-160px;top:-320px;background:rgba(160,130,255,.20);filter:blur(6px)"></div>

  <div style="position:absolute;inset:0;display:flex;align-items:center;padding:0 0 0 62px">
    <div style="flex:1;color:#fff;z-index:2;max-width:600px">
      <!-- Logo lockup, small: the wordmark carries the brand, not a giant disc. -->
      <div style="display:flex;align-items:center;gap:12px">
        <div style="width:46px;height:46px;border-radius:12px;background:#fff;
                    display:flex;align-items:center;justify-content:center;flex:none">
          <img src="${MARK}" style="width:78%;height:78%;object-fit:contain">
        </div>
        <span style="font-size:25px;font-weight:700;letter-spacing:-.3px">TNPSC Mentors</span>
      </div>

      <div style="margin-top:26px;font-size:57px;font-weight:800;letter-spacing:-1.8px;
                  line-height:1.04">
        Real papers.<br>Real practice.
      </div>

      <div style="margin-top:20px;font-size:23px;font-weight:600;line-height:1.45;opacity:.94">
        Group 1 · 2 · 2A · 4 · VAO
        <span style="color:${ORANGE};margin:0 8px">•</span>
        English &amp; தமிழ்
      </div>

      <div style="margin-top:24px;display:flex;gap:26px;font-size:18px;font-weight:600;opacity:.9">
        ${['Previous year papers', 'Full mock tests', 'Daily current affairs']
          .map(
            (t) =>
              `<span style="display:flex;align-items:center;gap:8px">
                 <span style="width:7px;height:7px;border-radius:50%;background:${ORANGE};
                              display:inline-block;flex:none"></span>${t}</span>`
          )
          .join('')}
      </div>
    </div>

    ${
      SHOT
        ? // 286x491 outer, 11px bezel → 264x469 inner, which is exactly the 9:16 of
          // a 1080x1920 capture. Matching the aspect means the shot neither
          // letterboxes (half-empty phone) nor crops (clipped headings). It sits
          // low enough to bleed off the bottom edge, which reads as depth.
          `<div style="position:absolute;right:56px;top:64px;width:286px;height:491px;
                  border-radius:40px;background:#0B0A14;padding:11px;
                  box-shadow:0 40px 90px rgba(0,0,0,.5), 0 0 0 1px rgba(255,255,255,.12);
                  transform:rotate(-7deg);z-index:1">
             <div style="width:100%;height:100%;border-radius:30px;overflow:hidden;background:#fff">
               <!-- cover, not width:100%: a 9:16 shot letterboxes inside this frame
                    and leaves the phone half empty. Cropping ~8% off each side
                    (app padding) shows the whole screen top to bottom instead. -->
               <img src="${SHOT}" style="width:100%;height:100%;object-fit:cover;
                                          object-position:top center;display:block">
             </div>
           </div>`
        : `<div style="width:300px;height:300px;border-radius:50%;background:#fff;
                  display:flex;align-items:center;justify-content:center;margin-right:62px;
                  box-shadow:0 26px 70px rgba(0,0,0,.28);flex:none">
             <img src="${MARK}" style="width:74%;height:74%;object-fit:contain">
           </div>`
    }
  </div>
</div>`

const JOBS = [
  { name: 'icon-512-white.png', html: iconWhite, w: 512, h: 512 },
  { name: 'icon-512-violet.png', html: iconViolet, w: 512, h: 512 },
  // The feature graphic is emitted as JPEG as well: Play's spec says no alpha
  // channel, and every PNG Playwright writes is RGBA even when fully opaque.
  // Upload the .jpg unless you have a reason not to.
  { name: 'feature-graphic-1024x500.png', html: feature, w: 1024, h: 500 },
  { name: 'feature-graphic-1024x500.jpg', html: feature, w: 1024, h: 500, jpeg: true },
]

const browser = await chromium.launch()
for (const job of JOBS) {
  const page = await browser.newPage({
    viewport: { width: job.w, height: job.h },
    deviceScaleFactor: 1,
  })
  await page.setContent(
    `<body style="margin:0;background:${INK}">${job.html}</body>`,
    { waitUntil: 'networkidle' }
  )
  await page.screenshot({
    path: join(out, job.name),
    ...(job.jpeg ? { type: 'jpeg', quality: 95 } : { type: 'png' }),
  })
  await page.close()
  console.log(`wrote store-assets/${job.name}  (${job.w}x${job.h})`)
}
await browser.close()
