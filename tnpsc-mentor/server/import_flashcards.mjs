import 'dotenv/config'
import { Client } from 'pg'
import { readFileSync, existsSync } from 'node:fs'

/**
 * Loads a "Do You Know?" flashcard deck from its Markdown source into
 * flashcard_decks / flashcard_items.
 *
 *   Content_materials/data_flashcard.md   (25 cards, 10th-std History)
 *
 * The source is the HTML-in-Markdown shape the content team writes:
 *
 *   <div class="flashcard">
 *     <div class="tag medium">Medium</div>
 *     <div class="question">Q1: ...?[cite: 1]</div>
 *     <div class="answer"><span class="answer-label">Answer:</span> ...[cite: 1].</div>
 *   </div>
 *
 * `[cite: N]` markers are provenance annotations from the extraction pass, not
 * content - they are stripped, as is the leading "Qn:" and the "Answer:" label.
 *
 * IDEMPOTENT BY external_id (`<deck-slug>-q<n>`): a re-run UPDATEs each card in
 * place rather than delete+reinsert. That matters - review_items.flashcard_item_id
 * is ON DELETE CASCADE, so re-inserting would silently destroy every learner's
 * spaced-revision history for the deck (the same trap documented in update-ca.mjs).
 * Cards that disappear from the source are deactivated, never deleted.
 *
 *   node import_flashcards.mjs                 # dry-run: parse + report, no writes
 *   APPLY=1 node import_flashcards.mjs         # load it
 *   FILE=../../../x.md APPLY=1 node import_flashcards.mjs
 */

const SOURCE =
  process.env.FILE ??
  'c:/Users/mas20/Desktop/work/TNPSC/Content_materials/data_flashcard.md'

// The deck this source populates. One source file = one deck.
const DECK = {
  slug: 'history-do-you-know-10',
  subject: 'History',
  title_en: 'Do You Know?',
  title_ta: 'தெரியுமா?',
  teaser_en: 'World wars, revolutions & reformers',
  teaser_ta: 'உலகப் போர்கள், புரட்சிகள் & சீர்திருத்தவாதிகள்',
  icon_slug: 'history',
  sort_order: 10,
}

// The tag class in the source maps 1:1 onto the difficulty check constraint.
const DIFFICULTY = { medium: 'medium', 'hard-medium': 'hard-medium', hard: 'hard' }

/** Drop the extraction pass's `[cite: 1]` provenance markers and tidy spacing. */
const clean = (s) =>
  s
    .replace(/\[cite:[^\]]*\]/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,;:?!])/g, '$1')
    .trim()

if (!existsSync(SOURCE)) {
  console.error(`FATAL: source not found: ${SOURCE}`)
  process.exit(2)
}

const md = readFileSync(SOURCE, 'utf8')

// One match per <div class="flashcard"> block.
const blocks = md.match(/<div class="flashcard">[\s\S]*?<\/div>\s*<\/div>/g) ?? []
if (blocks.length === 0) {
  console.error('FATAL: no <div class="flashcard"> blocks found - source shape changed?')
  process.exit(2)
}

const cards = []
for (const [i, block] of blocks.entries()) {
  const tag = block.match(/<div class="tag ([a-z-]+)">/)?.[1]
  const question = block.match(/<div class="question">([\s\S]*?)<\/div>/)?.[1]
  const answer = block.match(/<div class="answer">([\s\S]*?)<\/div>/)?.[1]

  if (!tag || !question || !answer) {
    console.error(`FATAL: card ${i + 1} is missing its tag/question/answer div.`)
    process.exit(2)
  }
  const difficulty = DIFFICULTY[tag]
  if (!difficulty) {
    console.error(`FATAL: card ${i + 1} has unknown difficulty tag "${tag}".`)
    process.exit(2)
  }

  // "Q12: What is ...?" -> "What is ...?"  (the number is positional, not content)
  const question_en = clean(question).replace(/^Q\d+\s*[:.]\s*/, '')
  // "Answer: Apartheid." -> "Apartheid."
  const answer_en = clean(answer).replace(/^Answer\s*[:.]\s*/i, '')

  if (!question_en || !answer_en) {
    console.error(`FATAL: card ${i + 1} parsed empty after cleaning.`)
    process.exit(2)
  }

  cards.push({
    external_id: `${DECK.slug}-q${i + 1}`,
    question_en,
    answer_en,
    difficulty,
    sort_order: i + 1,
  })
}

