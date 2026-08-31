import 'dotenv/config'
import { Client } from 'pg'

/**
 * THROWAWAY demo decks, purely so the dashboard tray has enough items to
 * overflow and show the bleed-off-the-right-edge layout. Every row is slugged
 * `demo-*` so it can be removed in one statement.
 *
 * SAFE RIGHT NOW because the flashcard feature is NOT deployed: production
 * serves a bundle with no tray and a server with no /api/flashcards route, so
 * nothing renders these. They become student-visible the moment the feature
 * ships — DELETE THEM BEFORE DEPLOYING.
 *
 *   APPLY=1  node _seed_demo_decks.mjs   # add them
 *   REMOVE=1 node _seed_demo_decks.mjs   # take them away again
 */

// Real subjects (so the avatars resolve to real artwork) with placeholder cards.
const DEMO = [
  { slug: 'demo-polity', subject: 'Polity', title: 'Polity', teaser: 'Rights, writs & amendments' },
  { slug: 'demo-economy', subject: 'Economy', title: 'Economy', teaser: 'Banking, budgets & five-year plans' },
  { slug: 'demo-geography', subject: 'Geography', title: 'Geography', teaser: 'Rivers, monsoons & soils' },
  { slug: 'demo-ca', subject: 'Current Affairs', title: 'Current Affairs', teaser: 'This month at a glance' },
  { slug: 'demo-aptitude', subject: 'Aptitude', title: 'Aptitude', teaser: 'Shortcuts worth memorising' },
]

const c = new Client({
  host: process.env.SUPABASE_DB_HOST,
  port: Number(process.env.SUPABASE_DB_PORT),
  user: process.env.SUPABASE_DB_USER,
  password: process.env.SUPABASE_DB_PASSWORD,
  database: process.env.SUPABASE_DB_NAME,
  ssl: { rejectUnauthorized: false },
})
await c.connect()

try {
  if (process.env.REMOVE) {
    // flashcard_items cascades off the deck; review_items cascades off items.
    const r = await c.query("delete from public.flashcard_decks where slug like 'demo-%'")
    console.log(`Removed ${r.rowCount} demo deck(s) and their cards.`)
  } else if (process.env.APPLY) {
    for (const [n, d] of DEMO.entries()) {
      const { rows } = await c.query(
        `insert into public.flashcard_decks
           (slug, subject, title_en, teaser_en, icon_slug, sort_order, active)
         values ($1,$2,$3,$4,$2,$5,true)
         on conflict (slug) do update set
           subject=excluded.subject, title_en=excluded.title_en,
           teaser_en=excluded.teaser_en, sort_order=excluded.sort_order, active=true
         returning id`,
        [d.slug, d.subject, d.title, d.teaser, 20 + n]
      )
      // The tray hides decks with no cards, so give each one something.
      for (let i = 1; i <= 2; i++) {
        await c.query(
          `insert into public.flashcard_items
             (deck_id, external_id, question_en, answer_en, difficulty, sort_order, active)
           values ($1,$2,$3,$4,'medium',$5,true)
           on conflict (external_id) do update set
             question_en=excluded.question_en, answer_en=excluded.answer_en, active=true`,
          [
            rows[0].id,
            `${d.slug}-q${i}`,
            `[DEMO ${d.title} ${i}] Placeholder question — replace before shipping.`,
            `[DEMO] Placeholder answer.`,
            i,
          ]
        )
      }
    }
    console.log(`Seeded ${DEMO.length} demo decks (2 placeholder cards each).`)
  } else {
    console.log('Set APPLY=1 to seed, or REMOVE=1 to delete. Nothing done.')
  }

  const { rows } = await c.query(
    `select d.slug, d.title_en, count(i.id) cards
     from public.flashcard_decks d
     left join public.flashcard_items i on i.deck_id=d.id and i.active
     where d.active group by d.id order by d.sort_order`
  )
  console.log('\nActive decks the tray will render:')
  for (const r of rows) console.log(`  ${r.slug.padEnd(20)} ${r.title_en.padEnd(18)} ${r.cards} cards`)
} finally {
  await c.end()
}
