// ─── HTML for the public question archive ────────────────────────────────────
// Every page is finished HTML: the question, its options and the answer are in
// the markup, not fetched by script. That is the whole point — a crawler that
// cannot run JavaScript still sees the full question, which is what lets an
// exact-match search for a question's wording find this site.
//
// The look is the answer-key pages' look (src/components/Landing/AnswerKeyChrome.tsx
// and src/pages/AnswerKeyPage.tsx): same header, same sidebar boxes, same
// feature cards, same footer, same sticky mobile bar, same violet. Those pages
// are what a stranger from Google already meets, and two different public faces
// on one domain would be a worse experience than either alone.
//
// Tokens are copied from src/index.css as literal hex because this tree is
// built outside Vite and loads no Tailwind. Light only, deliberately: the
// answer-key pages call useForceLightTheme(), so a dark-mode archive would be
// the odd one out.

import katex from 'katex'
import { ALL_UNITS } from './taxonomy.mjs'
import { stemHtml } from './stemfmt.mjs'

export const ORIGIN = 'https://tnpscmentors.in'
export const BASE = '/questions'
/** The app the pages send people to. */
export const APP_ORIGIN = 'https://app.tnpscmentors.in'
export const BRAND = 'TNPSC Mentors'
// The apex, not APP_ORIGIN: both hostnames serve the same SPA, but only the
// apex also serves this archive, so it is the only host a ?from=/questions/...
// round trip can come back to.
export const APP_REGISTER = `${ORIGIN}/register`
export const APP_LOGIN = `${ORIGIN}/login`
/** The same, told where to return once the account exists. */
export const authUrl = (base, backTo) =>
  backTo ? `${base}?from=${encodeURIComponent(backTo)}` : base

/** The same accounts the answer-key pages link to. */
export const YOUTUBE_URL = 'https://www.youtube.com/@TNPSCMentors4you'
export const INSTAGRAM_URL = 'https://www.instagram.com/mentorstnpsc/?hl=en'
export const TELEGRAM_URL = 'https://t.me/+fnGJ6TbCiI8wNTY1'
export const FACEBOOK_URL = 'https://www.facebook.com/profile.php?id=61591260240425&sk=about'

// ─── Text ────────────────────────────────────────────────────────────────────

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c])
}

