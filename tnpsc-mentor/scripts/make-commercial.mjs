// Compose the mobile screen-recording into a commercial:
//   node scripts/make-commercial.mjs
//
// Renders a branded 1920×1080 backdrop + a phone frame (via a headless page
// screenshot), then composites the recorded mobile webm inside the phone screen
// with ffmpeg → commercial.mp4 (+ commercial.gif).
//
// Env: WEBM=<path> to pick a specific recording (defaults to the newest).

import { chromium } from 'playwright'
import { execFileSync } from 'node:child_process'
import { readdirSync, statSync } from 'node:fs'
import path from 'node:path'

// ── Layout geometry (all in the 1920×1080 output space) ──────────────────────
const CANVAS = { w: 1920, h: 1080 }
const SCREEN = { w: 434, h: 940 } // recorded 390×844 upscaled ~11%
const BEZEL = 16
const PHONE = { w: SCREEN.w + BEZEL * 2, h: SCREEN.h + BEZEL * 2 } // 466×972
const PHONE_X = 1150
const PHONE_Y = Math.round((CANVAS.h - PHONE.h) / 2) // vertically centred → 54
const SCREEN_X = PHONE_X + BEZEL
const SCREEN_Y = PHONE_Y + BEZEL

const FONT = `Inter, "Segoe UI Variable", "Segoe UI", system-ui, -apple-system, sans-serif`

