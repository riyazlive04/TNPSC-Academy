import 'dotenv/config'
import { Client } from 'pg'

// Throwaway end-to-end check of the flashcard RPCs against the live DB.
// Everything runs inside ONE transaction that is ALWAYS rolled back, so no real
// user's review deck is touched. auth.uid() is faked via the request.jwt.claims
// GUC, exactly as PostgREST sets it for a real request.

const c = new Client({
  host: process.env.SUPABASE_DB_HOST,
  port: Number(process.env.SUPABASE_DB_PORT),
  user: process.env.SUPABASE_DB_USER,
  password: process.env.SUPABASE_DB_PASSWORD,
  database: process.env.SUPABASE_DB_NAME,
  ssl: { rejectUnauthorized: false },
})
await c.connect()

const ok = (label, cond, extra = '') =>
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? `  ${extra}` : ''}`)

try {
  await c.query('begin')

  const { rows: users } = await c.query('select id from auth.users order by created_at limit 1')
  if (!users.length) throw new Error('no users to test with')
  const uid = users[0].id
  await c.query(`select set_config('request.jwt.claims', $1, true)`, [
    JSON.stringify({ sub: uid, role: 'authenticated' }),
  ])

  // 1. The tray query.
  const { rows: decks } = await c.query('select * from public.get_flashcard_decks()')
  ok('get_flashcard_decks returns the deck', decks.length === 1, `n=${decks.length}`)
  const deck = decks[0]
  ok('card_count = 25', Number(deck.card_count) === 25, `got ${deck.card_count}`)
  ok('due_count = 25 (nothing swiped yet)', Number(deck.due_count) === 25, `got ${deck.due_count}`)
  ok('started_count = 0', Number(deck.started_count) === 0, `got ${deck.started_count}`)

  // 2. The viewer query.
  const { rows: cards } = await c.query('select * from public.get_flashcard_deck($1)', [deck.id])
  ok('get_flashcard_deck returns 25 cards', cards.length === 25, `n=${cards.length}`)
  ok('cards start unseen (due_at null)', cards.every((r) => r.due_at === null))
  ok(
    'difficulty tags survived the import',
    new Set(cards.map((r) => r.difficulty)).size === 3,
    [...new Set(cards.map((r) => r.difficulty))].join(',')
  )
  const first = cards[0]

  // 3. Right swipe -> a successful review on the SM-2-lite curve.
  const { rows: g1 } = await c.query('select public.grade_flashcard($1,$2) as r', [first.id, true])
  ok('right swipe: reps 0 -> 1', g1[0].r.reps === 1, JSON.stringify(g1[0].r))
  ok('right swipe: interval = 1 day (first curve step)', g1[0].r.interval_days === 1)

  const { rows: ri1 } = await c.query(
    'select * from public.review_items where user_id=$1 and flashcard_item_id=$2',
    [uid, first.id]
  )
  ok('a review_items row now exists for the card', ri1.length === 1)
  ok('it records last_result=correct', ri1[0].last_result === 'correct')
  ok('question_id stays NULL (not an MCQ row)', ri1[0].question_id === null)

  // 4. Second right swipe advances further along the curve.
  const { rows: g2 } = await c.query('select public.grade_flashcard($1,$2) as r', [first.id, true])
  ok('second right swipe: interval 1 -> 3', g2[0].r.interval_days === 3, JSON.stringify(g2[0].r))
  ok('no duplicate review row', (await c.query(
    'select count(*) n from public.review_items where user_id=$1 and flashcard_item_id=$2',
    [uid, first.id]
  )).rows[0].n === '1')

  // 5. Left swipe resets it and makes it due again immediately.
  const { rows: g3 } = await c.query('select public.grade_flashcard($1,$2) as r', [first.id, false])
  ok('left swipe: reps reset to 0', g3[0].r.reps === 0, JSON.stringify(g3[0].r))
  ok('left swipe: interval reset to 0', g3[0].r.interval_days === 0)
  const { rows: ri2 } = await c.query(
    'select last_result, due_at <= now() as due_now from public.review_items where user_id=$1 and flashcard_item_id=$2',
    [uid, first.id]
  )
  ok('left swipe: last_result=wrong', ri2[0].last_result === 'wrong')
  ok('left swipe: due again now', ri2[0].due_now === true)

  // 6. The MCQ revision screen must not see any of this.
  const { rows: due } = await c.query('select * from public.get_due_reviews(100)')
  ok(
    'get_due_reviews excludes flashcards',
    due.every((r) => r.item_id !== ri1[0].id),
    `${due.length} MCQ items due`
  )

  // 7. The deck counters reflect the session.
  const { rows: decks2 } = await c.query('select * from public.get_flashcard_decks()')
  ok('started_count = 1 after studying one card', Number(decks2[0].started_count) === 1,
    `got ${decks2[0].started_count}`)

  // 8. A retired card can't be graded.
  await c.query('update public.flashcard_items set active=false where id=$1', [cards[1].id])
  let rejected = false
  try {
    await c.query('select public.grade_flashcard($1,$2)', [cards[1].id, true])
  } catch {
    rejected = true
  }
  ok('grading a retired card is rejected', rejected)
} catch (err) {
  console.error('ERROR:', err.message)
  process.exitCode = 1
} finally {
  await c.query('rollback')
  await c.end()
  console.log('\nRolled back - no data was changed.')
}