/** For a <title>/description/JSON-LD string: collapse whitespace, drop markup. */
export function plain(s, maxLen = 0) {
  let out = String(s ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  if (maxLen && out.length > maxLen) out = out.slice(0, maxLen - 1).replace(/\s+\S*$/, '') + '…'
  return out
}

// ─── Bilingual ───────────────────────────────────────────────────────────────
// Every page carries both languages at once. A visitor picks one with the
// control in the header and CSS hides the other; with JavaScript off, or on a
// crawler, both stay visible — which is also how the Tamil question text keeps
// getting indexed. Nothing is ever fetched or swapped: the words are all
// already on the page.

/** English half of a bilingual pair. */
export function en(html) {
  return `<span class="l-en">${html}</span>`
}
/** Tamil half. Carries lang=ta so a screen reader changes voice. */
export function ta(html) {
  return `<span class="l-ta tamil" lang="ta">${html}</span>`
}
/** English half of a bilingual block — a table, a list, several paragraphs. */
export function enBlock(html) {
  return `<div class="l-en">${html}</div>`
}
/** Tamil half of a bilingual block. */
export function taBlock(html) {
  return `<div class="l-ta tamil" lang="ta">${html}</div>`
}

/** Both halves of a label, escaped and stacked. For content. */
export function both(e, t) {
  return `${en(esc(e))}${t ? ta(esc(t)) : ''}`
}

/**
 * A label for chrome — a button, a nav link, a stat caption. Shows English by
 * default and Tamil only once the visitor has chosen it, because stacking two
 * languages inside a pill makes the furniture taller than the thing it points
 * at. Content uses both() and stacks.
 */
export function one(e, t) {
  return `<span class="one">${both(e, t)}</span>`
}

// ─── Math ────────────────────────────────────────────────────────────────────
// Ported from src/components/UI/MathText.tsx, including its literal-dollar
// guard, so an aptitude stem reads the same here as it does in the app. The two
// copies are identical as of 2026-10-03; if that file's rules change, change
// these too.

const MATH_RE = /\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g

function isLiteralDollarSpan(s) {
  if (/[\\^_{}]/.test(s)) return false
  // Indic script with no LaTeX around it is a sentence that happens to sit
  // between two stray dollar signs, not an equation. The test comes after the
  // one above on purpose: this bank really does write fractions with Tamil
  // operands — \dfrac{மதிப்பெண்களின் கூட்டுத்தொகை}{மாணவர்களின் எண்ணிக்கை} is a
  // perfectly good "sum of marks over number of students" — and those carry a
  // backslash or a brace, so they are already settled as mathematics above.
  if (/[\u0900-\u0DFF]/.test(s)) return true
  if (/\b(billion|million|trillion|crore|lakh)\b/i.test(s)) return true
  // A number followed by a word, as in "A sum grows from $400 to $500" — the
  // span captured between the two dollar signs is "400 to ", which carries only
  // one short word and so slipped past the two-long-words test below. Genuine
  // single-$ math ("$x$", "$2+3$", "$n = 5$") has no digit-then-word pair.
  if (/\d[\d,.]*\s+[A-Za-z]/.test(s)) return true
  return (s.match(/[A-Za-z]{3,}/g) ?? []).length >= 2
}

const mathCache = new Map()

function tex(src) {
  const hit = mathCache.get(src)
  if (hit !== undefined) return hit
  let html
  try {
    html = katex.renderToString(src, {
      throwOnError: false,
      displayMode: false,
      output: 'html',
      // 'ignore', not the default 'warn': this bank legitimately typesets Tamil
      // words as operands inside \dfrac{}, and KaTeX logs a line per character
      // for it. Hundreds of those hide the warnings worth reading.
      strict: 'ignore',
    })
  } catch {
    html = esc(src)
  }
  mathCache.set(src, html)
  return html
}

/** Escaped HTML with any LaTeX typeset. Safe to wrap every stem and option. */
export function mathText(s) {
  const text = String(s ?? '')
  if (text === '') return ''
  if (!/[\\$]/.test(text)) return esc(text)

  let out = ''
  let last = 0
  MATH_RE.lastIndex = 0
  let m
  while ((m = MATH_RE.exec(text)) !== null) {
    out += esc(text.slice(last, m.index))
    if (m[4] != null && isLiteralDollarSpan(m[4])) out += esc(m[0])
    else out += tex((m[1] ?? m[2] ?? m[3] ?? m[4] ?? '').trim())
    last = m.index + m[0].length
  }
  out += esc(text.slice(last))
  return out
}

export function hasMath(...parts) {
  return parts.some((p) => {
    const s = String(p ?? '')
    if (!/[\\$]/.test(s)) return false
    MATH_RE.lastIndex = 0
    let m
    while ((m = MATH_RE.exec(s)) !== null) {
      if (!(m[4] != null && isLiteralDollarSpan(m[4]))) return true
    }
    return false
  })
}

/** Paragraph-split prose with its maths typeset. */
export function prose(s) {
  const text = String(s ?? '').trim()
  if (!text) return ''
  return text
    .split(/\n{2,}/)
    .map((p) => `<p>${mathText(p.trim()).replace(/\n/g, '<br>')}</p>`)
    .join('')
}

// ─── Stylesheet ──────────────────────────────────────────────────────────────
// Hand-written to match the Tailwind classes AnswerKeyChrome.tsx uses. Values
// come from src/index.css (:root) and tailwind.config.js (radii, shadows).

export const CSS = `:root{
  color-scheme:light;
  --brand:#6E4FE8; --brand-dark:#6446E0; --brand-deep:#5B3DD6; --brand-soft:#E6E1FB;
  --secondary:#8A5CF0;
  --canvas:#F4F1F9; --card:#FFFFFF; --ink:#221E3A; --ink2:#6E6986; --line:#E7E3F0;
  --gray-50:#FAFAFB;
  --correct:#00B28C; --correct-soft:#DDF2EA; --correct-ink:#047857;
  --accent:#FF6B4A; --gold-soft:#FDF0D9; --gold-ink:#9A6300;
  --shadow-soft:0 12px 28px rgb(88 72 200 / .08);
  --shadow-pill:0 2px 8px rgb(88 72 200 / .06);
  --r-field:16px; --r-tile:18px; --r-card:20px; --r-hero:24px;
  --head-h:62px;
}
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;scroll-behavior:smooth}
body{margin:0;background:var(--canvas);color:var(--ink);
  font-family:'Inter','Noto Sans Tamil',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;
  font-size:16px;line-height:1.65;-webkit-font-smoothing:antialiased}
h1,h2,h3,h4,.font-heading{font-family:'Plus Jakarta Sans','Anek Tamil',system-ui,sans-serif;
  letter-spacing:-.018em;font-weight:700}
.tamil{font-family:'Noto Sans Tamil','Inter',sans-serif}
a{color:var(--brand);text-decoration:none}
a:hover{text-decoration:underline}
img{max-width:100%}
:focus-visible{outline:2px solid var(--brand);outline-offset:2px;border-radius:8px}
.shell{max-width:1152px;margin:0 auto;padding:0 16px}
@media (min-width:640px){.shell{padding:0 24px}}

/* ── Language switch. Without JS both languages show, which is what a crawler
      sees too; picking one hides the other. ─────────────────────────────────*/
html[data-lang="en"] .l-ta{display:none!important}
html[data-lang="ta"] .l-en{display:none!important}
/* Content stacks: the English line, then the Tamil under it. Two languages
   running together on one line is unreadable in either. */
.l-en,.l-ta{display:block}
.l-ta{font-size:.94em}
/* Chrome does not stack. A nav link, a button or a stat label doubled in height
   makes the furniture shout louder than the question, so these show English
   until somebody actually asks for Tamil — and then they show only Tamil. The
   words in here are navigation, not content, so nothing is lost to a crawler. */
.one .l-en,.one .l-ta{display:inline}
html:not([data-lang]) .one .l-ta{display:none}
.langset{display:inline-flex;background:var(--canvas);border:1px solid var(--line);
  border-radius:999px;padding:3px;gap:2px}
.langset button{appearance:none;border:0;background:none;cursor:pointer;
  font-family:'Plus Jakarta Sans','Anek Tamil',sans-serif;font-size:12.5px;font-weight:700;
  color:var(--ink2);padding:6px 10px;border-radius:999px;line-height:1;white-space:nowrap}
.langset button:hover{color:var(--brand-dark)}
html:not([data-lang]) .langset button[data-lang-set=""],
html[data-lang="en"] .langset button[data-lang-set="en"],
html[data-lang="ta"] .langset button[data-lang-set="ta"]{background:var(--card);
  color:var(--brand-dark);box-shadow:var(--shadow-pill)}

/* ── First-visit language prompt ─────────────────────────────────────────────
   A port of src/components/Landing/LandingLangPrompt.tsx, which the answer-key
   pages already show a first-time visitor. Same card, same two colours, same
   wording — somebody who meets both pages should meet the same question once,
   not two different ones.

   The two button colours are fixed hex rather than theme tokens, as in the
   original: white labels have to stay legible on both, and the palette's blue
   and coral do not hold that at every weight. */
html.lang-asking{overflow:hidden}
.langask{position:fixed;inset:0;z-index:55;display:grid;place-items:center;padding:16px;
  background:rgb(34 30 58 / .5);backdrop-filter:blur(4px);overflow-y:auto;
  animation:askin .18s ease-out}
.langask[hidden]{display:none}
@keyframes askin{from{opacity:0}to{opacity:1}}
.langask .card{width:100%;max-width:384px;background:var(--card);border:1px solid var(--line);
  border-radius:24px;padding:20px;box-shadow:0 24px 60px rgb(34 30 58 / .3);
  animation:asksheet .22s cubic-bezier(0,0,.2,1)}
@media (min-width:640px){.langask .card{padding:24px}}
@keyframes asksheet{from{opacity:0;transform:translateY(12px) scale(.98)}to{opacity:1;transform:none}}
.langask .brandrow{display:flex;align-items:center;gap:12px}
.langask .brandrow img{height:48px;width:48px;object-fit:contain;flex:0 0 auto}
.langask .brandrow p{margin:0;font-family:'Plus Jakarta Sans',sans-serif;font-size:18px;
  font-weight:800;color:var(--ink)}
.langask .brandrow p b{color:var(--brand)}
.langask h2{margin:20px 0 0}
.langask h2 .ta{display:block;font-size:16px;font-weight:700;color:var(--ink)}
.langask h2 .en{display:block;font-size:14px;font-weight:600;color:var(--ink2);margin-top:2px}
.langask .opts{display:flex;flex-direction:column;gap:12px;margin:16px 0 0}
.langask .opts button{display:flex;align-items:center;justify-content:space-between;gap:12px;
  width:100%;border:0;cursor:pointer;border-radius:14px;padding:16px 20px;text-align:left;
  font-family:'Plus Jakarta Sans','Anek Tamil',sans-serif;font-size:20px;font-weight:700;
  color:#fff;transition:filter .15s ease}
.langask .opts button:hover{filter:brightness(1.1)}
.langask .opts button:active{transform:scale(.98)}
.langask .opts .ta-btn{background:#E4572E}
.langask .opts .en-btn{background:#2A5DB0}
.langask .opts svg{flex:0 0 auto}
/* An escape. The app's version has no way out but a choice, which is right for
   a pay page; this one is reached from a search result, and a reader who wants
   the question in both languages should not have to pick one to see it. */
.langask .both{display:block;width:100%;margin:14px 0 0;background:none;border:0;cursor:pointer;
  font-family:inherit;font-size:13.5px;color:var(--ink2);text-align:center;padding:6px}
.langask .both:hover{color:var(--brand-dark);text-decoration:underline}

/* ── Buttons ─────────────────────────────────────────────────────────────── */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;
  border-radius:999px;padding:11px 20px;font-family:'Plus Jakarta Sans','Anek Tamil',sans-serif;
  font-size:14px;font-weight:700;line-height:1.25;text-decoration:none!important;
  transition:all .2s ease;border:1px solid transparent;cursor:pointer;text-align:center}
.btn-brand{background:linear-gradient(135deg,var(--secondary) 0%,var(--brand-deep) 100%);color:#fff}
.btn-brand:hover{filter:brightness(1.1);transform:translateY(-1px)}
.btn-ghost{background:var(--card);border-color:var(--line);color:var(--ink)}
.btn-ghost:hover{border-color:rgb(110 79 232 / .4);color:var(--brand-dark);background:#FBFAFE}
.btn-lg{padding:14px 26px;font-size:15px}

/* ── Header ──────────────────────────────────────────────────────────────── */
.site-head{position:sticky;top:0;z-index:30;background:rgb(255 255 255 / .95);
  backdrop-filter:blur(8px);border-bottom:1px solid var(--line)}
.site-head .row{display:flex;align-items:center;justify-content:space-between;gap:10px;
  min-height:var(--head-h)}
.brand{display:flex;align-items:center;gap:10px;flex-shrink:0}
.brand:hover{text-decoration:none}
.brand img{height:36px;width:36px;object-fit:contain}
.brand .nm{font-family:'Plus Jakarta Sans',sans-serif;font-size:16px;font-weight:800;
  color:var(--ink);white-space:nowrap}
.brand .nm b{color:var(--brand);font-weight:800}
@media (max-width:420px){.brand .nm{display:none}}
.mainnav{display:none;align-items:center;gap:2px}
@media (min-width:980px){.mainnav{display:flex}}
.mainnav a{padding:8px 12px;border-radius:10px;font-family:'Plus Jakarta Sans','Anek Tamil',sans-serif;
  font-size:14.5px;font-weight:700;color:var(--ink)}
.mainnav a:hover{background:var(--brand-soft);color:var(--brand-dark);text-decoration:none}
.head-actions{display:flex;align-items:center;gap:8px;flex-shrink:0}
.head-actions .btn{padding:9px 15px;font-size:13.5px}
@media (max-width:639px){.head-actions .btn{display:none}}

/* ── Breadcrumbs ─────────────────────────────────────────────────────────── */
/* Pills, not a slash-separated line: they survive a long question title on a
   phone, and they read as taps rather than as decoration. */
.crumbs{padding:16px 0 0;display:flex;flex-wrap:wrap;gap:7px;align-items:center}
.crumbs a,.crumbs .here{display:inline-block;max-width:100%;border:1px solid var(--line);
  background:var(--card);border-radius:999px;padding:5px 13px;font-size:12.5px;
  color:var(--ink2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.crumbs a:hover{border-color:rgb(110 79 232 / .4);color:var(--brand-dark);text-decoration:none}
.crumbs .here{background:var(--brand-soft);border-color:transparent;color:var(--brand-dark);
  font-weight:600;max-width:min(100%,32ch)}

/* ── Layout: content + sidebar, the answer-key pages' grid ───────────────── */
.layout{padding:8px 0 40px}
@media (min-width:1024px){
  .layout{display:grid;grid-template-columns:1fr 300px;gap:40px;align-items:start}
}
.col-main{min-width:0}
.col-side{margin-top:32px;min-width:0}
@media (min-width:1024px){.col-side{margin-top:0}}

/* ── Hero ────────────────────────────────────────────────────────────────── */
/* Visually gone, still read by search engines and screen readers. Only for
   content something else on screen is already showing. */
.vh{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;
  clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0}

.herobanner{display:none}
@media (min-width:700px){
  html:not([data-lang="ta"]) .herobanner{
    display:block;margin:18px 0 6px;border-radius:var(--r-hero);overflow:hidden;
    aspect-ratio:1774/887;background:var(--brand-soft) center/cover no-repeat;
    background-image:image-set(url("hero-1200.webp") 1x, url("hero-1774.webp") 2x);
    box-shadow:var(--shadow-soft)}
  /* Older Safari/Chromium without image-set() take the JPEG. */
  @supports not (background-image:image-set(url("x.webp") 1x)){
    html:not([data-lang="ta"]) .herobanner{background-image:url("hero-1200.jpg")}
  }
  /* The banner already says all of this — keep it in the DOM, drop it visually. */
  html:not([data-lang="ta"]) .hero-text{position:absolute;width:1px;height:1px;
    margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);
    white-space:nowrap;border:0}
}
.hero{padding:22px 0 6px}
.hero h1{font-size:clamp(23px,4.2vw,34px);line-height:1.28;margin:12px 0 10px}
.hero .lede{color:var(--ink2);font-size:16.5px;margin:0 0 18px;max-width:62ch}
.eyebrow{display:inline-flex;align-items:center;gap:7px;background:var(--brand-soft);
  color:var(--brand-dark);font-family:'Plus Jakarta Sans','Anek Tamil',sans-serif;
  font-size:12.5px;font-weight:700;padding:6px 13px;border-radius:999px}
.stats{display:flex;gap:10px;flex-wrap:wrap;margin:0;padding:0;list-style:none}
.stats li{background:var(--card);border:1px solid var(--line);border-radius:var(--r-field);
  padding:10px 16px;font-size:13px;color:var(--ink2);box-shadow:var(--shadow-pill)}
.stats b{display:block;font-family:'Plus Jakarta Sans',sans-serif;font-size:20px;
  font-weight:800;color:var(--brand);letter-spacing:-.01em}

.hero-cta{display:flex;flex-wrap:wrap;gap:10px;margin:20px 0 0}

/* ── Scroll reveal, the counterpart of Landing/Reveal.tsx ─────────────────────
   Progressive enhancement: where view() timelines are unsupported the sections
   simply sit there, already visible, which is the correct fallback for content
   whose whole job is to be readable. */
@supports (animation-timeline: view()) {
  @media (prefers-reduced-motion: no-preference){
    .reveal{animation:revealin linear both;animation-timeline:view();
      animation-range:entry 10% cover 26%}
  }
}
@keyframes revealin{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}

/* Somebody who asked for less motion gets the card's final state and nothing
   moving. The React original deliberately ignores this because it is the point
   of that page; here the card is an illustration beside the questions. */
@media (prefers-reduced-motion: reduce){
  .reveal{animation:none!important}
}

.hero-cta{display:flex;flex-wrap:wrap;gap:10px;margin:20px 0 0}

/* ── Scroll reveal, the counterpart of Landing/Reveal.tsx ─────────────────────
   Progressive enhancement: where view() timelines are unsupported the sections
   simply sit there, already visible, which is the correct fallback for content
   whose whole job is to be readable. */
@supports (animation-timeline: view()) {
  @media (prefers-reduced-motion: no-preference){
    .reveal{animation:revealin linear both;animation-timeline:view();
      animation-range:entry 10% cover 26%}
  }
}
@keyframes revealin{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}

/* Somebody who asked for less motion gets the card's final state and nothing
   moving. The React original deliberately ignores this because it is the point
   of that page; here the card is an illustration beside the questions. */
@media (prefers-reduced-motion: reduce){
  .reveal{animation:none!important}
}

/* ── Cards & grids ───────────────────────────────────────────────────────── */
h2.sec{font-size:21px;margin:34px 0 4px}
p.sub{color:var(--ink2);font-size:14.5px;margin:4px 0 0;max-width:62ch}
.grid{display:grid;gap:14px;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));
  margin:18px 0 6px;padding:0;list-style:none}
.tile{background:var(--card);border:1px solid var(--line);border-radius:var(--r-card);
  padding:18px;box-shadow:var(--shadow-soft);display:flex;flex-direction:column;gap:7px;
  transition:all .2s ease}
.tile:hover{border-color:rgb(110 79 232 / .4);transform:translateY(-2px)}
.tile a.t{font-family:'Plus Jakarta Sans','Anek Tamil',sans-serif;font-size:16.5px;
  font-weight:700;color:var(--ink);line-height:1.35}
.tile a.t:hover{color:var(--brand-dark);text-decoration:none}
.tile .meta{font-size:13px;color:var(--ink2);margin-top:auto;padding-top:10px;
  display:flex;flex-wrap:wrap;gap:7px;align-items:center}
.tile .meta b{color:var(--brand);font-weight:700}
.chip{display:inline-block;background:var(--gold-soft);color:var(--gold-ink);font-size:11.5px;
  font-weight:700;padding:3px 10px;border-radius:999px;font-family:'Plus Jakarta Sans',sans-serif}

/* ── Listing rows ────────────────────────────────────────────────────────── */
.rows{list-style:none;padding:0;margin:16px 0;background:var(--card);
  border:1px solid var(--line);border-radius:var(--r-card);overflow:hidden;
  box-shadow:var(--shadow-soft)}
.rows li{border-bottom:1px solid var(--line)}
.rows li:last-child{border-bottom:0}
.rows a.r{display:flex;gap:13px;align-items:baseline;padding:14px 16px;color:var(--ink)}
.rows a.r:hover{background:var(--gray-50);color:var(--brand-dark);text-decoration:none}
.rows .n{color:var(--ink2);font-size:13px;flex:0 0 auto;font-variant-numeric:tabular-nums;
  min-width:26px}
.rows .q{flex:1 1 auto;font-size:15.5px;line-height:1.5}
.rows .go{flex:0 0 auto;color:var(--ink2);font-size:15px;align-self:center}

/* ── Sidebar box — the answer-key pages' pattern ─────────────────────────── */
.sidebox{overflow:hidden;border-radius:var(--r-card);border:1px solid var(--line);
  margin-bottom:18px;background:var(--card)}
.sidebox>p{margin:0;border-bottom:1px solid var(--line);padding:11px 16px;
  font-family:'Plus Jakarta Sans','Anek Tamil',sans-serif;font-size:12px;font-weight:700;
  text-transform:uppercase;letter-spacing:.06em;color:var(--brand-dark)}
.sidebox ul{list-style:none;margin:0;padding:0}
.sidebox li{border-top:1px solid var(--line)}
.sidebox li:first-child{border-top:0}
.sidebox a{display:flex;align-items:center;justify-content:space-between;gap:8px;
  padding:12px 16px;font-size:14px;font-weight:500;color:var(--ink)}
.sidebox a:hover{background:var(--gray-50);color:var(--brand-dark);text-decoration:none}
.sidebox a[aria-current]{background:var(--gray-50);color:var(--brand-dark);font-weight:700}
.sidebox a .lbl{min-width:0}
.sidebox a .go{color:var(--ink2);flex:0 0 auto;font-variant-numeric:tabular-nums;font-size:13px}

/* ── A question ──────────────────────────────────────────────────────────── */
article.q{background:var(--card);border:1px solid var(--line);border-radius:var(--r-card);
  padding:20px;box-shadow:var(--shadow-soft);margin:16px 0}
@media (min-width:640px){article.q{padding:26px}}
article.q h1,article.q .stem{font-size:clamp(19px,3vw,23px);line-height:1.45;margin:0;
  font-weight:700;font-family:'Plus Jakarta Sans','Anek Tamil',sans-serif}
article.q h1 .l-ta,article.q .stem .l-ta{font-size:.93em;margin-top:10px;padding-top:10px;
  border-top:1px dashed var(--line);font-weight:600}
/* ── Structured stems: match tables, statement lists, assertion/reason ───── */
.stem-body{margin:16px 0 0}
.stem-body>.l-ta{margin-top:14px;padding-top:12px;border-top:1px dashed var(--line)}
table.match{width:100%;border-collapse:collapse;font-size:15px;margin:0}
table.match thead th{font-family:'Plus Jakarta Sans','Anek Tamil',sans-serif;font-size:12px;
  font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--brand-dark);
  background:var(--brand-soft);padding:9px 12px;text-align:left}
table.match thead th:first-child{border-radius:10px 0 0 10px}
table.match thead th:last-child{border-radius:0 10px 10px 0}
table.match td,table.match tbody th{padding:10px 8px;border-bottom:1px solid var(--line);
  vertical-align:top;text-align:left;line-height:1.5}
table.match tbody th{width:1%;white-space:nowrap;color:var(--brand);font-weight:700;
  font-family:'Plus Jakarta Sans',sans-serif;font-size:14px;padding-right:4px}
table.match tbody tr:last-child td,table.match tbody tr:last-child th{border-bottom:0}
/* Two columns side by side need room. Below that they stack, which is still
   paired because each row keeps its letter and its number together. */
@media (max-width:560px){
  table.match,table.match tbody,table.match tr,table.match td,table.match th{display:block;width:auto}
  table.match thead{display:none}
  table.match tbody tr{border-bottom:1px solid var(--line);padding:8px 0}
  table.match tbody tr:last-child{border-bottom:0}
  table.match td,table.match tbody th{border-bottom:0;padding:3px 0;display:inline-block;
    vertical-align:top}
  table.match tbody th{padding-right:8px}
  table.match td{width:calc(100% - 42px)}
}
ul.stem-list{list-style:none;margin:0;padding:0}
ul.stem-list li{display:flex;gap:10px;align-items:flex-start;padding:7px 0;font-size:15.5px;
  line-height:1.55}
ul.stem-list li b{flex:0 0 auto;color:var(--brand);font-family:'Plus Jakarta Sans',sans-serif;
  font-weight:700;min-width:30px}
.stem-ar{display:grid;gap:10px}
.stem-ar p{margin:0;padding:12px 14px;background:var(--canvas);border-left:3px solid var(--brand);
  border-radius:0 10px 10px 0;font-size:15.5px;line-height:1.55}
.stem-lines{font-size:15.5px;line-height:1.7}
.stem-tail{margin:12px 0 0;font-size:14.5px;color:var(--ink2)}

.figs{display:flex;flex-wrap:wrap;gap:12px;margin:16px 0}
.figs img{max-height:280px;width:auto;border:1px solid var(--line);border-radius:12px;
  background:#fff;padding:5px;object-fit:contain}
ol.opts{list-style:none;padding:0;margin:18px 0 0}
ol.opts li{display:flex;gap:12px;align-items:flex-start;border:1.5px solid var(--line);
  border-radius:var(--r-field);padding:13px 15px;margin:0 0 9px;background:var(--card)}
ol.opts li .k{flex:0 0 28px;height:28px;border-radius:9px;background:var(--brand-soft);
  color:var(--brand-dark);font-weight:800;font-size:13px;display:grid;place-items:center;
  font-family:'Plus Jakarta Sans',sans-serif}
ol.opts li .v{flex:1 1 auto;font-size:15.5px;line-height:1.5;min-width:0}
ol.opts li .v .l-ta{color:var(--ink2);font-size:14.5px;margin-top:3px}
ol.opts li.ok{border-color:var(--correct);background:var(--correct-soft)}
ol.opts li.ok .k{background:var(--correct);color:#fff}
ol.opts li .opt-img{display:block;max-height:120px;margin-top:8px;border-radius:10px;background:#fff}
.tick{margin-left:auto;flex:0 0 auto;color:var(--correct-ink);font-weight:700;font-size:12.5px;
  font-family:'Plus Jakarta Sans','Anek Tamil',sans-serif;align-self:center;white-space:nowrap}
.verdict{display:flex;align-items:center;gap:13px;margin:18px 0 0;padding:15px 17px;
  background:var(--correct-soft);border-radius:var(--r-field);border:1px solid rgb(0 178 140 / .25)}
.verdict .big{background:var(--correct);color:#fff;width:36px;height:36px;border-radius:11px;
  display:grid;place-items:center;font-family:'Plus Jakarta Sans',sans-serif;font-weight:800;
  font-size:17px;flex:0 0 auto}
.verdict .lab{display:block;font-size:11.5px;font-weight:700;color:var(--correct-ink);
  text-transform:uppercase;letter-spacing:.05em;
  font-family:'Plus Jakarta Sans','Anek Tamil',sans-serif}
.verdict .val{display:block;font-size:15.5px;font-weight:600;color:var(--ink);line-height:1.4;
  margin-top:2px}

/* ── The locked explanation ──────────────────────────────────────────────── */
section.exp{margin:20px 0 0;padding:18px 0 0;border-top:1px solid var(--line)}
section.exp>h2{font-size:13px;text-transform:uppercase;letter-spacing:.07em;color:var(--ink2);
  margin:0 0 10px;font-weight:700}
section.exp p{margin:0 0 10px;font-size:15.5px;line-height:1.68}
.blurred{padding:2px 0 12px;filter:blur(5px);opacity:.45;user-select:none;pointer-events:none}
.blurred span{display:block;height:11px;border-radius:999px;background:var(--ink2);margin:10px 0}
.blurred span:nth-child(1){width:97%}
.blurred span:nth-child(2){width:88%}
.blurred span:nth-child(3){width:93%}
.blurred span:nth-child(4){width:61%}
.unlock{background:var(--brand-soft);border-radius:var(--r-card);padding:20px;margin-top:-8px}
.unlock .ask{margin:0 0 13px;font-size:16.5px;font-weight:700;color:var(--ink);
  font-family:'Plus Jakarta Sans','Anek Tamil',sans-serif;line-height:1.4}
.unlock ul{margin:0 0 17px;padding:0;list-style:none;font-size:14.5px;color:#4A3F7A}
.unlock ul li{padding:4px 0 4px 24px;position:relative;line-height:1.5}
.unlock ul li::before{content:"✓";position:absolute;left:0;top:4px;color:var(--brand);
  font-weight:800;font-size:13px}
.unlock .alt{margin:13px 0 0;font-size:13.5px;color:#5A4F8A;line-height:1.55}
.unlock .btn{width:100%}
@media (min-width:480px){.unlock .btn{width:auto}}
.why{list-style:none;padding:0;margin:10px 0 0}
.why li{font-size:14.5px;color:var(--ink2);padding:7px 0 7px 12px;border-left:2px solid var(--line)}
.exp-ta{margin-top:14px;padding-top:12px;border-top:1px dashed var(--line)}

/* ── Contents box ────────────────────────────────────────────────────────── */
.insight{background:var(--card);border:1px solid var(--line);border-radius:var(--r-card);
  padding:0;margin:16px 0;overflow:hidden;box-shadow:var(--shadow-soft)}
.ins-hero{display:flex;gap:14px;align-items:center;padding:18px 20px;background:var(--brand-soft);
  border-bottom:1px solid var(--line)}
.ins-hero:hover{text-decoration:none;filter:brightness(.985)}
.ins-hero .num{flex:0 0 auto;font-family:'Plus Jakarta Sans',sans-serif;font-size:34px;font-weight:800;
  color:var(--brand);line-height:1;font-variant-numeric:tabular-nums}
.ins-hero .num .x{font-size:19px;margin-left:2px;opacity:.55}
.ins-hero .txt{display:block;font-size:14.5px;color:var(--ink2);line-height:1.5;min-width:0}
.ins-hero .txt>b{display:block;font-family:'Plus Jakarta Sans','Anek Tamil',sans-serif;font-size:16px;
  font-weight:800;color:var(--ink);margin-bottom:2px}
.ins-hero .txt b{color:var(--ink)}
.ins-hero .go{display:block;margin-top:6px;font-weight:700;color:var(--brand);font-size:13.5px}
.ins-cells{display:grid;grid-template-columns:1fr;gap:1px;background:var(--line)}
@media (min-width:560px){.ins-cells{grid-template-columns:repeat(auto-fit,minmax(150px,1fr))}}
.ins-cell{display:block;padding:13px 20px;background:var(--card)}
.ins-cell:hover{text-decoration:none;background:var(--canvas)}
.ins-cell .k{display:block;font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;
  color:var(--ink2);margin-bottom:3px}
.ins-cell .v{display:block;font-family:'Plus Jakarta Sans','Anek Tamil',sans-serif;font-size:15px;
  font-weight:700;color:var(--brand-dark)}
.ins-cell .s{display:block;font-size:12.5px;color:var(--ink2);margin-top:2px}
.exp-open{background:var(--card);border:1px solid var(--line);border-radius:var(--r-card);
  padding:20px;margin:16px 0;box-shadow:var(--shadow-soft);scroll-margin-top:calc(var(--head-h) + 12px)}
.exp-open h2{margin:0 0 10px}
.exp-open h3{margin:18px 0 8px;font-family:'Plus Jakarta Sans','Anek Tamil',sans-serif;
  font-size:15px;font-weight:800;color:var(--ink)}
.exp-open p{margin:0 0 10px;font-size:15.5px;line-height:1.65;color:var(--ink)}
.exp-open .l-ta{margin-top:12px;padding-top:12px;border-top:1px dashed var(--line)}
.exp-open ul.why{margin:0;padding-left:20px}
.exp-open ul.why li{margin:0 0 7px;font-size:15px;line-height:1.6;color:var(--ink2)}
.exp-open ul.why b{color:var(--ink)}
.exp-open .exp-video{display:inline-block;margin-top:12px;font-weight:700;color:var(--brand-dark)}
.repeat{border:1px solid var(--brand);background:var(--brand-soft);border-radius:var(--r-card);
  padding:16px 18px;margin:16px 0}
.repeat .r-lab{margin:0 0 6px;font-family:'Plus Jakarta Sans','Anek Tamil',sans-serif;font-size:12px;
  font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--brand-dark)}
.repeat p{margin:0;font-size:14.5px;color:var(--ink);line-height:1.55}
.repeat .r-links{margin-top:10px;display:flex;flex-wrap:wrap;gap:8px}
.repeat .r-links a{background:var(--card);border:1px solid var(--line);border-radius:999px;
  padding:5px 12px;font-size:13.5px;font-weight:700;color:var(--brand-dark)}
.repeat .r-links a:hover{border-color:var(--brand);text-decoration:none}
.toc{background:var(--card);border:1px solid var(--line);border-radius:var(--r-card);
  padding:16px 18px;margin:18px 0}
.toc .lab{margin:0 0 10px;font-family:'Plus Jakarta Sans','Anek Tamil',sans-serif;font-size:11.5px;
  font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:var(--ink2)}
.toc ol{margin:0;padding:0;list-style:none;display:flex;flex-wrap:wrap;gap:8px 10px;
  counter-reset:toc}
.toc li{counter-increment:toc}
.toc a{display:inline-block;background:var(--canvas);border:1px solid var(--line);
  border-radius:999px;padding:7px 14px;font-size:13.5px;font-weight:600;color:var(--ink)}
.toc a::before{content:counter(toc) ". ";color:var(--brand);font-weight:700}
.toc a:hover{border-color:var(--brand);color:var(--brand-dark);text-decoration:none}

/* ── A named section of a question page ──────────────────────────────────── */
.sec-block{background:var(--card);border:1px solid var(--line);border-radius:var(--r-card);
  padding:20px;margin:16px 0;box-shadow:var(--shadow-soft);scroll-margin-top:calc(var(--head-h) + 12px)}
@media (min-width:640px){.sec-block{padding:24px 26px}}
.sec-block>h2{font-size:19px;margin:0 0 12px;line-height:1.35}
.answer-line{margin:0;font-size:17px;line-height:1.55}
.answer-line b{color:var(--correct-ink);background:var(--correct-soft);padding:2px 8px;
  border-radius:8px;font-weight:700}

/* ── Facts table ─────────────────────────────────────────────────────────── */
.facts{width:100%;border-collapse:collapse;font-size:14.5px}
.facts th,.facts td{text-align:left;padding:11px 2px;border-bottom:1px solid var(--line);
  vertical-align:top}
.facts tr:last-child th,.facts tr:last-child td{border-bottom:0}
.facts th{color:var(--ink2);font-weight:500;width:46%;font-family:inherit}
.facts td{color:var(--ink);font-weight:600}

/* ── FAQ inside a page (the standalone .faq section styles the hub's) ───── */
.faq-inline details{border:1px solid var(--line);border-radius:var(--r-field);margin:0 0 10px;
  overflow:hidden}
.faq-inline details:last-child{margin-bottom:0}
.faq-inline summary{cursor:pointer;padding:14px 16px;
  font-family:'Plus Jakarta Sans','Anek Tamil',sans-serif;font-size:15px;font-weight:700;
  color:var(--ink);list-style:none;display:flex;justify-content:space-between;gap:12px;
  align-items:flex-start}
.faq-inline summary::-webkit-details-marker{display:none}
.faq-inline summary::after{content:"+";color:var(--brand);font-size:19px;font-weight:700;
  flex:0 0 auto;line-height:1.2}
.faq-inline details[open] summary::after{content:"\\2212"}
.faq-inline details>div{padding:0 16px 14px;font-size:14.5px;color:var(--ink2);line-height:1.65}

/* ── Desktop floating CTA, the counterpart of the mobile sticky bar ──────── */
.deskcta{display:none}
@media (min-width:640px){
  .deskcta{display:inline-flex;position:fixed;right:20px;bottom:20px;z-index:35;
    box-shadow:0 14px 34px rgb(88 72 200 / .32)}
}
@media print{.deskcta{display:none}}

.tags{display:flex;flex-wrap:wrap;gap:7px;margin:18px 0 0;padding:0;list-style:none}
.tags li{font-size:12px;color:var(--ink2);background:var(--canvas);border:1px solid var(--line);
  padding:4px 11px;border-radius:999px}

/* ── Pager / prev-next ───────────────────────────────────────────────────── */
.pager{display:flex;gap:7px;flex-wrap:wrap;align-items:center;margin:22px 0;padding:0;list-style:none}
.pager a,.pager span{display:block;border:1px solid var(--line);background:var(--card);
  border-radius:12px;padding:9px 14px;font-size:14px;font-weight:600;color:var(--ink2);
  min-width:42px;text-align:center}
.pager a:hover{border-color:var(--brand);color:var(--brand);text-decoration:none}
.pager .cur{background:var(--brand);border-color:var(--brand);color:#fff}
.pager .gap{border:0;background:none;padding:9px 2px;min-width:0}
.nextprev{display:grid;gap:12px;grid-template-columns:1fr;margin:20px 0}
@media (min-width:640px){.nextprev{grid-template-columns:1fr 1fr}}
.nextprev a{background:var(--card);border:1px solid var(--line);border-radius:var(--r-field);
  padding:14px 16px;font-size:14.5px;color:var(--ink);line-height:1.45}
.nextprev a:hover{border-color:rgb(110 79 232 / .4);text-decoration:none}
.nextprev a i{display:block;font-style:normal;font-size:12px;font-weight:700;color:var(--brand);
  margin-bottom:4px;font-family:'Plus Jakarta Sans','Anek Tamil',sans-serif}

/* ── A sibling question shown whole ──────────────────────────────────────── */
ul.minis{list-style:none;margin:0;padding:0;display:grid;gap:16px}
.mini{border:1px solid var(--line);border-radius:var(--r-card);padding:18px;background:var(--card);
  box-shadow:var(--shadow-pill)}
@media (min-width:640px){.mini{padding:22px}}
/* Inside a question page's "More questions" the cards sit on the card already,
   so they step back to the canvas tint instead of stacking two whites. */
.sec-block .mini{background:var(--canvas);box-shadow:none;border-radius:var(--r-field);padding:16px}
.mini-q{font-family:'Plus Jakarta Sans','Anek Tamil',sans-serif;font-size:16px;font-weight:700;
  line-height:1.45;color:var(--ink)}
.mini-q{display:flex;gap:8px;align-items:baseline}
.mini-q .qn{flex:0 0 auto;color:var(--brand);font-variant-numeric:tabular-nums}
/* min-width:0 or a long unbroken stem pushes the number off the row. */
.mini-q .qt{flex:1 1 auto;min-width:0}
.mini-q .l-ta{font-weight:600;font-size:.95em;margin-top:6px;color:var(--ink2)}
/* The paper chip, above the stem — it is context for the question, so it has
   to be read before it, not found afterwards. */
.mini-src{margin:0 0 11px}
.mini-src a{display:inline-flex;align-items:center;gap:7px;padding:4px 11px 4px 9px;
  border-radius:999px;background:var(--brand-soft);color:var(--brand-dark);
  font-family:'Plus Jakarta Sans','Anek Tamil',sans-serif;font-size:12.5px;
  line-height:1.6;border:1px solid transparent}
.mini-src a:hover{border-color:rgb(110 79 232 / .4);text-decoration:none}
.mini-src .k{font-weight:600;opacity:.8}
.mini-src .v{font-weight:800;font-variant-numeric:tabular-nums}
.mini .stem-body{margin:12px 0 0}
.mini-opts{margin:12px 0 0}
.mini-opts li{padding:9px 12px;margin:0 0 6px;font-size:14.5px;background:var(--card);border-width:1px}
.mini-opts li .k{flex:0 0 24px;height:24px;font-size:12px;border-radius:7px}
.mini-opts li .v{font-size:14.5px}
.mini-opts li .v .l-ta{font-size:13.5px}
.mini-go{margin:12px 0 0;font-size:14px;font-weight:600}
.faq-inline summary h3,.faq summary h3{margin:0;font-size:inherit;font-weight:inherit;
  font-family:inherit;color:inherit;letter-spacing:inherit;display:inline}

section.rel{margin:28px 0}
section.rel h2{font-size:18px;margin:0 0 2px}

/* ── Promo panel ─────────────────────────────────────────────────────────── */
.promo{background:linear-gradient(135deg,var(--secondary) 0%,var(--brand-deep) 100%);
  color:#fff;border-radius:var(--r-hero);padding:26px;margin:28px 0;
  box-shadow:0 18px 40px rgb(88 72 200 / .22)}
.promo h2{margin:0 0 8px;font-size:21px;color:#fff;line-height:1.3}
.promo p{margin:0 0 18px;font-size:15px;opacity:.93;max-width:54ch;line-height:1.6}
.promo .btn{background:#fff;color:var(--brand-deep)}
.promo .btn:hover{background:#F4F1F9;filter:none}

/* ── Features, the answer-key pages' four cards ──────────────────────────── */
.features{border-top:1px solid var(--line);background:var(--card)}
.features .shell{padding-top:48px;padding-bottom:48px}
.features h2{text-align:center;font-size:clamp(20px,3vw,25px);margin:0}
.fgrid{display:grid;gap:16px;grid-template-columns:1fr;margin:30px 0 0;padding:0;list-style:none}
@media (min-width:640px){.fgrid{grid-template-columns:1fr 1fr}}
@media (min-width:1024px){.fgrid{grid-template-columns:repeat(4,1fr)}}
.fcard{background:var(--card);border:1px solid var(--line);border-radius:var(--r-card);
  padding:20px;box-shadow:var(--shadow-soft)}
.fcard .ico{width:44px;height:44px;border-radius:var(--r-tile);background:var(--brand-soft);
  display:grid;place-items:center;font-size:21px;margin-bottom:12px}
.fcard h3{font-size:16px;margin:0 0 5px}
.fcard p{font-size:14px;color:var(--ink2);margin:0;line-height:1.55}
.fcta{display:flex;justify-content:center;margin-top:30px}

/* ── FAQ ─────────────────────────────────────────────────────────────────── */
.faq{border-top:1px solid var(--line)}
.faq .shell{max-width:768px;padding-top:48px;padding-bottom:48px}
.faq h2{text-align:center;font-size:clamp(20px,3vw,25px);margin:0 0 24px}
.faq details{background:var(--card);border:1px solid var(--line);border-radius:var(--r-field);
  margin:0 0 12px;overflow:hidden}
.faq summary{cursor:pointer;padding:16px 18px;font-family:'Plus Jakarta Sans','Anek Tamil',sans-serif;
  font-size:15.5px;font-weight:700;color:var(--ink);list-style:none;display:flex;
  justify-content:space-between;gap:12px;align-items:flex-start}
.faq summary::-webkit-details-marker{display:none}
.faq summary::after{content:"+";color:var(--brand);font-size:20px;font-weight:700;flex:0 0 auto;line-height:1.2}
.faq details[open] summary::after{content:"\\2212"}
.faq details>div{padding:0 18px 16px;font-size:14.5px;color:var(--ink2);line-height:1.65}

/* ── Footer ──────────────────────────────────────────────────────────────── */
footer.site{border-top:1px solid var(--line);background:var(--card)}
footer.site .shell{padding-top:40px;padding-bottom:40px}
.foot-top{display:flex;flex-direction:column;gap:30px}
@media (min-width:640px){.foot-top{flex-direction:row;justify-content:space-between;align-items:flex-start}}
.foot-brand{max-width:26rem}
.foot-brand .row{display:flex;align-items:center;gap:10px}
.foot-brand img{height:32px;width:32px;object-fit:contain}
.foot-brand .nm{font-family:'Plus Jakarta Sans',sans-serif;font-size:14.5px;font-weight:800;color:var(--ink)}
.foot-brand .nm b{color:var(--brand)}
.foot-brand p{margin:12px 0 0;font-size:14px;color:var(--ink2);line-height:1.6}
.foot-follow p.lab{margin:0;font-family:'Plus Jakarta Sans','Anek Tamil',sans-serif;font-size:11.5px;
  font-weight:700;text-transform:uppercase;letter-spacing:.16em;color:var(--ink2)}
.socials{display:flex;gap:10px;margin-top:12px}
.socials a{width:38px;height:38px;border-radius:10px;border:1px solid var(--line);
  display:grid;place-items:center;color:var(--ink2);font-size:15px}
.socials a:hover{border-color:rgb(110 79 232 / .4);background:var(--brand-soft);
  color:var(--brand-dark);text-decoration:none}
.foot-links{margin:28px 0 0;padding:24px 0 0;border-top:1px solid var(--line);
  display:flex;flex-wrap:wrap;gap:8px 18px;font-size:13.5px}
.foot-links a{color:var(--ink2)}
.foot-note{margin:18px 0 0;font-size:12.5px;color:var(--ink2);line-height:1.6}

/* ── Sticky mobile bar, like the answer-key pages ────────────────────────── */
.stickybar{position:fixed;inset-inline:0;bottom:0;z-index:40;display:flex;gap:10px;
  border-top:1px solid var(--line);background:rgb(255 255 255 / .96);backdrop-filter:blur(8px);
  padding:11px 16px calc(11px + env(safe-area-inset-bottom))}
.stickybar .btn{flex:1;padding:13px 8px;font-size:13.5px}
@media (min-width:640px){.stickybar{display:none}}
@media (max-width:639px){body{padding-bottom:80px}}

.katex{font-size:1.03em}
@media print{.site-head,.stickybar,.promo,.features,.col-side,.faq{display:none}}
`

// ─── Page shell ──────────────────────────────────────────────────────────────

const KATEX_CSS = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css'
const FONTS =
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700;800' +
  '&family=Inter:wght@400;500;600&family=Noto+Sans+Tamil:wght@400;500;600' +
  '&family=Anek+Tamil:wght@600;700&display=swap'

/** Units the footer links to; build.mjs narrows it to what it actually wrote. */
let footerUnits = ALL_UNITS.filter((u) => u.key !== 'general-studies')
export function setFooterUnits(units) {
  footerUnits = units
}

/**
 * The language switch. Three states rather than a two-way toggle, because a
 * two-way toggle cannot say which language you are reading when the honest
 * answer is "both" — and "both" has to be the default so that a crawler, and
 * anyone with JavaScript off, still sees the Tamil question text. Each option
 * is written in its own language, since the person who most needs this control
 * is the one who cannot read the other half of it.
 */
const LANG_SWITCH = `<div class="langset" role="group" aria-label="Language / மொழி">
<button type="button" data-lang-set="">Both</button>
<button type="button" data-lang-set="en">English</button>
<button type="button" data-lang-set="ta" lang="ta" class="tamil">தமிழ்</button>
</div>`

/**
 * One script for both the header switch and the first-visit prompt.
 *
 * It reads and writes `tnpsc-landing-lang`, the SAME key
 * src/components/Landing/LandingLangPrompt.tsx uses, so a visitor who chose
 * Tamil on the answer-key page is not asked again here, and a choice made here
 * carries back. A second key records that the question has been put, so
 * choosing "both" — which the landing pages cannot express and therefore store
 * as nothing — does not make the prompt reappear on every page.
 *
 * It runs in <head> so the language is applied before first paint; the prompt
 * itself waits for the body. With JavaScript off, the prompt is never unhidden
 * and both languages stay on the page — which is also what a crawler sees.
 */
const LANG_SCRIPT = `<script>(function(){try{
var K='tnpsc-landing-lang',A='tnpsc-archive-lang-asked',d=document.documentElement;
var get=function(k){try{return localStorage.getItem(k)}catch(e){return null}};
var set=function(k,v){try{v==null?localStorage.removeItem(k):localStorage.setItem(k,v)}catch(e){}};
var s=get(K);
if(s==='en'||s==='ta')d.setAttribute('data-lang',s);
var close=function(){var m=document.getElementById('langask');if(m)m.hidden=true;
d.classList.remove('lang-asking')};
var apply=function(v){if(v){d.setAttribute('data-lang',v)}else{d.removeAttribute('data-lang')}
set(K,v||null);set(A,'1');close()};
document.addEventListener('click',function(e){
var b=e.target.closest&&e.target.closest('[data-lang-set]');if(!b)return;
e.preventDefault();apply(b.getAttribute('data-lang-set'));});
document.addEventListener('keydown',function(e){
if(e.key==='Escape'&&d.classList.contains('lang-asking'))apply('');});
var start=function(){
if(s==='en'||s==='ta')return;if(get(A)==='1')return;
var m=document.getElementById('langask');if(!m)return;
m.hidden=false;d.classList.add('lang-asking');};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
}catch(e){}})();</script>`

/**
 * Give a signed-in reader the explanation they signed in for.
 *
 * The page ships WITHOUT the explanation — that stays true: a crawler, and
 * anyone logged out, sees exactly what this file contains. A reader with a
 * session fetches the text and the page swaps the sign-up card for it, so the
 * account is worth something the moment it exists.
 *
 * It only asks the API when the parent-domain hint cookie says a session may
 * exist (HINT_COOKIE in server/src/routes/auth.ts), so anonymous readers cost
 * nothing and never touch the auth rate limiter.
 *
 * Everything goes in through textContent, never innerHTML. This is text from
 * an API being written into a page on the main domain; italics are not worth
 * an XSS. The cost is that LaTeX in an explanation shows as its source — rare
 * outside aptitude, and better than a hole.
 */
const UNLOCK_SCRIPT = `<script>(function(){try{
var P=document.getElementById('exp-locked');if(!P)return;
var ID=P.getAttribute('data-qid');if(!ID)return;
if(!/(^|; )tnpsc_has_session=1/.test(document.cookie))return;
var API=${JSON.stringify(APP_ORIGIN)};
function el(t,c,x){var e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e;}
function pair(k){var w=el('span','l-en',P.getAttribute('data-'+k)||'');
  var v=P.getAttribute('data-'+k+'-ta');var f=document.createDocumentFragment();f.appendChild(w);
  if(v){var t=el('span','l-ta tamil',v);t.lang='ta';f.appendChild(t);}return f;}
function paras(host,txt){String(txt).split(/\\n\\s*\\n/).forEach(function(p){
  p=p.replace(/\\s+/g,' ').trim();if(p)host.appendChild(el('p',null,p));});}
function show(d){
  if(!d||(!d.explanation&&!d.explanation_ta))return;
  var box=el('section','exp exp-open');box.id='explanation';
  var h=el('h2');h.appendChild(pair('h'));box.appendChild(h);
  if(d.explanation){var e=el('div','l-en');paras(e,d.explanation);box.appendChild(e);}
  if(d.explanation_ta){var t=el('div','l-ta tamil');t.lang='ta';paras(t,d.explanation_ta);box.appendChild(t);}
  var ww=d.why_wrong;
  if(ww&&typeof ww==='object'){
    var keys=Object.keys(ww).filter(function(k){return ww[k];}).sort();
    if(keys.length){
      var h3=el('h3');h3.appendChild(pair('wh'));box.appendChild(h3);
      var ul=el('ul','why');
      keys.forEach(function(k){var li=el('li');li.appendChild(el('b',null,'('+k+') '));
        li.appendChild(document.createTextNode(String(ww[k]).replace(/\\s+/g,' ').trim()));ul.appendChild(li);});
      box.appendChild(ul);
    }
  }
  if(d.explanation_video_url){
    var a=el('a','exp-video');a.appendChild(pair('vid'));
    a.href=d.explanation_video_url;a.rel='noopener';a.target='_blank';box.appendChild(a);
  }
  P.parentNode.replaceChild(box,P);
}
fetch(API+'/api/auth/refresh',{method:'POST',credentials:'include',
  headers:{'Content-Type':'application/json'},body:'{}'})
 .then(function(r){return r.ok?r.json():null;})
 .then(function(s){if(!s||!s.access_token)return null;
   return fetch(API+'/api/questions/archive-explanation?id='+encodeURIComponent(ID),
     {headers:{Authorization:'Bearer '+s.access_token}}).then(function(r){return r.ok?r.json():null;});})
 .then(show).catch(function(){});
}catch(e){}})();<\/script>`

/** The prompt's markup. Hidden until the script decides it is needed. */
const LANG_PROMPT = `<div class="langask" id="langask" hidden role="dialog" aria-modal="true" aria-labelledby="langask-title">
<div class="card">
<div class="brandrow"><img src="${BASE}/logo-mark.png" alt="" width="48" height="48">
<p>TNPSC <b>Mentors</b></p></div>
<h2 id="langask-title">
<span class="ta tamil" lang="ta">மொழியைத் தேர்ந்தெடுக்கவும்</span>
<span class="en">Select your language</span>
</h2>
<div class="opts">
<button type="button" class="ta-btn tamil" lang="ta" data-lang-set="ta">தமிழ்<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg></button>
<button type="button" class="en-btn" lang="en" data-lang-set="en">English<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg></button>
</div>
<button type="button" class="both" data-lang-set="">Show both · <span class="tamil" lang="ta">இரண்டையும் காட்டு</span></button>
</div>
</div>`

/** The four things the app does, worded as the answer-key pages word them. */
const FEATURES = [
  {
    icon: '⏱️',
    en: ['Mock Tests', 'Full-length timed tests that feel like the real exam hall.'],
    ta: ['மாதிரித் தேர்வுகள்', 'உண்மையான தேர்வு அறை போன்ற நேரக் கட்டுப்பாட்டுத் தேர்வுகள்.'],
  },
  {
    icon: '📋',
    en: ['Previous Year Questions', 'Group 1, 2 & 4 papers, with an explanation for every answer.'],
    ta: ['முந்தைய ஆண்டு வினாக்கள்', 'குரூப் 1, 2 & 4 — ஒவ்வொரு விடைக்கும் விளக்கத்துடன்.'],
  },
  {
    icon: '📰',
    en: ['Daily Current Affairs', 'A short test on the latest news every day.'],
    ta: ['தினசரி நடப்பு நிகழ்வுகள்', 'தினமும் ஒரு சிறிய தேர்வு.'],
  },
  {
    icon: '📚',
    en: ['Study Materials', 'Videos, infographics and PDFs picked by our team.'],
    ta: ['படிப்புப் பொருட்கள்', 'எங்கள் குழு தேர்ந்தெடுத்த Videos, Infographics, PDFs.'],
  },
]

function featuresSection() {
  return `<section class="features" id="app">
<div class="shell">
<h2>${both('Everything else is in the app', 'மற்ற அனைத்தும் App-ல் உள்ளது')}</h2>
<ul class="fgrid">
${FEATURES.map(
    (f) => `<li class="fcard">
<div class="ico" aria-hidden="true">${f.icon}</div>
<h3>${both(f.en[0], f.ta[0])}</h3>
<p>${both(f.en[1], f.ta[1])}</p>
</li>`,
  ).join('')}
</ul>
<div class="fcta"><a class="btn btn-brand btn-lg" href="${esc(APP_REGISTER)}">${one(
    'Create a free account',
    'இலவசக் கணக்கு தொடங்குங்க',
  )} →</a></div>
</div>
</section>`
}

function footer() {
  return `<footer class="site">
<div class="shell">
<div class="foot-top">
<div class="foot-brand">
<div class="row"><img src="${BASE}/logo-mark.png" alt="" width="32" height="32">
<span class="nm">TNPSC <b>Mentors</b></span></div>
<p>${both(
    'TNPSC Group 1, Group 2 / 2A and Group 4 preparation, in Tamil and English.',
    'TNPSC குரூப் 1, குரூப் 2 / 2A, குரூப் 4 தேர்வுப் பயிற்சி — தமிழிலும் ஆங்கிலத்திலும்.',
  )}</p>
</div>
<div class="foot-follow">
<p class="lab">${one('Follow us', 'எங்களைப் பின்தொடருங்க')}</p>
<div class="socials">
<a href="${YOUTUBE_URL}" target="_blank" rel="noopener" aria-label="YouTube" title="YouTube">▶</a>
<a href="${INSTAGRAM_URL}" target="_blank" rel="noopener" aria-label="Instagram" title="Instagram">◎</a>
<a href="${TELEGRAM_URL}" target="_blank" rel="noopener" aria-label="Telegram" title="Telegram">✈</a>
<a href="${FACEBOOK_URL}" target="_blank" rel="noopener" aria-label="Facebook" title="Facebook">f</a>
</div>
</div>
</div>
<nav class="foot-links" aria-label="Subjects">
<a href="${BASE}/">${one('All questions', 'அனைத்து வினாக்கள்')}</a>
<a href="${BASE}/past-papers/">${one('Past papers', 'முந்தைய வினாத்தாள்கள்')}</a>
${footerUnits.map((u) => `<a href="${BASE}/${u.key}/">${esc(u.en)}</a>`).join('')}
</nav>
<p class="foot-note">© 2026 ${esc(BRAND)} · ${both(
    'Questions and answers are reproduced from TNPSC’s published previous-year papers for study purposes. The explanations are ours.',
    'வினாக்களும் விடைகளும் TNPSC வெளியிட்ட முந்தைய ஆண்டு வினாத்தாள்களிலிருந்து படிப்பு நோக்கத்திற்காக எடுக்கப்பட்டவை. விளக்கங்கள் எங்களுடையவை.',
  )}</p>
</div>
</footer>`
}

/**
 * @param {object} o
 * @param {string} o.title       full <title>
 * @param {string} o.description meta description
 * @param {string} o.path        absolute path, e.g. '/questions/indian-polity/'
 * @param {string} o.body        the main column's HTML
 * @param {Array}  [o.crumbs]    [{name, path}] — last one is the current page
 * @param {Array}  [o.jsonLd]    extra JSON-LD objects
 * @param {Array}  [o.sidebar]   [{title, items:[{href,label,active}]}]
 * @param {string} [o.faq]       FAQ section HTML, placed after the features
 * @param {boolean}[o.math]      link KaTeX's stylesheet
 * @param {object} [o.sticky]    {href,label,labelTa} for the mobile bar's left button
 * @param {boolean}[o.noindex]
 * @param {string} [o.prev] @param {string} [o.next]
 */
export function page(o) {
  const url = ORIGIN + o.path
  const crumbs = o.crumbs ?? []
  const ld = []
  if (crumbs.length > 1) {
    ld.push({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: crumbs.map((c, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: c.name,
        item: ORIGIN + c.path,
      })),
    })
  }
  ld.push(...(o.jsonLd ?? []))

  const sidebar = (o.sidebar ?? [])
    .filter((b) => b.items?.length)
    .map(
      (b) => `<div class="sidebox">
<p>${b.title}</p>
<ul>${b.items
        .map(
          (it) =>
            `<li><a href="${esc(it.href)}"${it.active ? ' aria-current="page"' : ''}>` +
            `<span class="lbl">${it.label}</span>` +
            `<span class="go" aria-hidden="true">${it.count ?? (it.active ? '' : '→')}</span></a></li>`,
        )
        .join('')}</ul>
</div>`,
    )
    .join('')

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(o.title)}</title>
<meta name="description" content="${esc(o.description)}">
<link rel="canonical" href="${esc(url)}">
<meta name="robots" content="${o.noindex ? 'noindex,follow' : 'index,follow,max-snippet:-1,max-image-preview:large'}">
${o.prev ? `<link rel="prev" href="${esc(ORIGIN + o.prev)}">\n` : ''}${o.next ? `<link rel="next" href="${esc(ORIGIN + o.next)}">\n` : ''}<meta property="og:type" content="article">
<meta property="og:site_name" content="${esc(BRAND)}">
<meta property="og:title" content="${esc(plain(o.title, 95))}">
<meta property="og:description" content="${esc(plain(o.description, 200))}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:locale" content="en_IN">
<meta property="og:locale:alternate" content="ta_IN">
<meta property="og:image" content="${ORIGIN}${BASE}/social.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(BRAND)} — TNPSC previous year questions with answers">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#6E4FE8">
<link rel="icon" type="image/png" href="${BASE}/logo-mark.png">
<link rel="apple-touch-icon" href="${BASE}/logo-mark.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONTS}">
<link rel="stylesheet" href="${BASE}/archive.css">
${o.math ? `<link rel="stylesheet" href="${KATEX_CSS}" crossorigin="anonymous">\n` : ''}<script type="application/ld+json">${JSON.stringify(ld.length === 1 ? ld[0] : ld).replace(/</g, '\\u003c')}</script>
${LANG_SCRIPT}
</head>
<body id="top">
<header class="site-head"><div class="shell row">
<a class="brand" href="${BASE}/" aria-label="${esc(BRAND)}">
<img src="${BASE}/logo-mark.png" alt="" width="36" height="36">
<span class="nm">TNPSC <b>Mentors</b></span>
</a>
<nav class="mainnav" aria-label="Main">
<a href="${BASE}/">${one('Questions', 'வினாக்கள்')}</a>
<a href="${BASE}/past-papers/">${one('Past papers', 'வினாத்தாள்கள்')}</a>
<a href="/tnpsc-group-1-answer-key-2026">${one('Answer key', 'விடைக்குறிப்பு')}</a>
</nav>
<div class="head-actions">
${LANG_SWITCH}
<a class="btn btn-brand" href="${esc(APP_REGISTER)}">${one('Free account', 'இலவசக் கணக்கு')}</a>
</div>
</div></header>
${crumbs.length
      ? `<div class="shell crumbs">${crumbs
          .map((c, i) =>
            i === crumbs.length - 1
              ? `<span class="here" title="${esc(c.name)}">${esc(c.name)}</span>`
              : `<a href="${esc(c.path)}">${esc(c.name)}</a>`,
          )
          .join('')}</div>`
      : ''}
