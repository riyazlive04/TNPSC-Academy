// ─── CA monthly magazine — auto ingest + auto publish ────────────────────────
// The VPS CA pipeline is supposed to push each month's magazine straight into
// `ca_magazine` (see supabase/ca_generator.sql / APP_INTEGRATION.md), the same
// way it does the daily lane. In practice the July 2026 run pushed the 240-Q
// bank and the compiled PDF/docx/json into `ca-deliverables/<month>/` storage
// but skipped the `ca_magazine` insert — so the issue never appeared in the
// superadmin "CA Magazine" tab and nobody could approve it. This sweep is the
// safety net: if the pipeline's own DB insert ever fails again, the raw
// `magazine_<YYYY-MM>.json` it ALSO drops into storage is enough to recover.
//
// Unlike the daily lane (superadmin reviews each day's items before approving,
// see caMagazine.ts), a monthly compilation is a single once-a-month event the
// pipeline already assembled — so this publishes it automatically rather than
// waiting on a human to notice it in the console. A superadmin can still hide
// or remove it afterwards from the Materials tab like any other issue.

import { supabaseAdmin } from '../supabase.js'

const BUCKET = 'ca-deliverables'
const MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/** How many months back to look, so a pipeline outage of a month or two still
 * self-heals once it resumes (this is exactly what happened with August). */
const LOOKBACK_MONTHS = 3
const SWEEP_INTERVAL_MS = 6 * 60 * 60 * 1000

function candidateMonths(count: number): { ym: string; date: string; label: string }[] {
  const now = new Date()
  const out: { ym: string; date: string; label: string }[] = []
  for (let i = 0; i < count; i++) {
    const y = now.getUTCFullYear()
    const m = now.getUTCMonth() - i // 0-indexed; can go negative, Date normalizes
    const d = new Date(Date.UTC(y, m, 1))
    const ym = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
    out.push({ ym, date: `${ym}-01`, label: `${MONTHS_EN[d.getUTCMonth()]} ${d.getUTCFullYear()}` })
  }
  return out
}

async function ensureIngested(ym: string, date: string): Promise<number> {
  const { count, error: countErr } = await supabaseAdmin
    .from('ca_magazine')
    .select('id', { count: 'exact', head: true })
    .eq('ca_type', 'month_wise')
    .eq('date', date)
  if (countErr) {
    console.error(`[ca-monthly-auto-publish] count check failed for ${ym}`, countErr.message)
    return 0
  }
  if (count && count > 0) return count

  const { data: blob, error: dlErr } = await supabaseAdmin.storage
    .from(BUCKET)
    .download(`${ym}/magazine_${ym}.json`)
  if (dlErr || !blob) return 0 // pipeline hasn't dropped this month's file yet — normal, not an error

  let rows: unknown
  try {
    rows = JSON.parse(await blob.text())
  } catch (e) {
    console.error(`[ca-monthly-auto-publish] magazine_${ym}.json is not valid JSON`, (e as Error).message)
    return 0
  }
  if (!Array.isArray(rows) || rows.length === 0) return 0

  const CHUNK = 100
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await supabaseAdmin
      .from('ca_magazine')
      .upsert(rows.slice(i, i + CHUNK), { onConflict: 'external_id', ignoreDuplicates: true })
    if (error) {
      console.error(`[ca-monthly-auto-publish] ingest failed for ${ym} at row ${i}`, error.message)
      return 0
    }
  }
  console.log(`[ca-monthly-auto-publish] ingested ${rows.length} ${ym} magazine rows from storage`)
  return rows.length
}

async function ensurePublished(date: string, label: string): Promise<void> {
  const { data: existing } = await supabaseAdmin
    .from('materials')
    .select('id')
    .eq('kind', 'magazine')
    .eq('magazine_ca_type', 'month_wise')
    .eq('magazine_date', date)
    .maybeSingle()
  if (existing) return

  const { error } = await supabaseAdmin.from('materials').insert({
    kind: 'magazine',
    placement: 'materials',
    title: 'Current Affair',
    title_ta: 'நடப்பு நிகழ்வுகள்',
    description: label,
    magazine_ca_type: 'month_wise',
    magazine_date: date,
    created_by: null, // system-published, no human approver
  })
  if (error) {
    if (error.code === '23505') return // published by a concurrent sweep/admin action — fine
    console.error(`[ca-monthly-auto-publish] publish failed for ${date}`, error.message)
    return
  }
  console.log(`[ca-monthly-auto-publish] published ${label} monthly magazine`)
}

async function sweepOnce(): Promise<void> {
  for (const { ym, date, label } of candidateMonths(LOOKBACK_MONTHS)) {
    try {
      const itemCount = await ensureIngested(ym, date)
      if (itemCount > 0) await ensurePublished(date, label)
    } catch (e) {
      console.error(`[ca-monthly-auto-publish] sweep error for ${ym}`, (e as Error).message)
    }
  }
}

/** Start the recurring sweep. Called once at boot from index.ts. */
export function startCaMonthlyAutoPublish(): void {
  void sweepOnce()
  // unref() so a pending timer never holds the process open during a restart.
  setInterval(() => void sweepOnce(), SWEEP_INTERVAL_MS).unref()
}
