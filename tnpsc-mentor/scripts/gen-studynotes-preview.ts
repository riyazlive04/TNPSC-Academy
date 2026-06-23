/**
 * Dev preview: render the bilingual study notes as paginated A4 sheets
 * (timeline rail with year badges + numbered colour cards + "TNPSC Mentors"
 * watermark) so you can eyeball "that format" and Print → Save as PDF without
 * running the whole app / superadmin console.
 *
 * Each topic starts on a fresh A4 page; overflow flows onto more A4 pages with a
 * slim running header. Pagination is done client-side after fonts load.
 *
 * Run:  node --experimental-strip-types scripts/gen-studynotes-preview.ts
 * Out:  studynotes-preview.html  (double-click to open in a browser)
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { STUDY_NOTES } from '../src/lib/studyNotesData.ts'
import type { NoteEntry, StudyNote } from '../src/lib/studyNotesPdf.ts'

const HERE = dirname(fileURLToPath(import.meta.url))

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const br = (s: string) => esc(s).replace(/\n/g, '<br/>')

/** Card colours cycled for the numbered "list" layout (like the source cards). */
const CARD_TINTS = ['#FFF4D6', '#FFE0DC', '#DCEBFF', '#DDF3E4', '#F3E0FF', '#FFE9D2']

// Public-domain portraits/stamps (Wikimedia Commons), base64-embedded so the
// output is self-contained and CORS-free.
const IMAGES: Record<string, string> = JSON.parse(
  readFileSync(resolve(HERE, 'assets/images.json'), 'utf8')
)
/** Hero image per topic id (shown in the cover band). */
const HERO: Record<string, string> = {
  'modern-history-1917-1947': IMAGES.gandhi,
  'jyotiba-phule': IMAGES.phule,
  'rettaimalai-srinivasan': IMAGES.rettamalai,
  'justice-party-history': IMAGES.theagaraya,
  'justice-party-achievements': IMAGES.muthulakshmi,
}

// One image key per entry, in entry order (Wikimedia, public domain).
const IMG_BY_TOPIC: Record<string, string[]> = {
  'modern-history-1917-1947': [
    'gandhi', 'champaran', 'kheda', 'rowlatt', 'jallianwala', 'mohammadali', 'gandhi',
    'chittaranjan', 'simon', 'motilal', 'purnaswaraj', 'saltmarch', 'gandhi', 'ambedkar',
    'jinnah', 'linlithgow', 'cripps', 'quitindia', 'pethick', 'mountbatten',
  ],
  'jyotiba-phule': [
    'phule', 'phule', 'savitribai', 'satyashodhak', 'phule', 'phule', 'savitribai', 'phule', 'phule',
  ],
  'rettaimalai-srinivasan': [
    'rettamalai', 'rettamalai', 'rettamalai', 'gandhi', 'rettamalai', 'theagaraya', 'ambedkar', 'rettamalai',
  ],
  'justice-party-history': [
    'theagaraya', 'theagaraya', 'theagaraya', 'theagaraya', 'theagaraya', 'theagaraya',
    'theagaraya', 'theagaraya', 'rajaji', 'annadurai',
  ],
  'justice-party-achievements': [
    'theagaraya', 'theagaraya', 'muthulakshmi', 'theagaraya', 'theagaraya', 'muthulakshmi',
    'annamalai', 'muthulakshmi', 'theagaraya',
  ],
}
/** Resolve the image for entry i of a topic (falls back to the topic hero). */
const entryImage = (id: string, i: number): string =>
  IMAGES[IMG_BY_TOPIC[id]?.[i] ?? ''] ?? HERO[id] ?? ''

