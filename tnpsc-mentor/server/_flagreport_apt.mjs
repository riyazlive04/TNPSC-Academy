import 'dotenv/config'
import { Client } from 'pg'
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
const SCR = 'C:/Users/mas20/AppData/Local/Temp/claude/c--Users-mas20-Desktop-work-TNPSC/e9be7729-7398-40fa-9d3f-08406580cb09/scratchpad'

const c = new Client({
  host: process.env.SUPABASE_DB_HOST, port: Number(process.env.SUPABASE_DB_PORT || 5432),
  user: process.env.SUPABASE_DB_USER, password: process.env.SUPABASE_DB_PASSWORD,
  database: process.env.SUPABASE_DB_NAME || 'postgres', ssl: { rejectUnauthorized: false },
})
await c.connect()
// Authoritative flagged set = still-not-generated aptitude rows.
const { rows } = await c.query(
  `select id, aptitude_type, question_text, correct_answer, images
     from questions where category='aptitude' and expl_status is distinct from 'generated'
     order by aptitude_type, id`)
await c.end()

// Collect flag reasons from all author/verify outputs (last wins = latest verify).
const reason = new Map()
for (const f of readdirSync(SCR)) {
  if (!/^a_q_.*\.json$/.test(f)) continue
  let arr; try { arr = JSON.parse(readFileSync(SCR + '/' + f, 'utf8')) } catch { continue }
  for (const r of arr) if (r && r.flagged && r.id) reason.set(r.id, r.flag_reason || '')
}

const byType = {}
for (const r of rows) { (byType[r.aptitude_type] ||= []).push(r) }
const line = (r) => `- \`${r.id.slice(0, 8)}\`${r.images ? ' [FIG]' : ''} (key ${r.correct_answer}) "${(r.question_text || '').replace(/\s+/g, ' ').slice(0, 70)}" — ${reason.get(r.id) || 'defective'}`

let md = `# Flagged Aptitude-bank questions (${rows.length})

Flagged as **defective** during the KaTeX worked-solution upgrade (2026-07). These were NOT
rewritten — they keep their original explanation. Most are **mis-keyed** (the number pattern /
correct maths points to a different option than the stored \`correct_answer\`) or have
**garbled/mis-transcribed options** (values only in a figure, blanks, duplicates). Each line gives
the stored key and, where determinable, the defensible answer. Fix the key / re-transcribe the
options, then these can be re-run through the upgrade.

`
for (const [type, list] of Object.entries(byType)) {
  md += `## ${type} — ${list.length}\n${list.map(line).join('\n')}\n\n`
}
writeFileSync('C:/Users/mas20/Desktop/work/TNPSC/TNPSC-Academy/tnpsc-mentor/FLAGGED_APTITUDE.md', md)
console.log('flagged report written:', rows.length, 'items |', Object.entries(byType).map(([t, l]) => `${t} ${l.length}`).join(', '))
