import { Router } from 'express'
import { asyncH, sendDbError } from '../util.js'
import { supabaseAdmin } from '../supabase.js'

const router = Router()

// Column list returned to the client — the full kural record. Ordered for a
// stable, readable response.
const COLS =
  'kural_no,paal_no,paal_ta,paal_en,iyal_no,iyal_ta,iyal_en,' +
  'adhigaram_no,adhigaram_ta,adhigaram_en,adhigaram_translit,' +
  'line1_ta,line2_ta,transliteration,couplet_en,translation_en,explanation_en,' +
  'urai_mu_varadarajan,urai_solomon_pappaiya,urai_mu_karunanidhi'

interface KuralRow {
  kural_no: number
  [col: string]: unknown
}

// ─── In-process cache ────────────────────────────────────────────────────────
// The 1330 kurals with their three uraigal are ~2.2 MB, and the table is static
// reference content that only changes when we reload it by hand. Reading it out
// of Postgres on every request was one of the app's largest sources of Supabase
// egress — the dashboard alone re-read the whole set just to show one couplet.
// Hold it in memory instead: one read per process, then nothing.
let cache: KuralRow[] | null = null
let inflight: Promise<KuralRow[]> | null = null

/** Fetch + cache all kurals. Concurrent callers share the one read; a failure
 *  clears the in-flight promise so the next request retries rather than
 *  latching a permanent error. */
function loadAll(): Promise<KuralRow[]> {
  if (cache) return Promise.resolve(cache)
  if (inflight) return inflight
  inflight = (async () => {
    // PostgREST caps a single response at 1000 rows, so page through until drained.
    const PAGE = 1000
    const all: KuralRow[] = []
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabaseAdmin
        .from('thirukural')
        .select(COLS)
        .order('kural_no', { ascending: true })
        .range(from, from + PAGE - 1)
      if (error) throw error
      all.push(...((data ?? []) as unknown as KuralRow[]))
      if (!data || data.length < PAGE) break
    }
    cache = all
    inflight = null
    return all
  })().catch((err) => {
    inflight = null
    throw err
  })
  return inflight
}

// ─── GET /api/thirukural/:no ─────────────────────────────────────────────────
// ONE kural. The dashboard's "kural of the day" needs exactly this and used to
// download all 1330 to get it.
// (Plain ':no' with a check in the body, not ':no(\d+)' — Express 4.22 ships
// path-to-regexp 0.1.13, which silently drops the parameter when a pattern is
// attached and leaves a route that matches nothing but the literal '/d+'.)
router.get(
  '/:no',
  asyncH(async (req, res) => {
    const no = Number(req.params.no)
    if (!Number.isInteger(no) || no < 1) return res.status(400).json({ error: 'Invalid kural number.' })
    let all: KuralRow[]
    try {
      all = await loadAll()
    } catch (e) {
      return sendDbError(res, e as { message?: string; code?: string })
    }
    const kural = all.find((k) => k.kural_no === no)
    if (!kural) return res.status(404).json({ error: 'No such kural.' })
    res.set('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800')
    res.json({ kural })
  })
)

// ─── GET /api/thirukural ─────────────────────────────────────────────────────
// Public, unauthenticated: the full 1330-couplet reference set, for the browse
// modal. Read-only static content, so it's cached hard at the edge/browser and
// served from memory here.
router.get(
  '/',
  asyncH(async (_req, res) => {
    let all: KuralRow[]
    try {
      all = await loadAll()
    } catch (e) {
      return sendDbError(res, e as { message?: string; code?: string })
    }
    // Reference content never changes between deploys — let the CDN/browser hold
    // it for a day and serve stale-while-revalidate.
    res.set('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800')
    res.json({ kurals: all })
  })
)

export default router