// ── Themed line icons (Lucide paths) — a small infographic glyph per entry ─────
const ICON: Record<string, string> = {
  march:
    'M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z',
  scroll: 'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z M14 2v6h6 M8 13h8 M8 17h5',
  alert: 'M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z M12 9v4 M12 17h.01',
  landmark: 'M3 22h18 M6 18v-7 M10 18v-7 M14 18v-7 M18 18v-7 M4 10l8-5 8 5 M2 10h20',
  users:
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
  book: 'M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z',
  flag: 'M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z M4 22V15',
  star: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z',
}
const svgIcon = (d: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d
    .split(' M')
    .map((seg, i) => `<path d="${i ? 'M' + seg : seg}"/>`)
    .join('')}</svg>`
/** Pick a glyph from the entry text by keyword. */
function iconFor(text: string): string {
  const s = (text || '').toLowerCase()
  let key = 'star'
  if (/massacre/.test(s)) key = 'alert'
  else if (/satyagraha|march|dandi|movement|quit india|disobedience/.test(s)) key = 'march'
  else if (/\bact\b|report|pact|award|bill|endowment|treaty|resolution|autobiograph|newspaper/.test(s)) key = 'scroll'
  else if (/vote|women|woman|legislator|devadasi|widow|girls|sabha|federation/.test(s)) key = 'users'
  else if (/education|school|university|meal|vedas|read/.test(s)) key = 'book'
  else if (/party|ministry|swaraj|league|conference|council|formation|plan|mission|offer|cabinet|commission|municipal/.test(s)) key = 'landmark'
  else if (/independence|flag|deliverance/.test(s)) key = 'flag'
  return svgIcon(ICON[key])
}

function langBlock(e: NoteEntry, lang: 'en' | 'ta'): string {
  const heading = e.heading?.[lang]
  const body = e.body?.[lang]
  const bullets = e.bullets?.map((b) => b[lang]).filter(Boolean)
  if (!heading && !body && !(bullets && bullets.length)) return ''
  const ta = lang === 'ta' ? ' tamil' : ''
  const tag = lang === 'en' ? 'English' : 'தமிழ்'
  return `<div class="lb${ta}">
    <div class="tag">${tag}</div>
    ${heading ? `<div class="lh">${esc(heading)}</div>` : ''}
    ${body ? `<div class="lp">${br(body)}</div>` : ''}
    ${bullets && bullets.length ? `<ul class="ll">${bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}
  </div>`
}

function entryCardInner(e: NoteEntry): string {
  return `${langBlock(e, 'en')}${langBlock(e, 'ta')}`
}

/** Text used to pick an entry's icon. */
const entryKey = (e: NoteEntry) =>
  `${e.marker ?? ''} ${e.heading?.en ?? ''} ${e.body?.en ?? ''} ${e.bullets?.[0]?.en ?? ''}`

/** Image thumbnail with a small themed icon badge in the corner. */
const thumb = (img: string, e: NoteEntry) =>
  img
    ? `<div class="thumbwrap"><img class="thumb" src="${img}" alt=""/><span class="ibadge">${iconFor(entryKey(e))}</span></div>`
    : ''

/** Blocks for a timeline topic: each entry is a rail row + full-width card. */
function timelineBlocks(note: StudyNote): string[] {
  return note.entries.map((e, i) => {
    const badge = e.marker
      ? `<div class="yr">${esc(e.marker)}</div>`
      : `<div class="yr dot"></div>`
    return `<div class="trow">
      <div class="rail">${badge}</div>
      <div class="tcard"><div class="ccontent">${entryCardInner(e)}</div>${thumb(entryImage(note.id, i), e)}</div>
    </div>`
  })
}

/** Blocks for a numbered list topic: coloured rows. */
function listBlocks(note: StudyNote): string[] {
  return note.entries.map(
    (e, i) => `<div class="lrow" style="background:${CARD_TINTS[i % CARD_TINTS.length]}">
      <div class="num">${esc(e.marker ?? String(i + 1))}</div>
      <div class="lbody">${entryCardInner(e)}</div>
      ${thumb(entryImage(note.id, i), e)}
    </div>`
  )
}

