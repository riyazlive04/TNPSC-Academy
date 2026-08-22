import { Client } from 'pg'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, isAbsolute } from 'node:path'

/**
 * Reusable DDL/migration runner for the Supabase Postgres DB.
 *
 * Reads connection details from server/.env (loaded via the project's normal env
 * or passed through the shell). DDL can't go through the service-role REST API,
 * so this connects directly to the session-mode pooler (Sydney/ap-southeast-2).
 *
 * Usage:
 *   node run-migration.mjs                       # default: ALTERs + secure.sql + admin_write.sql
 *   node run-migration.mjs ../supabase/foo.sql   # run one or more specific .sql files
 *   node run-migration.mjs -e "alter table ..."  # run an inline SQL string
 */

const __dirname = dirname(fileURLToPath(import.meta.url))
const REF = process.env.SUPABASE_DB_USER?.split('.')[1] ?? 'cwpdkhfsyujfjcwbnhdo'
const PASSWORD = process.env.SUPABASE_DB_PASSWORD ?? process.env.DB_PASSWORD
const HOST = process.env.SUPABASE_DB_HOST ?? 'aws-1-ap-southeast-2.pooler.supabase.com'
const PORT = Number(process.env.SUPABASE_DB_PORT ?? 5432)
const USER = process.env.SUPABASE_DB_USER ?? `postgres.${REF}`
const DB = process.env.SUPABASE_DB_NAME ?? 'postgres'
const sqlDir = join(__dirname, '..', 'supabase')

if (!PASSWORD) {
  console.error('FATAL: SUPABASE_DB_PASSWORD (or DB_PASSWORD) not set.')
  process.exit(2)
}

// Build the list of SQL steps from CLI args, or the default migration set.
const args = process.argv.slice(2)
let steps = []
if (args[0] === '-e') {
  steps = [{ label: 'inline', sql: args.slice(1).join(' ') }]
} else if (args.length) {
  steps = args.map((p) => ({
    label: p,
    sql: readFileSync(isAbsolute(p) ? p : join(process.cwd(), p), 'utf8'),
  }))
} else {
  steps = [
    {
      label: 'ALTER TABLE (question_type, external_id)',
      sql: `
        alter table questions add column if not exists question_type text;
        alter table questions add column if not exists external_id text;
      `,
    },
    {
      // CREATE OR REPLACE can't change a function's return type; drop first.
      label: 'drop changed functions',
      sql: `
        drop function if exists public.get_quiz_questions(jsonb);
        drop function if exists public.get_due_reviews(int);
      `,
    },
    { label: 'secure.sql', sql: readFileSync(join(sqlDir, 'secure.sql'), 'utf8') },
    { label: 'admin_write.sql', sql: readFileSync(join(sqlDir, 'admin_write.sql'), 'utf8') },
    // secure.sql's get_quiz_questions/count_quiz_questions are a STALE snapshot
    // (predates the testseries_g2 exclusion and year filter added later, and
    // predates the 2026-08-22 perf fix — see fix_quiz_scan_perf.sql's own
    // header). Re-running it alone would silently revert both. This step must
    // stay LAST in the default set so a plain `node run-migration.mjs` always
    // ends on the current, correct versions of these two functions.
    { label: 'fix_quiz_scan_perf.sql', sql: readFileSync(join(sqlDir, 'fix_quiz_scan_perf.sql'), 'utf8') },
  ]
}

async function main() {
  const client = new Client({
    host: HOST,
    port: PORT,
    user: USER,
    password: PASSWORD,
    database: DB,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
    statement_timeout: 120000,
  })
  await client.connect()
  console.log(`CONNECTED via ${HOST}:${PORT}`)

  try {
    for (const s of steps) {
      process.stdout.write(`Running ${s.label} ... `)
      await client.query(s.sql)
      console.log('OK')
    }
  } finally {
    await client.end()
  }
}

main().catch((e) => {
  console.error('ERROR:', e.message)
  process.exit(1)
})
