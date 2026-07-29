import { Router } from 'express'
import { asyncH, sendDbError } from '../util.js'
import { requireAuth, requireAdmin, type AuthedRequest } from '../middleware/auth.js'
import { notifyReportResolved } from '../lib/reportResolved.js'

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

// ─── POST /api/admin/questions/active ────────────────────────────────────────
// Enable/disable a single question for students (toggles questions.active).
// active=false hides it from quizzes/revision but keeps it in the admin bank.
router.post(
  '/questions/active',
  asyncH(async (req: AuthedRequest, res) => {
    const { id, active } = req.body ?? {}
    if (!id || typeof active !== 'boolean') {
      return res.status(400).json({ error: 'id and active (boolean) are required' })
    }
    const { data, error } = await req.db!.rpc('admin_set_question_active', { p_id: id, p_active: active })
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
    // Cap the chunk size — the importer should page large files; an unbounded
    // array would balloon RPC work/memory in one request.
    if (rows.length > 500) {
      return res.status(400).json({ error: 'Too many rows (max 500 per request).' })
    }
    const { data, error } = await req.db!.rpc('admin_bulk_insert_questions', { p: rows })
    if (error) return sendDbError(res, error)
    res.json({ result: data ?? null })
  })
)

// ─── Question reports (student "mark for correction" triage) ─────────────────
// Students flag questions during a test (see /api/feedback/question-report);
// these routes let admins + superadmins read those flags, jump to the offending
// question, and resolve / dismiss them. The RPCs are is_admin()-gated server-side.

// GET /api/admin/question-reports?status=open|resolved|dismissed&limit=
router.get(
  '/question-reports',
  asyncH(async (req: AuthedRequest, res) => {
    const status = req.query.status ? String(req.query.status) : 'open'
    if (!['open', 'resolved', 'dismissed'].includes(status)) {
      return res.status(400).json({ error: `Invalid status: ${status}` })
    }
    const limit = Math.min(Math.max(Math.trunc(Number(req.query.limit)) || 200, 1), 1000)
    const { data, error } = await req.db!.rpc('admin_list_question_reports', {
      p_status: status,
      p_limit: limit,
    })
    if (error) return sendDbError(res, error)
    res.json({ reports: data ?? [] })
  })
)

// GET /api/admin/question-reports/count — number of currently-open reports.
router.get(
  '/question-reports/count',
  asyncH(async (req: AuthedRequest, res) => {
    const { data, error } = await req.db!.rpc('admin_count_open_reports')
    if (error) return sendDbError(res, error)
    res.json({ count: data ?? 0 })
  })
)

// POST /api/admin/question-reports/status — set triage state for one question.
router.post(
  '/question-reports/status',
  asyncH(async (req: AuthedRequest, res) => {
    const questionId = String(req.body?.questionId ?? '').trim()
    const status = String(req.body?.status ?? '')
    const note: string | null = req.body?.note?.toString().slice(0, 1000).trim() || null
    if (!questionId) return res.status(400).json({ error: 'questionId is required' })
    if (!['open', 'resolved', 'dismissed'].includes(status)) {
      return res.status(400).json({ error: `Invalid status: ${status}` })
    }
    const { data, error } = await req.db!.rpc('admin_set_report_status', {
      p_question_id: questionId,
      p_status: status,
      p_note: note,
    })
    if (error) return sendDbError(res, error)

    // Close the loop with the students who flagged it. Awaited so the console can
    // report how many were messaged; the helper never throws, so a notification
    // failure can't turn a successful triage into an error response.
    const notified = status === 'resolved' ? await notifyReportResolved(questionId, note) : 0
    res.json({ status: data, notified })
  })
)

export default router
