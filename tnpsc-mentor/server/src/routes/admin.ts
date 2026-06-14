import { Router } from 'express'
import { asyncH, sendDbError } from '../util.js'
import { requireAuth, requireAdmin, type AuthedRequest } from '../middleware/auth.js'

const router = Router()

// All admin routes require an authenticated admin. The underlying RPCs are also
// is_admin()-gated server-side, so this is defence in depth, not the only gate.
router.use(requireAuth, requireAdmin)

// ─── POST /api/admin/questions/list ──────────────────────────────────────────
router.post(
  '/questions/list',
  asyncH(async (req: AuthedRequest, res) => {
    const config = req.body?.config ?? {}
    const { data, error } = await req.db!.rpc('admin_list_questions', { p_config: config })
    if (error) return sendDbError(res, error)
    res.json({ questions: data ?? [] })
  })
)

// ─── POST /api/admin/questions ───────────────────────────────────────────────
// Create or update one question (blank id => insert).
router.post(
  '/questions',
  asyncH(async (req: AuthedRequest, res) => {
    const draft = req.body?.draft
    if (!draft) return res.status(400).json({ error: 'draft is required' })
    const { data, error } = await req.db!.rpc('admin_upsert_question', { p: draft })
    if (error) return sendDbError(res, error)
    res.json({ question: data })
  })
)

// ─── DELETE /api/admin/questions/:id ─────────────────────────────────────────
router.delete(
  '/questions/:id',
  asyncH(async (req: AuthedRequest, res) => {
    const { error } = await req.db!.rpc('admin_delete_question', { p_id: req.params.id })
    if (error) return sendDbError(res, error)
    res.json({ ok: true })
  })
)

// ─── POST /api/admin/questions/bulk ──────────────────────────────────────────
// Bulk insert a chunk of questions (used by the CSV/JSON importer).
router.post(
  '/questions/bulk',
  asyncH(async (req: AuthedRequest, res) => {
    const rows = req.body?.rows
    if (!Array.isArray(rows)) return res.status(400).json({ error: 'rows[] is required' })
    const { data, error } = await req.db!.rpc('admin_bulk_insert_questions', { p: rows })
    if (error) return sendDbError(res, error)
    res.json({ result: data ?? null })
  })
)

export default router
