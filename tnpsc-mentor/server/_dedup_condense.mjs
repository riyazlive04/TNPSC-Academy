import { readFileSync, writeFileSync } from 'node:fs'
const data = JSON.parse(readFileSync('_dedup_batch_full.json', 'utf8'))
const out = {}
for (const [cat, groups] of Object.entries(data)) {
  out[cat] = groups.map(g => ({
    sig: g.sig,
    rows: g.rows.map(r => ({
      id: r.id, group_type: r.group_type, year: r.year, subject: r.subject, topic: r.topic, unit: r.unit,
      question_text: r.question_text, option_a: r.option_a, option_b: r.option_b, option_c: r.option_c, option_d: r.option_d,
      correct_answer: r.correct_answer, difficulty: r.difficulty, external_id: r.external_id,
      has_ta: !!r.question_text_ta, opt_ta_populated: !!(r.option_a_ta),
      question_type: r.question_type, active: r.active,
      n_book: r.n_book, n_seen: r.n_seen, n_ans: r.n_ans,
    }))
  }))
}
writeFileSync('_dedup_condensed.json', JSON.stringify(out, null, 1))
console.log('done')
