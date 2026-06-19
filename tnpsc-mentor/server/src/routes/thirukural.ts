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

// ─── GET /api/thirukural ─────────────────────────────────────────────────────
// Public, unauthenticated: the full 1330-couplet reference set. Read-only static
// content, so it's cached hard at the edge/browser. PostgREST caps a single
// response at 1000 rows, so we page through with .range() until drained.
router.get(
  '/',
  asyncH(async (_req, res) => {
    const PAGE = 1000
    const all: unknown[] = []
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabaseAdmin
        .from('thirukural')
        .select(COLS)
        .order('kural_no', { ascending: true })
        .range(from, from + PAGE - 1)
      if (error) return sendDbError(res, error)
      all.push(...(data ?? []))
      if (!data || data.length < PAGE) break
    }
    // Reference content never changes between deploys — let the CDN/browser hold
    // it for a day and serve stale-while-revalidate.
    res.set('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800')
    res.json({ kurals: all })
  })
)

export default router
