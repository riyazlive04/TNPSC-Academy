// ─── Question stems that are not one sentence ────────────────────────────────
// A tenth of this bank is match-the-following, and more again is numbered
// statements or an assertion-and-reason pair. The bank stores all of it with
// real newlines; HTML collapses newlines, so every one of those rendered as a
// single run-on paragraph:
//
//   Match correctly with the Suitable Act. (a) Preventive Detention Act (PDA)
//   in India (b) The National Emergencies Act was signed into law by President
//   Gerald Ford on (c) ... (a) (b) (c) (d) 1. 1971 2. 1974 3. 1950 4. 1976
//
// which is unreadable, and unreadable in the one place it matters most — the
// page somebody landed on from a search for that exact question.
//
// So the lines are parsed back into the shape the printed paper had. Four
// shapes are recognised; anything not confidently one of them falls through to
// plain line-preserved text, which is still far better than a run-on. Every
// token keeps its original line in `raw` and every fallback re-emits `raw`, so
// a shape this parser does not know still loses nothing. The one thing ever
// discarded is the printed answer-grid header — see GRID_HDR.

/** (a) … / (A) … — the left column of a match, or a lettered statement. */
const RE_LETTER = /^\(([a-eA-E])\)\s*(.*)$/
/** (i) … / (III) … — a roman-numbered statement. */
const RE_ROMAN = /^\(([ivxIVX]{1,4})\)\s*(.*)$/
/** 1. … / 2) … — the right column of a match, or a numbered statement. */
const RE_NUMBER = /^\(?(\d{1,2})[.)]\s*(.*)$/
/**
 * Both columns printed on one line, separated by the column gutter:
 *
 *   (a) Political Horoscope        1. Sir Ivor Jennings
 *
 * Two or more spaces then a number and a full stop is the gutter. A single
 * space would not do — "(a) In 1971. the war began" must not split.
 */
const SAME_LINE = /^(.*?\S)\s{2,}(\d{1,2})[.)]\s+(\S.*)$/
/**
 * A line that is only bracketed letters: `     (a)  (b)  (c)  (d)`.
 *
 * In the printed paper this is the header of the answer grid, and the grid
 * itself is reproduced below the question as the four options. Carried into our
 * layout it is a row of naked letters that means nothing, so it is dropped —
 * the only thing this parser ever discards.
 */
const GRID_HDR = /^(\s*\(?[a-eA-E]\)?\s*){2,}$/
/** `List I` / `List-II` / `List 2` / `பட்டியல் II` — a column caption. */
const LIST_HDR = /^(list|பட்டியல்)\s*[-–—]?\s*(i{1,3}|[123])\s*:?\s*$/i
const RE_ASSERTION = /^(assertion|கூற்று)\s*[[(]?\s*[A1அ]?\s*[\])]?\s*[:\-–]/i
const RE_REASON = /^(reason|காரணம்)\s*[[(]?\s*[R2க]?\s*[\])]?\s*[:\-–]/i

/** Roman numerals only — so `(i)` is not read as the letter `i`. */
const isRoman = (s) => /^[ivxIVX]+$/.test(s)

function tokenise(lines) {
  const toks = []
  for (const line of lines) {
    const t = line.trim()
    if (!t) { toks.push({ kind: 'blank', raw: t }); continue }
    if (GRID_HDR.test(t)) { toks.push({ kind: 'grid', text: t, raw: t }); continue }
    if (LIST_HDR.test(t)) { toks.push({ kind: 'listhdr', text: t, raw: t }); continue }
    let m = t.match(RE_LETTER)
    if (m && !isRoman(m[1])) { toks.push({ kind: 'letter', marker: m[1], text: m[2], raw: t }); continue }
    m = t.match(RE_ROMAN)
    if (m) { toks.push({ kind: 'roman', marker: m[1], text: m[2], raw: t }); continue }
    m = t.match(RE_NUMBER)
    if (m) { toks.push({ kind: 'number', marker: m[1], text: m[2], raw: t }); continue }
    toks.push({ kind: 'text', text: t, raw: t })
  }
  return toks
}