<main class="shell layout">
<div class="col-main">
${o.body}
</div>
${sidebar ? `<aside class="col-side">${sidebar}</aside>` : ''}
</main>
${featuresSection()}
${o.faq ?? ''}
${footer()}
${LANG_PROMPT}
<div class="stickybar">
<a class="btn btn-ghost" href="${esc(o.sticky?.href ?? `${BASE}/past-papers/`)}">${one(
    o.sticky?.label ?? 'Past papers',
    o.sticky?.labelTa ?? 'வினாத்தாள்கள்',
  )}</a>
<a class="btn btn-brand" href="${esc(APP_REGISTER)}">${one('Free account', 'இலவசக் கணக்கு')}</a>
</div>
<a class="btn btn-brand btn-lg deskcta" href="${esc(APP_REGISTER)}">${one(
    'Unlock all explanations — free',
    'எல்லா விளக்கங்களும் — இலவசம்',
  )}</a>
${o.body.includes('id="exp-locked"') ? UNLOCK_SCRIPT : ''}
</body>
</html>
`
}

// ─── One question, as an article ─────────────────────────────────────────────

const LETTERS = ['A', 'B', 'C', 'D', 'E']

/** The option letters a row actually has, in order. */
export function optionsOf(q) {
  return LETTERS.filter((L) => {
    const v = q[`option_${L.toLowerCase()}`]
    return v != null && String(v).trim() !== ''
  })
}

function optionImages(q) {
  const raw = q.option_images
  if (!raw || typeof raw !== 'object') return {}
  return raw
}

function figures(q) {
  const raw = q.images
  if (Array.isArray(raw)) return raw.filter((s) => typeof s === 'string' && s)
  return []
}

/**
 * The question itself. `heading` renders the stem as the page's <h1> on a
 * question page, and as a plain div when the article is one of several in a
 * list — a page must have exactly one h1 for the stem to read as its subject.
 */
/**
 * The question itself: stem, figures, options, and which one is right. The
 * explanation, the details table and the FAQ are separate sections with their
 * own headings, so each can be named in the contents box at the top of the
 * page and linked to directly from a search result.
 */
export function questionCard(q, { heading = true } = {}) {
  const letters = optionsOf(q)
  const correct = String(q.correct_answer ?? '').trim().toUpperCase()
  const optImgs = optionImages(q)
  const figs = figures(q)

  // A match table, a statement list or an assertion/reason pair cannot live
  // inside an <h1>, so the stem is split: the question sentence heads the page
  // and its structure follows as a sibling. See stemfmt.mjs.
  const fEn = stemHtml(q.question_text, mathText)
  const fTa = q.question_text_ta ? stemHtml(q.question_text_ta, mathText, 'ta') : null
  // Both languages live inside the one h1, so a visitor who switches to Tamil
  // still has a visible heading and the page still has exactly one.
  const stemInner =
    en(fEn.lead || mathText(plain(q.question_text, 140))) + (fTa ? ta(fTa.lead) : '')
  const stem = heading ? `<h1>${stemInner}</h1>` : `<div class="stem">${stemInner}</div>`
  const structure =
    fEn.body || fTa?.body
      ? `<div class="stem-body">${fEn.body ? enBlock(fEn.body) : ''}${
          fTa?.body ? taBlock(fTa.body) : ''
        }</div>`
      : ''

  const figLabel = plain(q.question_text, 110)
  const figsHtml = figs.length
    ? `<div class="figs">${figs
        .map(
          (src, i) =>
            `<img src="${esc(src)}" alt="${esc(
              figs.length > 1 ? `Figure ${i + 1} — ${figLabel}` : figLabel,
            )}" loading="lazy" decoding="async">`,
        )
        .join('')}</div>`
    : ''

  const opts = letters
    .map((L) => {
      const e = q[`option_${L.toLowerCase()}`]
      const t = q[`option_${L.toLowerCase()}_ta`]
      const img = optImgs[L] ?? optImgs[L.toLowerCase()]
      const isOk = L === correct
      return `<li class="${isOk ? 'ok' : ''}">