function coverHtml(note: StudyNote): string {
  const hero = HERO[note.id]
  return `<div class="cover">
    <div class="cover-text">
      <div class="brand">TNPSC MENTOR</div>
      <div class="title">${esc(note.title.en)}</div>
      <div class="title-ta tamil">${esc(note.title.ta)}</div>
      ${note.subtitle ? `<div class="sub">${esc(note.subtitle.en)} · <span class="tamil">${esc(note.subtitle.ta)}</span></div>` : ''}
      ${note.period ? `<div class="period">${esc(note.period)}</div>` : ''}
    </div>
    ${hero ? `<img class="hero" src="${hero}" alt=""/>` : ''}
  </div>`
}

/** Slim running header for continuation pages of the same topic. */
function headHtml(note: StudyNote): string {
  return `<div class="page-head">
    <span class="brand2">TNPSC MENTOR</span>
    <span class="hh">${esc(note.title.en)} <span class="tamil">· ${esc(note.title.ta)}</span> (contd.)</span>
  </div>`
}

const topics = STUDY_NOTES.map((note) => ({
  cover: coverHtml(note),
  head: headHtml(note),
  blocks: note.layout === 'timeline' ? timelineBlocks(note) : listBlocks(note),
}))

// Faint diagonal "TNPSC Mentors" tile, repeated per A4 page (overlaps the data).
const WATERMARK_SVG = encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='320' height='185'><text x='0' y='120' transform='rotate(-30 0 120)' font-family='Arial, sans-serif' font-size='34' font-weight='700' fill='%237C5CFF' fill-opacity='0.08'>TNPSC Mentors</text></svg>`
)

// ── Header + contact footer (app's own constants) ─────────────────────────────
const CONTACT = {
  whatsapp: '+91 96777 79808',
  email: 'support@tnpscmentors.in',
  site: 'tnpscmentors.in',
}
const headBarHtml =
  `<div class="page-top"><span class="ptl"><span class="dot"></span>TNPSC MENTOR</span>` +
  `<span class="ptr">Bilingual TNPSC Study Notes</span></div>`
const contactHtml =
  `<span class="ci">${svgIcon('M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z')}${CONTACT.whatsapp}</span>` +
  `<span class="ci">${svgIcon('M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z M22 7l-10 6L2 7')}${CONTACT.email}</span>` +
  `<span class="ci">${svgIcon('M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z M2 12h20 M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20z')}${CONTACT.site}</span>`

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>TNPSC Mentors · Study Notes Preview</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=Noto+Sans+Tamil:wght@400;600;700&display=swap');
  :root{--violet:#7C5CFF;--deep:#4C1D95;--soft:#EEEBFE;--ink:#18142B;--ink2:#3C3850;--line:#E8E6F3;}
  *{box-sizing:border-box;}
  body{margin:0;font-family:'Inter',system-ui,sans-serif;color:var(--ink);background:#e9e8f0;}
  .tamil{font-family:'Noto Sans Tamil','Inter',sans-serif;}
  .hint{max-width:210mm;margin:14px auto 0;font-size:12px;color:#6E6C7C;}
  #app{padding:14px 0 40px;}
  /* A4 sheet */
  .page{width:210mm;height:297mm;background:#fff;margin:0 auto 16px;position:relative;overflow:hidden;
        display:flex;flex-direction:column;box-shadow:0 8px 30px rgba(0,0,0,.16);}
  /* watermark sits ABOVE the content (overlaps the data), still light enough to read through */
  .wm{position:absolute;inset:0;z-index:6;pointer-events:none;
      background-image:url("data:image/svg+xml,${WATERMARK_SVG}");background-repeat:repeat;}
  .cover,.area,.page-head{position:relative;z-index:1;}
  .page-top,.page-foot{position:relative;z-index:7;background:#fff;}
  /* header bar (app name) — every page */
  .page-top{flex:0 0 auto;display:flex;justify-content:space-between;align-items:center;padding:6px 14mm;border-bottom:2px solid var(--violet);}
  .ptl{display:flex;align-items:center;gap:7px;font-weight:800;color:var(--deep);font-size:12px;letter-spacing:.5px;}
  .dot{width:14px;height:14px;border-radius:4px;background:linear-gradient(135deg,var(--violet),#a78bfa);}
  .ptr{font-size:10px;color:var(--ink2);}
  /* contact footer — every page */
  .cinfo{display:flex;align-items:center;gap:14px;flex-wrap:wrap;}
  .ci{display:inline-flex;align-items:center;gap:4px;}
  .ci svg{width:12px;height:12px;color:var(--violet);}
  .cover{background:linear-gradient(135deg,var(--deep),#6d28d9);color:#fff;padding:22px 14mm 20px;border-top:6px solid var(--violet);
         display:flex;gap:16px;align-items:center;overflow:hidden;}
  .cover::after{content:'';position:absolute;right:-50px;top:-60px;width:190px;height:190px;border-radius:50%;background:rgba(255,255,255,.08);pointer-events:none;}
  .cover::before{content:'';position:absolute;left:-30px;bottom:-50px;width:120px;height:120px;border-radius:50%;background:rgba(124,92,255,.25);pointer-events:none;}
  .cover-text{flex:1 1 auto;min-width:0;position:relative;z-index:1;}
  .hero{flex:0 0 auto;width:96px;height:96px;object-fit:cover;border-radius:14px;border:3px solid rgba(255,255,255,.55);box-shadow:0 6px 18px rgba(0,0,0,.32);position:relative;z-index:1;background:#fff;}
  .brand{font-size:11px;font-weight:700;letter-spacing:.7px;opacity:.9;}
  .title{font-size:26px;font-weight:800;margin-top:6px;line-height:1.1;}
  .title-ta{font-size:19px;font-weight:700;opacity:.95;margin-top:2px;}
  .sub{font-size:13px;opacity:.9;margin-top:8px;}
  .period{display:inline-block;margin-top:10px;background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.3);border-radius:999px;padding:3px 12px;font-size:12px;font-weight:700;}
  /* per-entry image thumbnail + icon badge */
  .thumbwrap{position:relative;flex:0 0 auto;}
  .thumb{display:block;width:78px;height:78px;object-fit:cover;border-radius:10px;border:1px solid var(--line);background:#fff;}
  .ibadge{position:absolute;right:-6px;bottom:-6px;width:24px;height:24px;border-radius:7px;background:var(--violet);color:#fff;display:grid;place-items:center;box-shadow:0 2px 5px rgba(0,0,0,.28);}
  .ibadge svg{width:13px;height:13px;}
  .page-head{background:var(--soft);border-bottom:1px solid var(--line);padding:7px 14mm;display:flex;align-items:baseline;gap:10px;}
  .brand2{font-size:10px;font-weight:800;color:var(--violet);letter-spacing:.5px;}
  .hh{font-size:11px;font-weight:600;color:var(--ink2);}
  .area{flex:1 1 auto;overflow:hidden;padding:9mm 12mm;}
  .page-foot{flex:0 0 auto;border-top:1px solid var(--line);padding:6px 12mm;font-size:9.5px;color:#6E6C7C;display:flex;justify-content:space-between;align-items:center;gap:10px;}
  /* timeline — single left rail, full-width cards */
  .trow{display:flex;gap:14px;align-items:flex-start;margin:0 0 13px;}
  .rail{flex:0 0 66px;display:flex;justify-content:center;position:relative;}
  .rail::before{content:'';position:absolute;top:4px;bottom:-19px;left:50%;width:3px;background:var(--line);transform:translateX(-50%);z-index:0;}
  .area .trow:last-child .rail::before{display:none;}
  .yr{position:relative;z-index:1;background:var(--violet);color:#fff;font-weight:800;font-size:12px;border-radius:9px;padding:5px 8px;white-space:nowrap;box-shadow:0 2px 6px rgba(124,92,255,.4);height:fit-content;}
  .yr.dot{background:#fff;border:3px solid var(--violet);border-radius:50%;width:18px;height:18px;padding:0;margin-top:4px;}
  .tcard{position:relative;flex:1 1 auto;min-width:0;border:1px solid var(--line);border-left:3px solid var(--violet);border-radius:10px;background:#fff;padding:11px 13px;display:flex;gap:12px;align-items:flex-start;}
  .ccontent{flex:1 1 auto;min-width:0;}
  /* list */
  .lrow{position:relative;display:flex;gap:13px;align-items:flex-start;border-radius:14px;padding:13px 15px;margin:0 0 12px;}
  .num{flex:0 0 auto;width:34px;height:34px;border-radius:50%;background:#fff;border:2px solid var(--ink);display:grid;place-items:center;font-weight:800;font-size:15px;}
  .lbody{flex:1 1 auto;min-width:0;}
  /* language blocks */
  .lb{margin-top:8px;} .lb:first-child{margin-top:0;}
  .tag{font-size:9px;font-weight:700;letter-spacing:.6px;color:var(--violet);text-transform:uppercase;margin-bottom:2px;}
  .lh{font-weight:700;font-size:14px;line-height:1.4;}
  .lp{color:var(--ink2);font-size:12.5px;line-height:1.5;margin-top:2px;}
  .ll{margin:5px 0 0;padding-left:18px;color:var(--ink2);font-size:12.5px;line-height:1.5;}
  .ll li{margin:2px 0;}
  @media print{
    body{background:#fff;}
    .hint{display:none;}
    #app{padding:0;}
    @page{size:A4;margin:0;}
    .page{margin:0;box-shadow:none;height:296mm;page-break-after:always;}
  }
</style></head>
<body>
  <p class="hint">Preview · A4 pages. Open in a browser, then <b>Print → Save as PDF</b> (A4, margins: None, Background graphics: on).</p>
  <div id="app"></div>
  <script>
    var TOPICS = ${JSON.stringify(topics)};
    var HEADBAR = ${JSON.stringify(headBarHtml)};
    var CONTACT = ${JSON.stringify(contactHtml)};
    function el(h){var t=document.createElement('template');t.innerHTML=h.trim();return t.content.firstElementChild;}
    function newPage(){var p=el('<div class="page"><div class="wm"></div></div>');p.appendChild(el(HEADBAR));document.getElementById('app').appendChild(p);return p;}
    function addArea(p){var a=el('<div class="area"></div>');p.appendChild(a);return a;}
    function addFoot(p,n){p.appendChild(el('<div class="page-foot"><span class="cinfo">'+CONTACT+'</span><span>Page '+n+'</span></div>'));}
    function build(){
      var app=document.getElementById('app');app.innerHTML='';
      var pageNo=0;
      TOPICS.forEach(function(topic){
        var page=newPage();pageNo++;
        page.appendChild(el(topic.cover));
        var area=addArea(page);addFoot(page,pageNo);
        topic.blocks.forEach(function(bh){
          var node=el(bh);
          area.appendChild(node);
          if(area.scrollHeight>area.clientHeight && area.children.length>1){
            area.removeChild(node);
            page=newPage();pageNo++;
            page.appendChild(el(topic.head));
            area=addArea(page);addFoot(page,pageNo);
            area.appendChild(node);
          }
        });
      });
    }
    if(document.fonts&&document.fonts.ready){document.fonts.ready.then(build);}else{window.addEventListener('load',build);}
  </script>
</body></html>`

const outPath = resolve(HERE, '..', 'studynotes-preview.html')
writeFileSync(outPath, html, 'utf8')
console.log('Wrote ' + outPath)