/** The two-column table both match shapes render into. */
/** Column names used when the printed paper did not supply any. */
const FALLBACK_CAPS = {
  en: { left: 'List I', right: 'List II', year: 'Year' },
  ta: { left: 'பட்டியல் I', right: 'பட்டியல் II', year: 'ஆண்டு' },
}

const YEAR = /^(1[5-9]|20)[0-9]{2}$/

/** True when every right-hand cell is a four-digit year. */
function allYears(pairs) {
  const vals = pairs.map((p) => p.r && String(p.r.text).trim()).filter(Boolean)
  return vals.length >= 3 && vals.every((v) => YEAR.test(v))
}

function matchTable(pairs, caps, fmt, lang = 'en') {
  const cells = pairs
    .map(
      ({ l, r }) =>
        '<tr>' +
        `<th>${l ? fmt(`(${l.marker})`) : ''}</th><td>${l ? fmt(l.text) : ''}</td>` +
        `<th>${r ? fmt(`${r.marker}.`) : ''}</th><td>${r ? fmt(r.text) : ''}</td>` +
        '</tr>',
    )
    .join('')
  const fb = FALLBACK_CAPS[lang] ?? FALLBACK_CAPS.en
  const given = caps.length === 2
  const [leftCap, rightCap] = given
    ? [fmt(caps[0].text), fmt(caps[1].text)]
    : [fmt(fb.left), fmt(allYears(pairs) ? fb.year : fb.right)]
  // data-generated marks a heading this code supplied rather than one the paper
  // printed; test-stems.mjs discounts those when checking that no source text
  // was lost or invented.
  const mark = given ? '' : ' data-generated="1"'
  const head =
    `<thead><tr><th colspan="2"${mark}>${leftCap}</th>` +
    `<th colspan="2"${mark}>${rightCap}</th></tr></thead>`
  // A lone caption has no column to head, so it stays a line of its own rather
  // than being thrown away.
  const stray = caps.length === 1 ? `<p class="stem-tail">${fmt(caps[0].text)}</p>` : ''
  return `${stray}<table class="match">${head}<tbody>${cells}</tbody></table>`
}

/**
 * Parses one stem into a heading line and, when the stem has structure, a block
 * of markup to sit beside the heading rather than inside it — a table may not
 * live inside an `<h1>`.
 *
 * @param {string} text
 * @param {(s: string) => string} fmt  escape-and-typeset, i.e. mathText
 * @returns {{lead: string, body: string}}
 */