<span class="k" aria-hidden="true">${L}</span>
<span class="v">${en(mathText(e))}${t ? ta(mathText(t)) : ''}${
        img ? `<img class="opt-img" src="${esc(img)}" alt="Option ${L}" loading="lazy" decoding="async">` : ''
      }</span>
${isOk ? '<span class="tick" aria-label="Correct answer">✓</span>' : ''}
</li>`
    })
    .join('')

  const correctText = plain(q[`option_${correct.toLowerCase()}`] ?? '')
  const correctTextTa = plain(q[`option_${correct.toLowerCase()}_ta`] ?? '')
  const verdict = correct
    ? `<div class="verdict">
<span class="big" aria-hidden="true">${esc(correct)}</span>
<span>
<span class="lab">${one('Correct answer', 'சரியான விடை')}</span>
<span class="val">${
        correctText
          ? en(esc(plain(correctText, 160))) + (correctTextTa ? ta(esc(plain(correctTextTa, 160))) : '')
          : esc(correct)
      }</span>
</span>
</div>`
    : ''

  return `<article class="q">
${stem}
${structure}
${figsHtml}
<ol class="opts">
${opts}
</ol>
${verdict}
</article>`
}

/**
 * A contents box, the way every page that wants jump-links in a search result
 * has one. It only earns its place when the page really is several sections
 * long, which is why the question page was broken into named parts first
 * rather than given a box listing one thing.
 */
export function toc(items) {
  if (items.length < 3) return ''
  return `<nav class="toc" aria-label="On this page">
