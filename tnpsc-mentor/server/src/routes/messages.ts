import { Router } from 'express'
import { asyncH, sendDbError } from '../util.js'
import { requireAuth, type AuthedRequest } from '../middleware/auth.js'
import { supabaseAdmin } from '../supabase.js'
import { notifyAdmins } from '../notify.js'

const router = Router()
router.use(requireAuth)

const THREAD_COLUMNS = 'id, sender, body, body_ta, created_at'

// ─── GET /api/messages ─────────────────────────────────────────────────────
// The student's own thread with the admin team, oldest first. Marks any
// admin-authored messages as read on the way out.
router.get(
  '/',
  asyncH(async (req: AuthedRequest, res) => {
    const { data, error } = await supabaseAdmin
      .from('user_messages')
      .select(THREAD_COLUMNS)
      .eq('user_id', req.userId)
      .order('created_at', { ascending: true })
    if (error) return sendDbError(res, error)

    await supabaseAdmin
      .from('user_messages')
      .update({ read_by_user_at: new Date().toISOString() })
      .eq('user_id', req.userId)
      .eq('sender', 'admin')
      .is('read_by_user_at', null)

    res.json({ messages: data ?? [] })
  })
)

// ─── GET /api/messages/unread-count ────────────────────────────────────────
// Cheap poll target for the header icon's badge — avoids fetching the whole
// thread just to know whether to show a dot.
router.get(
  '/unread-count',
  asyncH(async (req: AuthedRequest, res) => {
    const { count, error } = await supabaseAdmin
      .from('user_messages')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', req.userId)
      .eq('sender', 'admin')
      .is('read_by_user_at', null)
    if (error) return sendDbError(res, error)
    res.json({ count: count ?? 0 })
  })
)

// ─── POST /api/messages ────────────────────────────────────────────────────
// Reply in the student's own thread. Pings admins/superadmins (in-app, no
// push) so a reply doesn't sit unnoticed until someone happens to reopen the
// Users tab — the mirror of how an admin's message pings the student.
router.post(
  '/',
  asyncH(async (req: AuthedRequest, res) => {
    const body = String(req.body?.body ?? '').trim()
    if (!body) return res.status(400).json({ error: 'Message is required.' })
    if (body.length > 4000) return res.status(400).json({ error: 'Message is too long.' })

    const { data, error } = await supabaseAdmin
      .from('user_messages')
      .insert({ user_id: req.userId, sender: 'user', sender_id: req.userId, body })
      .select(THREAD_COLUMNS)
      .single()
    if (error) return sendDbError(res, error)

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('full_name')
      .eq('id', req.userId)
      .maybeSingle()
    const name = (profile?.full_name as string | null) ?? 'A student'
    await notifyAdmins(`New message from ${name}`, body.slice(0, 200), '/superadmin')

    res.status(201).json({ message: data })
  })
)

export default router