const byDifficulty = cards.reduce((a, c) => ({ ...a, [c.difficulty]: (a[c.difficulty] ?? 0) + 1 }), {})
console.log(`Parsed ${cards.length} cards from ${SOURCE}`)
console.log(`  difficulty: ${JSON.stringify(byDifficulty)}`)
console.log(`  first: ${cards[0].question_en.slice(0, 70)}...`)
console.log(`  last:  ${cards[cards.length - 1].question_en.slice(0, 70)}...`)

// The source carries English only; the _ta columns stay NULL and the app's
// display helpers fall back to English in every language mode (same posture as
// the monolingual Group 4 Tamil paper).
if (!process.env.APPLY) {
  console.log('\nDry run - set APPLY=1 to write. Nothing was changed.')
  process.exit(0)
}

const c = new Client({
  host: process.env.SUPABASE_DB_HOST,
  port: Number(process.env.SUPABASE_DB_PORT),
  user: process.env.SUPABASE_DB_USER,
  password: process.env.SUPABASE_DB_PASSWORD,
  database: process.env.SUPABASE_DB_NAME,
  ssl: { rejectUnauthorized: false },
  statement_timeout: 300000,
})
await c.connect()
console.log('Connected.')

try {
  await c.query('begin')

  const deck = await c.query(
    `insert into public.flashcard_decks
       (slug, subject, title_en, title_ta, teaser_en, teaser_ta, icon_slug, sort_order, active)
     values ($1,$2,$3,$4,$5,$6,$7,$8,true)
     on conflict (slug) do update set
       subject = excluded.subject, title_en = excluded.title_en, title_ta = excluded.title_ta,
       teaser_en = excluded.teaser_en, teaser_ta = excluded.teaser_ta,
       icon_slug = excluded.icon_slug, sort_order = excluded.sort_order, active = true
     returning id`,
    [
      DECK.slug, DECK.subject, DECK.title_en, DECK.title_ta,
      DECK.teaser_en, DECK.teaser_ta, DECK.icon_slug, DECK.sort_order,
    ]
  )
  const deckId = deck.rows[0].id

  // UPDATE-in-place on external_id. Never delete: review_items cascades off
  // flashcard_items.id and would take the learner's history with it.
  for (const card of cards) {
    await c.query(
      `insert into public.flashcard_items
         (deck_id, external_id, question_en, answer_en, difficulty, sort_order, active)
       values ($1,$2,$3,$4,$5,$6,true)
       on conflict (external_id) do update set
         deck_id = excluded.deck_id, question_en = excluded.question_en,
         answer_en = excluded.answer_en, difficulty = excluded.difficulty,
         sort_order = excluded.sort_order, active = true`,
      [deckId, card.external_id, card.question_en, card.answer_en, card.difficulty, card.sort_order]
    )
  }

  // A card pulled from the source is retired, not dropped - its review rows survive.
  const retired = await c.query(
    `update public.flashcard_items set active = false
     where deck_id = $1 and not (external_id = any($2::text[])) and active`,
    [deckId, cards.map((x) => x.external_id)]
  )

  await c.query('commit')
  console.log(`Loaded ${cards.length} cards into deck ${DECK.slug} (${deckId}).`)
  if (retired.rowCount) console.log(`Retired ${retired.rowCount} card(s) no longer in the source.`)
} catch (err) {
  await c.query('rollback')
  console.error('FAILED - rolled back:', err.message)
  process.exitCode = 1
} finally {
  await c.end()
}