<p class="lab">${one('On this page', 'இந்தப் பக்கத்தில்')}</p>
<ol>${items.map((i) => `<li><a href="#${esc(i.id)}">${i.label}</a></li>`).join('')}</ol>
</nav>`
}

/**
 * What this question is, and how much it matters.
 *
 * Each fact is a link to the page that proves it, so "asked 28 times" is not a
 * number a student has to take on faith — it opens the 28 questions.
 *
 * The counts are of THIS archive (24 previous-year papers), never of "TNPSC
 * exams" in general, because that is all we can count. The wording says so.
 *
 * @param {object} o
 * @param {{name:string, nameTa?:string, path:string, count:number, marks?:number|null}} o.unit
 * @param {{name:string, path:string, count:number}} [o.topic] only when the
 *   label is a real syllabus topic — most 'topic' values in the GS banks are
 *   the subject name repeated, and are passed as undefined.
 * @param {{label:string, year:number, path:string}} [o.paper]
 * @param {number} o.papers how many papers the archive covers
 */
export function insightStrip({ unit, topic, paper, papers }) {
  // The headline number is the topic's where we have one, because that is the
  // specific, actionable fact; the subject's otherwise.
  const hero = topic ?? unit
  const heroIsTopic = !!topic

  const cells = []
  cells.push(
    `<a class="ins-cell" href="${esc(unit.path)}">
