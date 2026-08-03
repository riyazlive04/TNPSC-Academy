import { Router } from 'express'
import { asyncH, sendDbError, isMissingFunction } from '../util.js'
import { requireAuth, type AuthedRequest } from '../middleware/auth.js'
import { normalizeMobile } from '../lib/msg91.js'
import { phoneTakenByOther } from '../lib/phone.js'
import { whatsappOtpEnabled } from '../config.js'
import { verifyPhoneVerifyTicket } from '../lib/otpTicket.js'
import { supabaseAdmin } from '../supabase.js'
import { notifyAdmins } from '../notify.js'

const router = Router()

// ─── GET /api/profile ────────────────────────────────────────────────────────
router.get(
  '/',
  requireAuth,
  asyncH(async (req: AuthedRequest, res) => {
    const { data, error } = await req.db!
      .from('profiles')
      .select('*')
      .eq('id', req.userId)
      .single()
    if (error) return sendDbError(res, error)
    res.json({ profile: data })
  })
)

// ─── PATCH /api/profile ──────────────────────────────────────────────────────
// Update onboarding/goal fields (exam_date, daily_goal, target_group, name…).
router.patch(
  '/',
  requireAuth,
  asyncH(async (req: AuthedRequest, res) => {
    const allowed = ['full_name', 'phone', 'gender', 'target_group', 'exam_date', 'daily_goal', 'language']
    const fields: Record<string, unknown> = {}
    for (const k of allowed) {
      if (k in (req.body ?? {})) fields[k] = req.body[k]
    }
    // One mobile number = one account: block editing to a number another account
    // already owns, and store it normalized (bare 10-digit) for consistent matching.
    if (typeof fields.phone === 'string') {
      const ten = normalizeMobile(fields.phone)
      if (ten && (await phoneTakenByOther(ten, req.userId!))) {
        return res.status(409).json({ error: 'phone_already_registered' })
      }
      // WhatsApp-OTP gate, mirroring /register: when configured, a number can
      // only be ATTACHED to an account with proof of ownership — the ticket
      // issued by /register/otp/verify (or the Telegram fallback). Google
      // signups set their phone HERE (complete-profile) instead of /register,
      // so without this check the gate could be walked around entirely.
      // Clearing the number stakes no ownership claim, so it needs no ticket.
      if (ten && whatsappOtpEnabled) {
        const ticketPhone = verifyPhoneVerifyTicket(String(req.body?.phoneTicket ?? ''))
        if (ticketPhone !== ten) {
          return res.status(403).json({ error: 'phone_not_verified' })
        }
      }
      fields.phone = ten || null
    }
    const { data, error } = await req.db!
      .from('profiles')
      .update(fields)
      .eq('id', req.userId)
      .select('*')
      .single()
    if (error) return sendDbError(res, error)
    res.json({ profile: data })
  })
)

// ─── GET /api/profile/percentile ─────────────────────────────────────────────
router.get(
  '/percentile',
  requireAuth,
  asyncH(async (req: AuthedRequest, res) => {
    const { data, error } = await req.db!.rpc('user_percentile', { p_user: req.userId })
    if (error) return sendDbError(res, error)
    res.json({ percentile: data == null ? null : Math.round(Number(data)) })
  })
)

// ─── GET /api/profile/activity?days=60 ───────────────────────────────────────
// Daily-activity rows for streak/goal computation (done client-side).
router.get(
  '/activity',
  requireAuth,
  asyncH(async (req: AuthedRequest, res) => {
    // Clamp days to a sane range — an unvalidated `days=abc` yielded NaN, which
    // made setDate(getDate() - NaN) produce an Invalid Date and a bad query.
    const days = Math.min(Math.max(Math.trunc(Number(req.query.days)) || 60, 1), 365)
    const since = new Date()
    since.setDate(since.getDate() - days)
    const sinceIso = since.toISOString().slice(0, 10)
    const { data, error } = await req.db!
      .from('daily_activity')
      .select('activity_date,questions,tests')
      .eq('user_id', req.userId)
      .gte('activity_date', sinceIso)
      .order('activity_date', { ascending: true })
    if (error) return sendDbError(res, error)
    res.json({ rows: data ?? [] })
  })
)

// ─── POST /api/profile/activity ──────────────────────────────────────────────
// Increment today's activity counters (read-modify-write done server-side).
router.post(
  '/activity',
  requireAuth,
  asyncH(async (req: AuthedRequest, res) => {
    const questions = Math.max(Math.trunc(Number(req.body?.questions)) || 0, 0)
    const tests = Math.max(Math.trunc(Number(req.body?.tests ?? 1)) || 0, 0)
    // Atomic increment in the DB (increment_activity RPC) — the old read in JS,
    // add, then write pattern lost increments under concurrent submits.
    const { error } = await req.db!.rpc('increment_activity', {
      p_questions: questions,
      p_tests: tests,
    })
    if (!error) return res.json({ ok: true })
    if (!isMissingFunction(error)) return sendDbError(res, error)

    // Fallback (RPC not migrated yet): non-atomic read-modify-write.
    const today = new Date().toISOString().slice(0, 10)
    const { data: existing } = await req.db!
      .from('daily_activity')
      .select('questions,tests')
      .eq('user_id', req.userId)
      .eq('activity_date', today)
      .maybeSingle()
    const prevQ = (existing?.questions as number) ?? 0
    const prevT = (existing?.tests as number) ?? 0
    const { error: e2 } = await req.db!.from('daily_activity').upsert(
      { user_id: req.userId, activity_date: today, questions: prevQ + questions, tests: prevT + tests },
      { onConflict: 'user_id,activity_date' }
    )
    if (e2) return sendDbError(res, e2)
    res.json({ ok: true })
  })
)

// ─── DELETE /api/profile/account ─────────────────────────────────────────────
// Self-service account deletion. MANDATORY for both stores: Apple guideline
// 5.1.1(v) and Google Play's User Data policy each require an app that offers
// account creation to also offer in-app deletion of the account AND its data —
// deactivation or "email us" is explicitly not enough.
//
// Deleting the auth user is sufficient to delete everything: every user-owned
// table references auth.users(id) ON DELETE CASCADE, including profiles once
// supabase/delete_user.sql has been applied. That single call therefore takes
// test attempts, answers, bookmarks, revision decks, credits, seen-question
// ledgers, device sessions, push subscriptions and payment rows with it.
//
// Staff are refused: an admin deleting themselves through the learner UI is
// almost certainly a mistake, and a superadmin doing it can lock the platform
// out of its own console.
router.delete(
  '/account',
  requireAuth,
  asyncH(async (req: AuthedRequest, res) => {
    const userId = req.userId!

    const { data: me, error: lookupErr } = await supabaseAdmin
      .from('profiles')
      .select('role, email')
      .eq('id', userId)
      .single()
    if (lookupErr) return sendDbError(res, lookupErr)

    if (me?.role === 'admin' || me?.role === 'superadmin') {
      return res.status(403).json({
        error:
          'Staff accounts cannot be deleted from the app. Ask a superadmin to remove this account.',
      })
    }

    // Deleting the auth user invalidates every issued refresh token for it, so a
    // session still live on the user's other device dies with this call — no
    // separate revocation pass needed.
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)
    if (error) return res.status(500).json({ error: error.message })

    // Passive audit trail — the row itself is gone, so this is the only record
    // that the deletion happened at the user's own request.
    await notifyAdmins(
      'Account deleted by user',
      `${me?.email ?? userId} deleted their own account from the app.`
    ).catch(() => {})

    res.json({ deleted: true })
  })
)

export default router