export function stemHtml(text, fmt, lang = 'en') {
  const src = String(text ?? '')
  if (!src.trim()) return { lead: '', body: '' }

  const toks = tokenise(src.split('\n'))
  const keep = (xs) => xs.filter((x) => x.kind !== 'blank' && x.kind !== 'grid')
  const joinRaw = (xs) => keep(xs).map((x) => fmt(x.raw)).join('<br>')

  // ── Assertion and Reason ──────────────────────────────────────────────────
  // Checked first: these stems carry no (a)/(i)/1. markers at all, so none of
  // the marker-based paths below would ever see them.
  const ai = toks.findIndex((x) => x.kind === 'text' && RE_ASSERTION.test(x.text))
  const ri = toks.findIndex((x, i) => i > ai && x.kind === 'text' && RE_REASON.test(x.text))
  if (ai >= 0 && ri > ai) {
    const before = toks.slice(0, ai)
    // Everything between the two labels belongs to the Assertion, not just the
    // labelled line: several of these carry a gloss on the line below, e.g. a
    // Thirukkural followed by its meaning in brackets. Taking only toks[ai]
    // dropped that line.
    const assertion = toks.slice(ai, ri)
    const after = toks.slice(ri + 1)
    // Most of these open with a sentence ("Consider the following Assertion and
    // Reason"), which becomes the heading and leaves both halves in the body.
    // Some open straight on the Assertion — then that line is the heading, so
    // the page never ends up with an empty <h1> or with the assertion printed
    // twice, and only its continuation lines go into the body.
    const hasLead = keep(before).length > 0
    const assertionBody = hasLead ? assertion : assertion.slice(1)
    return {
      lead: hasLead ? joinRaw(before) : fmt(toks[ai].raw),
      body:
        '<div class="stem-ar">' +
        (keep(assertionBody).length ? `<p>${joinRaw(assertionBody)}</p>` : '') +
        `<p>${fmt(toks[ri].raw)}</p></div>` +
        (keep(after).length ? `<p class="stem-tail">${joinRaw(after)}</p>` : ''),
    }
  }

  const MARKERS = ['letter', 'roman', 'number']
  const firstMarker = toks.findIndex((x) => MARKERS.includes(x.kind))

  // ── No structure at all ───────────────────────────────────────────────────
  // Every line goes into the heading, breaks and all. Deliberately not split
  // into heading + body: these stems are one question written over two or three
  // lines ("Choose the correct synonym:" / the sentence), and splitting them
  // would leave hundreds of pages sharing one generic <h1>.
  if (firstMarker < 0) return { lead: joinRaw(toks), body: '' }

  const pre = toks.slice(0, firstMarker)
  const after = toks.slice(firstMarker)
  const letters = after.filter((x) => x.kind === 'letter')
  const romans = after.filter((x) => x.kind === 'roman')
  const numbers = after.filter((x) => x.kind === 'number')
  const tail = after.filter((x) => x.kind === 'text')
  const tailHtml = tail.length ? `<p class="stem-tail">${joinRaw(tail)}</p>` : ''

  // Captions come from the WHOLE stem, not only the part after the first
  // marker: `List I` sits above `(a)`, so looking only after it dropped the
  // caption entirely.
  const caps = toks.filter((x) => x.kind === 'listhdr')
  // When the captions are consumed by the table head they must not also appear
  // in the lead; everywhere else they are ordinary content and must.
  const leadText = joinRaw(pre.filter((x) => x.kind === 'text'))
  const leadAll = joinRaw(pre)

  // Three lists (`List 1 / List 2 / List 3`) are a shape a two-column table
  // cannot express, and guessing a pairing would be worse than not trying.
  const tooManyLists = caps.length > 2

  // ── Match printed as two columns on one line ──────────────────────────────
  if (!tooManyLists && letters.length >= 2) {
    const split = letters.map((x) => x.text.match(SAME_LINE))
    if (split.every(Boolean)) {
      const pairs = letters.map((x, i) => ({
        l: { marker: x.marker, text: split[i][1] },
        r: { marker: split[i][2], text: split[i][3] },
      }))
      // A right-hand item with no partner (a fifth option) keeps its own row.
      for (const nTok of numbers) pairs.push({ l: null, r: { marker: nTok.marker, text: nTok.text } })
      return { lead: leadText, body: matchTable(pairs, caps, fmt, lang) + tailHtml }
    }
  }

  // ── Match printed as two blocks, letters then numbers ─────────────────────
  const kinds = after.map((x) => x.kind)
  if (
    !tooManyLists &&
    letters.length >= 2 &&
    numbers.length >= 2 &&
    kinds.indexOf('number') > kinds.lastIndexOf('letter')
  ) {
    const rows = Math.max(letters.length, numbers.length)
    const pairs = []
    for (let i = 0; i < rows; i++) {
      pairs.push({
        l: letters[i] ? { marker: letters[i].marker, text: letters[i].text } : null,
        r: numbers[i] ? { marker: numbers[i].marker, text: numbers[i].text } : null,
      })
    }
    return { lead: leadText, body: matchTable(pairs, caps, fmt, lang) + tailHtml }
  }

  // ── A list of statements ──────────────────────────────────────────────────
  const items = romans.length >= 2 ? romans : letters.length >= 2 ? letters : numbers.length >= 2 ? numbers : null
  if (items && items.length === after.filter((x) => MARKERS.includes(x.kind)).length) {
    const capHtml = caps.length ? `<p class="stem-tail">${caps.map((c) => fmt(c.text)).join('<br>')}</p>` : ''
    const marked = items
      .map(
        (x) =>
          `<li><b>${fmt(items === numbers ? `${x.marker}.` : `(${x.marker})`)}</b> <span>${fmt(x.text)}</span></li>`,
      )
      .join('')
    return { lead: leadText, body: `${capHtml}<ul class="stem-list">${marked}</ul>${tailHtml}` }
  }

  // Nothing recognised: keep every line exactly as it came, just not glued end
  // to end. The lead keeps its captions here, since no table consumed them.
  return { lead: leadAll, body: `<div class="stem-lines">${joinRaw(after)}</div>` }
}