<span class="k">${one('Subject', 'பாடம்')}</span>
<span class="v">${esc(unit.name)}</span>
<span class="s">${
      unit.marks
        ? one(`${unit.marks} of 200 marks in Group 1 prelims`, `குரூப் 1 முதல்நிலையில் ${unit.marks} மதிப்பெண்`)
        : one(`${n(unit.count)} questions here`, `${n(unit.count)} வினாக்கள்`)
    }</span>
</a>`,
  )

  if (topic) {
    cells.push(
      `<a class="ins-cell" href="${esc(topic.path)}">
<span class="k">${one('Topic', 'தலைப்பு')}</span>
<span class="v">${esc(topic.name)}</span>
<span class="s">${one('in the syllabus', 'பாடத்திட்டத்தில்')}</span>
</a>`,
    )
  }

  if (paper) {
    cells.push(
      `<a class="ins-cell" href="${esc(paper.path)}">
<span class="k">${one('Asked in', 'கேட்கப்பட்டது')}</span>
<span class="v">${esc(paper.label)} ${esc(String(paper.year))}</span>
<span class="s">${one('see the whole paper', 'முழு வினாத்தாளும்')}</span>
</a>`,
    )
  }

  return `<section class="insight" aria-label="${esc(one('About this question', 'இந்த வினா பற்றி'))}">