// ── The branded backdrop (opaque): gradient + wordmark + headline + pills ─────
// Solid violet fallback via background-color so a dropped gradient layer can never
// leave a white page.
const bgHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:${CANVAS.w}px;height:${CANVAS.h}px;overflow:hidden;font-family:${FONT}}
  body{background-color:#5A38DE;background-image:
    radial-gradient(1300px 900px at 10% 12%, rgba(255,255,255,.22), transparent 58%),
    radial-gradient(1200px 1200px at 92% 98%, rgba(28,12,86,.65), transparent 60%),
    linear-gradient(135deg,#6E56F0 0%,#5A38DE 46%,#34199A 100%);}
  .dots{position:absolute;inset:0;background-image:radial-gradient(rgba(255,255,255,.07) 1.4px,transparent 1.4px);background-size:24px 24px}
  .copy{position:absolute;left:120px;top:50%;transform:translateY(-50%);width:930px;color:#fff}
  .brand{display:flex;align-items:center;gap:14px;margin-bottom:34px}
  .mark{width:52px;height:52px;border-radius:15px;background:linear-gradient(140deg,#fff,#e9e4ff);
    display:flex;align-items:center;justify-content:center;box-shadow:0 10px 30px rgba(0,0,0,.25)}
  .mark span{font-size:30px;font-weight:800;color:#5A38DE;line-height:1}
  .word{font-size:30px;font-weight:700;letter-spacing:.2px}
  .word b{opacity:.82;font-weight:700}
  h1{font-size:74px;line-height:1.04;font-weight:800;letter-spacing:-1.5px;margin-bottom:22px}
  .sub{font-size:24px;line-height:1.5;color:rgba(255,255,255,.84);margin-bottom:34px;max-width:770px}
  .pills{display:flex;flex-wrap:wrap;gap:12px}
  .pill{font-size:19px;font-weight:600;color:#fff;padding:11px 20px;border-radius:999px;
    background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.28)}
</style></head><body>
  <div class="dots"></div>
  <div class="copy">
    <div class="brand"><div class="mark"><span>த</span></div><div class="word">TNPSC <b>Mentors</b></div></div>
    <h1>Crack TNPSC<br/>from your pocket.</h1>
    <p class="sub">12,000+ bilingual questions, timed mock tests, smart revision and
      progress insights — one focused workspace, in English &amp; தமிழ்.</p>
    <div class="pills">
      ${['Previous-Year Qs', 'Mock Tests', 'Current Affairs', 'Aptitude', 'Revision']
        .map((p) => `<span class="pill">${p}</span>`)
        .join('')}
    </div>
  </div>
</body></html>`

// ── The phone frame (transparent screen hole via a BORDER bezel) ──────────────
// A bordered box with a transparent center is a real hole — a transparent child
// of an opaque parent is NOT (the parent paints behind it).
const frameHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  *{margin:0;box-sizing:border-box}
  html,body{width:${CANVAS.w}px;height:${CANVAS.h}px;background:transparent}
  .phone{position:absolute;left:${PHONE_X}px;top:${PHONE_Y}px;width:${PHONE.w}px;height:${PHONE.h}px;
    background:transparent;border:${BEZEL}px solid #0b0b13;border-radius:58px;
    box-shadow:0 55px 120px rgba(18,8,55,.55), 0 12px 34px rgba(0,0,0,.40)}
  .rim{position:absolute;left:${SCREEN_X}px;top:${SCREEN_Y}px;width:${SCREEN.w}px;height:${SCREEN.h}px;
    border-radius:42px;box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.12)}
  .cam{position:absolute;left:${PHONE_X + PHONE.w / 2 - 4.5}px;top:${PHONE_Y + 5}px;width:9px;height:9px;
    border-radius:50%;background:#15151f;box-shadow:inset 0 0 0 1.5px rgba(150,150,180,.5)}
  .btn{position:absolute;background:#07070d;border-radius:3px}
</style></head><body>
  <div class="phone"></div>
  <div class="rim"></div>
  <div class="cam"></div>
  <div class="btn" style="left:${PHONE_X - 3}px;top:${PHONE_Y + 210}px;width:4px;height:58px"></div>
  <div class="btn" style="left:${PHONE_X - 3}px;top:${PHONE_Y + 288}px;width:4px;height:92px"></div>
  <div class="btn" style="left:${PHONE_X + PHONE.w - 1}px;top:${PHONE_Y + 250}px;width:4px;height:110px"></div>
</body></html>`

function newestWebm() {
  if (process.env.WEBM) return process.env.WEBM
  const dir = 'recordings'
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.webm'))
    .map((f) => ({ f: path.join(dir, f), t: statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t)
  if (!files.length) throw new Error('No recordings/*.webm found — record first.')
  return files[0].f
}

async function render() {
  const browser = await chromium.launch()
  const page = await browser.newPage({
    viewport: { width: CANVAS.w, height: CANVAS.h },
    deviceScaleFactor: 1,
  })
  await page.setContent(bgHtml, { waitUntil: 'load' })
  await page.waitForTimeout(250)
  await page.screenshot({ path: 'recordings/bg.png' })
  await page.setContent(frameHtml, { waitUntil: 'load' })
  await page.waitForTimeout(250)
  await page.screenshot({ path: 'recordings/frame.png', omitBackground: true })
  await browser.close()
}

function ffprobeDuration(file) {
  const out = execFileSync('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1', file,
  ], { encoding: 'utf8' })
  return parseFloat(out.trim())
}

async function main() {
  const webm = newestWebm()
  console.log('source recording:', webm)
  console.log('rendering backdrop + phone frame…')
  await render()

  const dur = ffprobeDuration(webm)
  const outStart = Math.max(0, dur - 0.6).toFixed(2)

  // Composite: backdrop ← video (in the screen) ← phone frame on top, with a
  // gentle fade in/out. The frame's rounded transparent hole rounds the video.
  const filter =
    `[2:v]scale=${SCREEN.w}:${SCREEN.h}:flags=lanczos[scr];` +
    `[0:v][scr]overlay=${SCREEN_X}:${SCREEN_Y}[a];` +
    `[a][1:v]overlay=0:0[b];` +
    `[b]fade=t=in:st=0:d=0.5,fade=t=out:st=${outStart}:d=0.6,format=yuv420p[v]`

  console.log('compositing commercial.mp4…')
  execFileSync('ffmpeg', [
    '-y', '-loop', '1', '-i', 'recordings/bg.png',
    '-loop', '1', '-i', 'recordings/frame.png',
    '-i', webm,
    '-filter_complex', filter, '-map', '[v]',
    '-r', '30', '-t', String(dur),
    '-c:v', 'libx264', '-crf', '19', '-preset', 'medium', '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart', 'commercial.mp4',
  ], { stdio: ['ignore', 'ignore', 'inherit'] })

  console.log('rendering commercial.gif…')
  execFileSync('ffmpeg', [
    '-y', '-i', 'commercial.mp4',
    '-vf', 'fps=13,scale=900:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=200[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3',
    'commercial.gif',
  ], { stdio: ['ignore', 'ignore', 'inherit'] })

  console.log('\n✅ Done: commercial.mp4 + commercial.gif')
}

main()