<a class="ins-hero" href="${esc(hero.path)}">
<span class="num">${n(hero.count)}<span class="x">×</span></span>
<span class="txt">
<b>${esc(hero.name)}</b>
${en(
    `asked <b>${n(hero.count)} times</b> across the ${n(papers)} Group 1, 2 and 4 papers on this site`,
  )}${ta(
    `இந்தத் தளத்தின் ${n(papers)} வினாத்தாள்களில் <b>${n(hero.count)} முறை</b> கேட்கப்பட்டுள்ளது`,
  )}
<span class="go">${one(
    heroIsTopic ? 'See all of them' : 'See all of them',
    'அனைத்தையும் பார்க்க',
  )} →</span>
</span>
</a>
<div class="ins-cells">${cells.join('')}</div>
</section>`
}

/**
 * "This exact question has come before."
 *
 * Only ~1.6% of the archive is a genuine cross-paper repeat, so this is absent
 * from almost every page — which is the point. When it IS there it is the
 * strongest possible signal that a question is worth memorising, and it would
 * be worthless if every page claimed it.
 */
export function repeatNotice(siblings, self) {
  const others = siblings.filter((q) => q.id !== self.id && q._paper)
  if (!others.length) return ''
  const seen = new Set()
  const links = others
    .filter((q) => {
      const k = q._paper.path
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
    .map((q) => `<a href="${esc(q._path)}">${esc(q._paper.label)} ${esc(String(q._paper.year))}</a>`)
  if (!links.length) return ''
  return `<section class="repeat">
<p class="r-lab"><span aria-hidden="true">⟳</span> ${one('Asked more than once', 'ஒன்றுக்கு மேற்பட்ட முறை')}</p>
<p>${en(
    `This question has also been asked in ${links.length === 1 ? 'another paper' : `${n(links.length)} other papers`}. That makes it one to know.`,
  )}${ta('இதே வினா வேறு வினாத்தாள்களிலும் கேட்கப்பட்டுள்ளது. இது முக்கியமானது.')}</p>
<p class="r-links">${links.join('')}</p>
</section>`
}

/**
 * The answer, spelled out as a sentence.
 *
 * The options list already marks it, but a list is not a sentence, and
 * "what is the answer to <question>" is the query this page has to win. So the
 * answer also exists as prose under a heading that asks the question back —
 * the shape that matches how people type it.
 */
export function answerSection(q) {
  const correct = String(q.correct_answer ?? '').trim().toUpperCase()
  if (!correct) return ''
  const text = plain(q[`option_${correct.toLowerCase()}`] ?? '')
  const textTa = plain(q[`option_${correct.toLowerCase()}_ta`] ?? '')
  return `<section class="sec-block" id="answer">
<h2>${one('What is the correct answer?', 'சரியான விடை என்ன?')}</h2>
<p class="answer-line">${en(
    `The correct answer is <b>(${esc(correct)})${text ? ` ${esc(text)}` : ''}</b>.`,
  )}${
    textTa
      ? ta(`சரியான விடை <b>(${esc(correct)}) ${esc(textTa)}</b>.`)
      : ta(`சரியான விடை <b>(${esc(correct)})</b>.`)
  }</p>
</section>`
}

/** The explanation, under a heading that asks why rather than announcing a noun. */
export function explanationSection(q, { gate = true } = {}) {
  const letters = optionsOf(q)
  const correct = String(q.correct_answer ?? '').trim().toUpperCase()
  const inner = gate ? lockedExplanation(q, correct, letters) : openExplanation(q, correct, letters)
  if (!inner) return ''
  return `<section class="sec-block" id="explanation">
<h2>${one(`Why is (${correct}) the correct answer?`, `(${correct}) ஏன் சரியான விடை?`)}</h2>
${inner}
</section>`
}

/**
 * The facts about this question as a table — exam, year, subject, difficulty.
 * A visitor wants to know whether this is their paper before they read on, and
 * a table says it faster than a sentence.
 */
export function detailsSection(q, { paper, unit, topic } = {}) {
  const rows = []
  if (paper) rows.push([['Exam', 'தேர்வு'], `TNPSC ${esc(paper.label)}`])
  if (q.year) rows.push([['Year asked', 'கேட்கப்பட்ட ஆண்டு'], String(q.year)])
  if (unit) rows.push([['Subject', 'பாடம்'], esc(unit.en)])
  if (topic) rows.push([['Topic', 'பிரிவு'], esc(topic)])
  if (q.question_type) rows.push([['Question type', 'வினா வகை'], esc(plain(q.question_type))])
  if (q.difficulty) rows.push([['Difficulty', 'கடினத்தன்மை'], esc(plain(q.difficulty))])
  rows.push([
    ['Languages', 'மொழிகள்'],
    q.question_text_ta ? 'Tamil &amp; English' : 'English',
  ])
  if (unit?.weight) {
    rows.push([
      ['Weight in Group 1 2026 prelims', 'குரூப் 1 2026 மதிப்பெண்'],
      `${unit.weight} of 200 questions`,
    ])
  }
  if (!rows.length) return ''
  return `<section class="sec-block" id="details">
<h2>${one('About this question', 'இந்த வினா பற்றி')}</h2>
<table class="facts"><tbody>
${rows.map(([k, v]) => `<tr><th>${one(k[0], k[1])}</th><td>${v}</td></tr>`).join('')}
</tbody></table>
</section>`
}

/**
 * One more question, whole: its stem in both languages, its options, and which
 * one is right — not a truncated link to it.
 *
 * The pages that win this kind of search carry several complete questions, not
 * one question and a list of links. A reader who got their answer at the top of
 * the page will read two or three more if they are actually there.
 *
 * THREE of them, not the six the link list used to carry, and that number is a
 * judgement rather than a layout choice. Every sibling shown here also has a
 * page of its own, so its wording now appears in more than one place; the more
 * pages it is repeated across, the likelier Google is to rank a sibling's page
 * for a query that belongs to this one. Three keeps the page substantial while
 * leaving the primary question unmistakable — it alone holds the <h1>, the
 * title, the meta description and the Quiz markup.
 */
export function miniQuestion(q, { num, source } = {}) {
  const letters = optionsOf(q)
  const correct = String(q.correct_answer ?? '').trim().toUpperCase()
  const f = stemHtml(q.question_text, mathText)
  const fTa = q.question_text_ta ? stemHtml(q.question_text_ta, mathText, 'ta') : null

  const opts = letters
    .map((L) => {
      const e = q[`option_${L.toLowerCase()}`]
      const t = q[`option_${L.toLowerCase()}_ta`]
      const isOk = L === correct
      return `<li class="${isOk ? 'ok' : ''}"><span class="k" aria-hidden="true">${L}</span>` +
        `<span class="v">${en(mathText(e))}${t ? ta(mathText(t)) : ''}</span>` +
        `${isOk ? '<span class="tick" aria-label="Correct answer">✓</span>' : ''}</li>`
    })
    .join('')

  const structure =
    f.body || fTa?.body
      ? `<div class="stem-body">${f.body ? enBlock(f.body) : ''}${fTa?.body ? taBlock(fTa.body) : ''}</div>`
      : ''

  // Which exam, which year. A paper page does not need this — the page IS
  // the answer — but a subject page, a topic page and the siblings under a
  // question all mix papers freely, and there "where is this from" is the first
  // thing a reader wants about a question they did not choose: a 2013 Group 4
  // question and a 2026 Group 1 one are worth very different amounts of their
  // afternoon. The chip is the link to the paper, so the claim is checkable in
  // one tap rather than asserted.
  const src =
    source && q._paper
      ? `<p class="mini-src"><a href="${esc(q._paper.path)}">` +
        `<span class="k">${one('Asked in', 'கேட்கப்பட்டது')}</span>` +
        `<span class="v">${one(
          `TNPSC ${q._paper.label} · ${q._paper.year}`,
          `TNPSC ${q._paper.labelTa ?? q._paper.label} · ${q._paper.year}`,
        )}</span></a></p>`
      : ''

  return `<li class="mini">
${src}<div class="mini-q">${num ? `<span class="qn">${esc(String(num))}.</span>` : ''}<span class="qt">${en(
    f.lead,
  )}${fTa ? ta(fTa.lead) : ''}</span></div>
${structure}
<ol class="opts mini-opts">${opts}</ol>
<p class="mini-go"><a href="${esc(q._path)}">${one(
    'See the full explanation',
    'முழு விளக்கத்தைப் பாருங்க',
  )} →</a></p>
</li>`
}

/**
 * A short FAQ built from this question's own facts.
 *
 * Every answer here is derived from the row — the keyed answer, the paper, the
 * year — so no two pages carry the same words and nothing is invented. That is
 * the difference between this and the FAQ boilerplate that content farms paste
 * onto every page: it is unique text that happens to be shaped like the
 * questions people actually type.
 *
 * It carries FAQPage markup. Be honest about what that buys: since August 2023
 * Google shows FAQ rich results only for government and health sites, so this
 * will not draw a rich result. It is here because the on-page text matches real
 * queries, which is the part that still works.
 */
export function questionFaq(q, { paper, unit } = {}) {
  const correct = String(q.correct_answer ?? '').trim().toUpperCase()
  const answerText = plain(q[`option_${correct.toLowerCase()}`] ?? '')
  const stem = plain(q.question_text, 120)
  const items = []

  if (correct) {
    items.push({
      q: `What is the answer to "${stem}"?`,
      qTa: 'இந்த வினாவின் சரியான விடை என்ன?',
      a: `The correct answer is <b>(${esc(correct)})${answerText ? ` ${esc(answerText)}` : ''}</b>.`,
      aTa: `சரியான விடை <b>(${esc(correct)})</b>.`,
    })
  }
  if (paper) {
    items.push({
      q: 'Which exam was this question asked in?',
      qTa: 'இந்த வினா எந்தத் தேர்வில் கேட்கப்பட்டது?',
      a: `It was asked in the <a href="${esc(paper.path)}">TNPSC ${esc(paper.label)} ${paper.year}</a> paper. ` +
        `Every question from that paper is on this site, with its answer.`,
      aTa: `<a href="${esc(paper.path)}">TNPSC ${esc(paper.label)} ${paper.year}</a> வினாத்தாளில். ` +
        `அந்த வினாத்தாளின் ஒவ்வொரு வினாவும் விடையுடன் இங்கே உள்ளது.`,
    })
  }
  if (unit) {
    items.push({
      q: `Which subject does this question belong to?`,
      qTa: 'இந்த வினா எந்தப் பாடத்தைச் சேர்ந்தது?',
      a:
        `<a href="${esc(unit.path)}">${esc(unit.en)}</a>` +
        (unit.weight
          ? ` — which carries ${unit.weight} of the 200 questions in the TNPSC Group 1 2026 preliminary paper.`
          : '.'),
      aTa:
        `<a href="${esc(unit.path)}">${esc(unit.ta)}</a>` +
        (unit.weight ? ` — குரூப் 1 2026 முதல்நிலைத் தேர்வின் 200 வினாக்களில் ${unit.weight}.` : '.'),
    })
  }
  items.push({
    q: 'Where can I see why this answer is correct?',
    qTa: 'இந்த விடை ஏன் சரி என்று எங்கே பார்ப்பது?',
    a:
      `Create a free ${BRAND} account. The full explanation then shows on this question and on every other ` +
      `previous-year question, in Tamil and English, including why each wrong option is wrong.`,
    aTa:
      `இலவச ${BRAND} கணக்கு தொடங்குங்க. அதன் பிறகு இந்த வினாவுக்கும் மற்ற எல்லா முந்தைய ஆண்டு ` +
      `வினாக்களுக்கும் தமிழிலும் ஆங்கிலத்திலும் முழு விளக்கம் தெரியும்.`,
  })

  return {
    html: `<section class="sec-block faq-inline" id="faq">
<h2>${one('Frequently asked questions', 'அடிக்கடி கேட்கப்படும் கேள்விகள்')}</h2>
${items
      .map(
        (f) => `<details>
<summary><h3>${en(esc(f.q))}${ta(esc(f.qTa))}</h3></summary>
<div>${en(f.a)}${ta(f.aTa)}</div>
</details>`,
      )
      .join('')}
</section>`,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: items.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: plain(f.a.replace(/<[^>]+>/g, ' ')) },
      })),
    },
  }
}

/** The explanation in full. Only reachable with the gate deliberately off. */
function openExplanation(q, correct, letters) {
  const ww = q.why_wrong && typeof q.why_wrong === 'object' ? q.why_wrong : null
  const whyHtml = ww
    ? (() => {
        const items = letters
          .filter((L) => L !== correct && ww[L])
          .map((L) => `<li><b>${esc(L)}</b> — ${mathText(ww[L])}</li>`)
        return items.length ? `<ul class="why">${items.join('')}</ul>` : ''
      })()
    : ''
  const expEn = prose(q.explanation)
  const expTa = q.explanation_ta ? `<div class="exp-ta" lang="ta">${prose(q.explanation_ta)}</div>` : ''
  if (!expEn && !expTa && !whyHtml) return ''
  return `<section class="exp">${expEn}${whyHtml}${expTa}</section>`
}

/**
 * The explanation, locked.
 *
 * The question and its correct answer are TNPSC's own published material and go
 * out in full. The explanation is ours, and it is what a subscription buys, so
 * this is the trade: the answer for free, the reasoning for a sign-up.
 *
 * Note what this does NOT do. It does not write the explanation into the page
 * and hide it with CSS. A blur over real text is undone by View Source, by
 * Reader mode, or by any of the dozen extensions that strip filters — the paid
 * asset would be a right-click away, and serving a crawler text that a visitor
 * cannot read is exactly the cloaking Google penalises. The bars below are
 * decorative; the sentences they stand in for are not in the HTML at all.
 *
 * What IS said is true and comes from metadata rather than content: how many
 * wrong options we can account for, and whether a Tamil version exists. That is
 * an honest advertisement for what is behind the door.
 */
function lockedExplanation(q, correct, letters) {
  const ww = q.why_wrong && typeof q.why_wrong === 'object' ? q.why_wrong : null
  const wrongCount = ww ? letters.filter((L) => L !== correct && ww[L]).length : 0
  const hasEn = !!plain(q.explanation)
  const hasTa = !!plain(q.explanation_ta)
  // Nothing to withhold means nothing to advertise — don't promise a page we
  // cannot deliver once they have signed up.
  if (!hasEn && !hasTa && !wrongCount) return ''

  const perks = []
  if (hasEn) {
    perks.push([
      `Why <b>${esc(correct)}</b> is right, explained step by step`,
      `<b>${esc(correct)}</b> ஏன் சரி என்பதற்கான முழு விளக்கம்`,
    ])
  }
  if (wrongCount) {
    perks.push([
      `Why ${wrongCount === 1 ? 'the other option is' : `each of the other ${wrongCount} options is`} wrong`,
      `மற்ற ${wrongCount} விடைகள் ஏன் தவறு என்பதும்`,
    ])
  }
  if (hasTa) perks.push(['The same explanation in Tamil', 'அதே விளக்கம் தமிழிலும்'])
  perks.push([
    'This question as part of a timed mock test',
    'இந்த வினா உள்ளிட்ட நேரக் கட்டுப்பாட்டுத் தேர்வு',
  ])

  return `<section class="exp" id="exp-locked" data-qid="${esc(String(q.id))}"
 data-h="Explanation" data-h-ta="விளக்கம்"
 data-wh="Why the other options are wrong" data-wh-ta="மற்ற விடைகள் ஏன் தவறு"
 data-vid="Watch the video explanation" data-vid-ta="வீடியோ விளக்கம்">
<div class="blurred" aria-hidden="true"><span></span><span></span><span></span><span></span></div>
<div class="unlock">
<p class="ask">${en(
    `Why is <b>${esc(correct)}</b> the answer? Sign in free to read the full explanation.`,
  )}${ta(`<b>${esc(correct)}</b> ஏன் சரியான விடை? முழு விளக்கத்தைப் படிக்க இலவசமாக உள்நுழையுங்க.`)}</p>
<ul>
${perks.map((p) => `<li>${en(p[0])}${ta(p[1])}</li>`).join('')}
</ul>
<a class="btn btn-brand btn-lg" href="${esc(authUrl(APP_REGISTER, q._path))}">${one(
    'Create a free account',
    'இலவசக் கணக்கு தொடங்குங்க',
  )}</a>
<p class="alt">${en(
    `Already have an account? <a href="${esc(authUrl(APP_LOGIN, q._path))}">Log in</a> — explanations are free on every previous-year question.`,
  )}${ta(
    `ஏற்கனவே கணக்கு உள்ளதா? <a href="${esc(authUrl(APP_LOGIN, q._path))}">உள்நுழையுங்க</a> — எல்லா முந்தைய ஆண்டு வினாக்களுக்கும் விளக்கம் இலவசம்.`,
  )}</p>
</div>
</section>`
}

function tagList(q) {
  const tags = []
  if (q.subject) tags.push(q.subject)
  if (q.topic) tags.push(q.topic)
  if (q.aptitude_topic) tags.push(q.aptitude_topic)
  if (q.year) tags.push(`TNPSC ${q.year}`)
  if (q.difficulty) tags.push(`${q.difficulty} difficulty`)
  if (!tags.length) return ''
  return `<ul class="tags">${tags.map((t) => `<li>${esc(plain(t))}</li>`).join('')}</ul>`
}

/**
 * schema.org for one question. `Question` with an `acceptedAnswer` and the
 * distractors as `suggestedAnswer` is the shape Google documents for quiz
 * content, and it is what makes a result show the answer under the title.
 */
export function questionJsonLd(q, url) {
  const letters = optionsOf(q)
  const correct = String(q.correct_answer ?? '').trim().toUpperCase()
  const body = plain(q.question_text)
  const answerText = plain(q[`option_${correct.toLowerCase()}`] ?? '')
  const answerTextTa = plain(q[`option_${correct.toLowerCase()}_ta`] ?? '')

  const suggested = letters
    .filter((L) => L !== correct)
    .map((L) => ({ '@type': 'Answer', text: plain(q[`option_${L.toLowerCase()}`] ?? '') }))
    .filter((a) => a.text)

  const bodyTa = plain(q.question_text_ta ?? '')

  /**
   * Language-tagged values, so the Tamil wording is in the structured data and
   * not only in the body text.
   *
   * A student who meets this question on paper meets it in Tamil as often as in
   * English, and a Google Lens scan of a Tamil paper becomes a search for the
   * Tamil wording. The <title> can only be one language without becoming too
   * long to show, so it stays English; this is where the other half goes.
   */
  const langValues = (e, t) =>
    t ? [{ '@value': e, '@language': 'en' }, { '@value': t, '@language': 'ta' }] : e

  const question = {
    '@type': 'Question',
    '@id': url + '#question',
    name: langValues(plain(body, 110), bodyTa ? plain(bodyTa, 110) : null),
    text: langValues(body, bodyTa || null),
    ...(bodyTa ? { alternateName: bodyTa } : {}),
    inLanguage: bodyTa ? ['en', 'ta'] : 'en',
    answerCount: 1,
    // No `comment` here on purpose. The explanation is behind a sign-in, and
    // structured data must describe what the page actually shows — claiming
    // text a visitor cannot see is what gets markup ignored or penalised.
    acceptedAnswer: {
      '@type': 'Answer',
      text: langValues(
        answerText ? `${correct}. ${answerText}` : correct,
        answerTextTa ? `${correct}. ${answerTextTa}` : null,
      ),
    },
    ...(suggested.length ? { suggestedAnswer: suggested } : {}),
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'Quiz',
    '@id': url + '#quiz',
    url,
    name: plain(body, 110),
    educationalLevel: 'TNPSC Group 1 Preliminary 2026',
    about: { '@type': 'Thing', name: plain(q.subject ?? 'TNPSC General Studies') },
    publisher: { '@type': 'Organization', name: BRAND, url: ORIGIN },
    hasPart: question,
  }
}

/**
 * A plain-language FAQ plus its FAQPage markup, which can win a result of its
 * own. Answers are deliberately short: the person reading them has just landed
 * from a search and wants to know whether this page is worth their time.
 */
export function faqSection(items) {
  return {
    html: `<section class="faq" id="faq">
<div class="shell">
<h2>${both('Common questions', 'அடிக்கடி கேட்கப்படும் கேள்விகள்')}</h2>
${items
      .map(
        (f) => `<details>
<summary><h3>${en(esc(f.q))}${ta(esc(f.qTa))}</h3></summary>
<div>${en(f.a)}${ta(f.aTa)}</div>
</details>`,
      )
      .join('')}
</div>
</section>`,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: items.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: plain(f.a.replace(/<[^>]+>/g, ' ')) },
      })),
    },
  }
}

/** The signup pitch that closes a listing page. */
export function promo({
  heading = 'Every explanation, free with an account',
  headingTa = 'ஒவ்வொரு விளக்கமும், இலவசக் கணக்கில்',
  text = 'The answers on this page are free to read. The reasoning behind them is in the app — a full explanation on every previous-year question, in Tamil and English, with why each wrong option is wrong. The same account turns these papers into timed mock tests. No card needed.',
  textTa = 'இந்தப் பக்கத்தின் விடைகள் இலவசம். அவற்றின் காரணங்கள் App-ல் உள்ளன — ஒவ்வொரு முந்தைய ஆண்டு வினாவுக்கும் தமிழிலும் ஆங்கிலத்திலும் முழு விளக்கம், தவறான விடைகள் ஏன் தவறு என்பதுடன். அதே கணக்கில் இந்த வினாத்தாள்களை நேரக் கட்டுப்பாட்டுத் தேர்வாக எழுதலாம். Card தேவையில்லை.',
  cta = 'Create a free account',
  ctaTa = 'இலவசக் கணக்கு தொடங்குங்க',
  href = APP_REGISTER,
} = {}) {
  return `<section class="promo">
<h2>${both(heading, headingTa)}</h2>
<p>${both(text, textTa)}</p>
<a class="btn btn-lg" href="${esc(href)}">${one(cta, ctaTa)} →</a>
</section>`
}

/** A numbered pager that stays short on a 400-page topic. */
export function pager(pageNo, pages, hrefFor) {
  if (pages <= 1) return ''
  const want = new Set([1, 2, pages - 1, pages, pageNo - 1, pageNo, pageNo + 1])
  const shown = [...want].filter((x) => x >= 1 && x <= pages).sort((a, b) => a - b)
  const out = []
  let last = 0
  for (const x of shown) {
    if (x - last > 1) out.push('<li class="gap" aria-hidden="true">…</li>')
    out.push(
      x === pageNo
        ? `<li><span class="cur" aria-current="page">${x}</span></li>`
        : `<li><a href="${esc(hrefFor(x))}">${x}</a></li>`,
    )
    last = x
  }
  return `<nav aria-label="Pages"><ol class="pager">${out.join('')}</ol></nav>`
}

export function n(x) {
  return Number(x).toLocaleString('en-IN')
}
