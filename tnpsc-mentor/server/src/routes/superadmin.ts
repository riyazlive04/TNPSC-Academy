import express, { Router } from 'express'
import { asyncH, sendDbError } from '../util.js'
import { requireAuth, requireSuperadmin, type AuthedRequest } from '../middleware/auth.js'
import { supabaseAdmin } from '../supabase.js'
import { listSessions, revokeSessionById } from '../sessions.js'
import { APK_BUCKET, apkPublicUrl, type ReleaseRow } from '../lib/appReleases.js'
import { readAllSettings, writeSetting, WRITABLE_SETTING_KEYS } from '../lib/settings.js'
import { notifyUser } from '../notify.js'
import { KNOWN_PLANS } from '../pricing.js'
import { TEST_SERIES_CONFIG, resolveSeries } from '../lib/testSeriesCatalog.js'

const router = Router()

// All routes require an authenticated superadmin. The underlying RPCs are also
// is_superadmin()-gated server-side, so this is defence in depth.
router.use(requireAuth, requireSuperadmin)

// ─── GET /api/superadmin/metrics ─────────────────────────────────────────────
router.get(
  '/metrics',
  asyncH(async (req: AuthedRequest, res) => {
    const { data, error } = await req.db!.rpc('get_platform_metrics')
    if (error) return sendDbError(res, error)
    res.json({ metrics: data ?? {} })
  })
)

// ─── GET /api/superadmin/revenue ─────────────────────────────────────────────
router.get(
  '/revenue',
  asyncH(async (req: AuthedRequest, res) => {
    const { data, error } = await req.db!.rpc('get_revenue_metrics')
    if (error) return sendDbError(res, error)
    res.json({ revenue: data ?? {} })
  })
)

// ─── GET /api/superadmin/users?search=&limit=&offset= ────────────────────────
// One page of accounts plus `total`, the size of the whole filtered set. The
// console pages until it holds every account — before this it asked for 200 and
// had no way to learn that there were more, so the tail of the user table was
// invisible.
router.get(
  '/users',
  asyncH(async (req: AuthedRequest, res) => {
    const limit = Math.min(Math.max(Math.trunc(Number(req.query.limit)) || 200, 1), 1000)
    const offset = Math.max(Math.trunc(Number(req.query.offset)) || 0, 0)
    const search = req.query.search ? String(req.query.search) : null
    const { data, error } = await req.db!.rpc('superadmin_list_users', {
      p_limit: limit,
      p_search: search,
      p_offset: offset,
    })
    if (error) return sendDbError(res, error)
    // `total` rides on every row (a window function); lift it out rather than
    // repeating it down the wire to the client.
    const rows = (data ?? []) as ({ total?: number | string } & Record<string, unknown>)[]
    const total = rows.length ? Number(rows[0].total ?? rows.length) : 0
    res.json({
      users: rows.map(({ total: _total, ...u }) => u),
      total,
    })
  })
)

// ─── POST /api/superadmin/users/role ─────────────────────────────────────────
router.post(
  '/users/role',
  asyncH(async (req: AuthedRequest, res) => {
    const { userId, role } = req.body ?? {}
    if (!userId || !role) {
      return res.status(400).json({ error: 'userId and role are required' })
    }
    // Allow-list the role before it reaches the RPC (the RPC also validates,
    // but reject obviously-bad input early with a clear message).
    if (!['user', 'admin', 'superadmin'].includes(role)) {
      return res.status(400).json({ error: `Invalid role: ${role}` })
    }
    const { data, error } = await req.db!.rpc('superadmin_set_role', {
      p_user: userId,
      p_role: role,
    })
    if (error) return sendDbError(res, error)
    res.json({ user: data })
  })
)

// ─── POST /api/superadmin/users/revoke-premium ───────────────────────────────
// Withdraw a user's premium: flips their paid payment rows to 'revoked', which
// the premium computation (status = 'paid') then excludes. Returns the count.
router.post(
  '/users/revoke-premium',
  asyncH(async (req: AuthedRequest, res) => {
    const { userId } = req.body ?? {}
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' })
    }
    const { data, error } = await req.db!.rpc('superadmin_revoke_premium', {
      p_user: userId,
    })
    if (error) return sendDbError(res, error)
    res.json({ revoked: Number(data ?? 0) })
  })
)

// ─── POST /api/superadmin/users/revoke-vettri ────────────────────────────────
// Withdraw a user's Vettri Nichayam: flips their paid vettri rows (full +
// monthly plan) to 'revoked'. Premium rows are untouched.
router.post(
  '/users/revoke-vettri',
  asyncH(async (req: AuthedRequest, res) => {
    const { userId } = req.body ?? {}
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' })
    }
    const { data, error } = await req.db!.rpc('superadmin_revoke_vettri', {
      p_user: userId,
    })
    if (error) return sendDbError(res, error)
    res.json({ revoked: Number(data ?? 0) })
  })
)

// ─── POST /api/superadmin/users/revoke-rank-booster ──────────────────────────
// Withdraw a user's Group II/IIA Rank Booster plan. Premium/Vettri untouched.
router.post(
  '/users/revoke-rank-booster',
  asyncH(async (req: AuthedRequest, res) => {
    const { userId } = req.body ?? {}
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' })
    }
    const { data, error } = await req.db!.rpc('superadmin_revoke_rank_booster', {
      p_user: userId,
    })
    if (error) return sendDbError(res, error)
    res.json({ revoked: Number(data ?? 0) })
  })
)

// ─── POST /api/superadmin/users/grant-plan ───────────────────────────────────
// Comp a plan: inserts a ₹0 'paid' ledger row (same shape as a 100%-off coupon
// order), so the normal computed entitlement grants access for the plan's own
// validity window starting now.
router.post(
  '/users/grant-plan',
  asyncH(async (req: AuthedRequest, res) => {
    const { userId, plan } = req.body ?? {}
    if (!userId || !plan) {
      return res.status(400).json({ error: 'userId and plan are required' })
    }
    // Allow-list before the RPC (which validates again) for a clear message.
    if (!KNOWN_PLANS.has(plan)) {
      return res.status(400).json({ error: `Invalid plan: ${plan}` })
    }
    const { error } = await req.db!.rpc('superadmin_grant_plan', {
      p_user: userId,
      p_plan: plan,
    })
    if (error) return sendDbError(res, error)
    res.json({ granted: true })
  })
)

// ─── POST /api/superadmin/users/delete ───────────────────────────────────────
// Hard-delete a user: removes the auth account (GoTrue admin API), which
// cascades the profile + every user-owned row. Guards prevent deleting yourself
// or any superadmin (demote them first) — both are easy ways to lock the
// platform out of administration.
router.post(
  '/users/delete',
  asyncH(async (req: AuthedRequest, res) => {
    const { userId } = req.body ?? {}
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' })
    }
    if (userId === req.userId) {
      return res.status(400).json({ error: 'You cannot delete your own account.' })
    }

    // Don't let a superadmin be deleted out from under the console.
    const { data: target, error: lookupErr } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single()
    if (lookupErr || !target) {
      return res.status(404).json({ error: 'User not found' })
    }
    if (target.role === 'superadmin') {
      return res.status(400).json({ error: 'Demote this superadmin before deleting.' })
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)
    if (error) return res.status(500).json({ error: error.message })
    res.json({ deleted: true })
  })
)

// ─── GET /api/superadmin/users/:userId/sessions ──────────────────────────────
// A user's active device sessions (where they're signed in) for the console's
// "Devices" view. Reuses listSessions (service-role read; filters revoked +
// idle-expired rows). The raw device_id / session key is stripped — the console
// only needs the opaque row `id` (to sign out) plus display fields.
router.get(
  '/users/:userId/sessions',
  asyncH(async (req: AuthedRequest, res) => {
    const userId = String(req.params.userId)
    if (!userId) return res.status(400).json({ error: 'userId is required' })
    const list = await listSessions(userId)
    const sessions = list.map((d) => ({
      id: d.id,
      label: d.label,
      created_at: d.created_at,
      last_seen_at: d.last_seen_at,
    }))
    res.json({ sessions })
  })
)

// ─── GET /api/superadmin/users/:userId/insights ──────────────────────────────
// Activity + credit snapshot for the console's user-detail popup: study time,
// per-subject / per-section practice breakdown (accuracy = the weakness
// signal), and the credit balance + lifetime usage from the ledger.
router.get(
  '/users/:userId/insights',
  asyncH(async (req: AuthedRequest, res) => {
    const userId = String(req.params.userId)
    if (!userId) return res.status(400).json({ error: 'userId is required' })
    const { data, error } = await req.db!.rpc('superadmin_user_insights', { p_user: userId })
    if (error) return sendDbError(res, error)
    res.json({ insights: data ?? null })
  })
)

// ─── POST /api/superadmin/users/sessions/revoke ──────────────────────────────
// Remotely sign a user out of one device. revokeSessionById is scoped to the
// (userId, id) pair, so a mismatched id is a no-op rather than a cross-account
// sign-out. The device logs out on its next token refresh.
router.post(
  '/users/sessions/revoke',
  asyncH(async (req: AuthedRequest, res) => {
    const { userId, id } = req.body ?? {}
    if (!userId || !id) {
      return res.status(400).json({ error: 'userId and id are required' })
    }
    await revokeSessionById(String(userId), String(id))
    res.json({ ok: true })
  })
)

// ─── App / APK releases ──────────────────────────────────────────────────────
// Superadmins upload the Android build here; the newest upload is what the
// public /api/app/* endpoints serve. See server/src/lib/appReleases.ts.

const APK_MIME = 'application/vnd.android.package-archive'
const MAX_APK_BYTES = 150 * 1024 * 1024 // 150 MB — generous headroom over a ~5 MB build.

/** Shape a DB row for the client, attaching the public download URL. */
function withUrl(r: ReleaseRow) {
  return {
    id: r.id,
    version_name: r.version_name,
    file_name: r.file_name,
    file_size: r.file_size,
    notes: r.notes,
    created_at: r.created_at,
    url: apkPublicUrl(r.storage_path),
  }
}

// ─── GET /api/superadmin/apk ─────────────────────────────────────────────────
// Full version history, newest first.
router.get(
  '/apk',
  asyncH(async (_req: AuthedRequest, res) => {
    const { data, error } = await supabaseAdmin
      .from('app_releases')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) return sendDbError(res, error)
    res.json({ releases: (data as ReleaseRow[]).map(withUrl) })
  })
)

// ─── POST /api/superadmin/apk?version=&notes= ────────────────────────────────
// The .apk binary is the raw request body (Content-Type ignored). express.raw
// buffers it for THIS route only — the global JSON parser skips it because the
// body isn't application/json. Version + notes ride in the query string and the
// original filename in the x-file-name header.
router.post(
  '/apk',
  express.raw({ type: () => true, limit: '160mb' }),
  asyncH(async (req: AuthedRequest, res) => {
    const versionName = String(req.query.version ?? '').trim()
    const notes = String(req.query.notes ?? '').trim() || null
    const rawName = String(req.headers['x-file-name'] ?? '').trim()

    if (!versionName) {
      return res.status(400).json({ error: 'A version name is required.' })
    }
    const body = req.body
    if (!Buffer.isBuffer(body) || body.length === 0) {
      return res.status(400).json({ error: 'No file was uploaded.' })
    }
    if (body.length > MAX_APK_BYTES) {
      return res.status(413).json({ error: 'That file is too large (max 150 MB).' })
    }
    if (rawName && !/\.apk$/i.test(rawName)) {
      return res.status(400).json({ error: 'Only .apk files are accepted.' })
    }

    // Clean version → safe filename so the cross-origin download gets a tidy name
    // (e.g. TNPSC-Mentor-1.0.3.apk). A timestamp folder keeps every upload unique.
    const safeVersion = versionName.replace(/[^a-zA-Z0-9.\-_]/g, '-')
    const fileName = `TNPSC-Mentor-${safeVersion}.apk`
    const storagePath = `releases/${Date.now()}/${fileName}`

    const { error: upErr } = await supabaseAdmin.storage
      .from(APK_BUCKET)
      .upload(storagePath, body, { contentType: APK_MIME, upsert: false })
    if (upErr) {
      console.error('[apk upload]', upErr)
      return res.status(502).json({ error: 'Upload to storage failed. Please try again.' })
    }

    const { data, error } = await supabaseAdmin
      .from('app_releases')
      .insert({
        version_name: versionName,
        file_name: fileName,
        storage_path: storagePath,
        file_size: body.length,
        notes,
        created_by: req.userId ?? null,
      })
      .select('*')
      .single()
    if (error) {
      // Roll back the orphaned object so a failed insert doesn't leave a dangling file.
      await supabaseAdmin.storage.from(APK_BUCKET).remove([storagePath])
      return sendDbError(res, error)
    }

    res.status(201).json({ release: withUrl(data as ReleaseRow) })
  })
)

// ─── DELETE /api/superadmin/apk/:id ──────────────────────────────────────────
// Remove a release (deletes the row + its stored binary). Deleting the current
// build promotes the previous one — i.e. a one-click rollback.
router.delete(
  '/apk/:id',
  asyncH(async (req: AuthedRequest, res) => {
    const id = String(req.params.id)
    const { data: row, error: lookupErr } = await supabaseAdmin
      .from('app_releases')
      .select('storage_path')
      .eq('id', id)
      .maybeSingle()
    if (lookupErr) return sendDbError(res, lookupErr)
    if (!row) return res.status(404).json({ error: 'Release not found.' })

    await supabaseAdmin.storage.from(APK_BUCKET).remove([(row as ReleaseRow).storage_path])
    const { error } = await supabaseAdmin.from('app_releases').delete().eq('id', id)
    if (error) return sendDbError(res, error)
    res.json({ deleted: true })
  })
)

// ─── GET /api/superadmin/feedback?limit= ─────────────────────────────────────
router.get(
  '/feedback',
  asyncH(async (req: AuthedRequest, res) => {
    const limit = Math.min(Math.max(Math.trunc(Number(req.query.limit)) || 100, 1), 1000)
    const { data, error } = await req.db!.rpc('list_app_feedback', { p_limit: limit })
    if (error) return sendDbError(res, error)
    res.json({ feedback: data ?? [] })
  })
)

// ─── GET /api/superadmin/mock-exams ──────────────────────────────────────────
// All exams (incl. disabled), each with the count of questions actually loaded
// for its mock_set, so the console can warn if a set is empty/short.
router.get(
  '/mock-exams',
  asyncH(async (req: AuthedRequest, res) => {
    const { data: exams, error } = await req.db!
      .from('mock_exams')
      .select(
        'id, mock_set, title, title_ta, total_questions, duration_seconds, negative_mark, tier, enabled, sort_order'
      )
      .order('sort_order')
    if (error) return sendDbError(res, error)

    const { data: rows, error: cErr } = await req.db!
      .from('questions')
      .select('mock_set')
      .eq('category', 'mock')
    if (cErr) return sendDbError(res, cErr)
    const loaded: Record<number, number> = {}
    for (const r of (rows ?? []) as { mock_set: number }[]) {
      loaded[r.mock_set] = (loaded[r.mock_set] ?? 0) + 1
    }

    const result = ((exams ?? []) as { mock_set: number }[]).map((e) => ({
      ...e,
      loaded_questions: loaded[e.mock_set] ?? 0,
    }))
    res.json({ exams: result })
  })
)

// ─── POST /api/superadmin/mock-exams/:id ─────────────────────────────────────
// Patch an exam's gating/metadata via the is_admin()-gated RPC. Only the fields
// present in the body are changed (the RPC treats null as "leave unchanged").
router.post(
  '/mock-exams/:id',
  asyncH(async (req: AuthedRequest, res) => {
    const { enabled, tier, title, duration_seconds, negative_mark } = req.body ?? {}
    if (tier != null && tier !== 'free' && tier !== 'paid') {
      return res.status(400).json({ error: `Invalid tier: ${tier}` })
    }
    const { data, error } = await req.db!.rpc('admin_set_mock_exam', {
      p_id: req.params.id,
      p_enabled: typeof enabled === 'boolean' ? enabled : null,
      p_tier: tier ?? null,
      p_title: title ?? null,
      p_duration_seconds:
        duration_seconds == null ? null : Math.trunc(Number(duration_seconds)),
      p_negative_mark: negative_mark == null ? null : Number(negative_mark),
    })
    if (error) return sendDbError(res, error)
    res.json({ exam: data })
  })
)

// ─── GET /api/superadmin/test-series ──────────────────────────────────────────
// All tests for ONE series (incl. disabled), each with the count of questions
// actually loaded for its test_set, so the console can warn if a set is
// empty/short. `series` defaults to the original Group 1 Marathon.
router.get(
  '/test-series',
  asyncH(async (req: AuthedRequest, res) => {
    const series = resolveSeries(req.query.series)
    if (!series) return res.status(400).json({ error: 'unknown series' })
    const config = TEST_SERIES_CONFIG[series]

    const { data: tests, error } = await req.db!
      .from('test_series')
      .select(
        'id, test_set, title, title_ta, unit_label, subjects_label, total_questions, duration_seconds, negative_mark, scheduled_date, enabled, open_override, sort_order, tier'
      )
      .eq('series', series)
      .order('sort_order')
    if (error) return sendDbError(res, error)

    const { data: rows, error: cErr } = await req.db!
      .from('questions')
      .select('test_set')
      .eq('category', config.category)
    if (cErr) return sendDbError(res, cErr)
    const loaded: Record<number, number> = {}
    for (const r of (rows ?? []) as { test_set: number }[]) {
      loaded[r.test_set] = (loaded[r.test_set] ?? 0) + 1
    }

    const result = ((tests ?? []) as { test_set: number }[]).map((tst) => ({
      ...tst,
      loaded_questions: loaded[tst.test_set] ?? 0,
    }))
    res.json({ tests: result })
  })
)

// ─── POST /api/superadmin/test-series/:id ────────────────────────────────────
// Patch a test's gating/schedule via the is_admin()-gated RPC. Only the fields
// present in the body are changed (the RPC treats null as "leave unchanged").
// `id` is globally unique across every series, so no `series` param is needed
// to disambiguate which row to patch.
router.post(
  '/test-series/:id',
  asyncH(async (req: AuthedRequest, res) => {
    const { enabled, open_override, scheduled_date, duration_seconds, negative_mark, title, tier } =
      req.body ?? {}
    if (
      open_override != null &&
      open_override !== 'auto' &&
      open_override !== 'open' &&
      open_override !== 'closed'
    ) {
      return res.status(400).json({ error: `Invalid open_override: ${open_override}` })
    }
    if (tier != null && tier !== 'free' && tier !== 'paid') {
      return res.status(400).json({ error: `Invalid tier: ${tier}` })
    }
    const { data, error } = await req.db!.rpc('admin_set_test_series', {
      p_id: req.params.id,
      p_enabled: typeof enabled === 'boolean' ? enabled : null,
      p_open_override: open_override ?? null,
      p_scheduled_date: scheduled_date ?? null,
      p_duration_seconds: duration_seconds == null ? null : Math.trunc(Number(duration_seconds)),
      p_negative_mark: negative_mark == null ? null : Number(negative_mark),
      p_title: title ?? null,
      p_tier: tier ?? null,
    })
    if (error) return sendDbError(res, error)
    res.json({ test: data })
  })
)

// ─── GET /api/superadmin/vettri-exams ────────────────────────────────────────
// All Vettri Nichayam exams (incl. disabled), each with the count of questions
// actually loaded for its vettri_set, so the console can warn on an empty set.
router.get(
  '/vettri-exams',
  asyncH(async (req: AuthedRequest, res) => {
    const { data: exams, error } = await req.db!
      .from('vettri_exams')
      .select(
        'id, vettri_set, title, title_ta, total_questions, duration_seconds, negative_mark, enabled, sort_order'
      )
      .order('sort_order')
    if (error) return sendDbError(res, error)

    const { data: rows, error: cErr } = await req.db!
      .from('questions')
      .select('vettri_set')
      .eq('category', 'vettri')
    if (cErr) return sendDbError(res, cErr)
    const loaded: Record<number, number> = {}
    for (const r of (rows ?? []) as { vettri_set: number }[]) {
      loaded[r.vettri_set] = (loaded[r.vettri_set] ?? 0) + 1
    }

    const result = ((exams ?? []) as { vettri_set: number }[]).map((e) => ({
      ...e,
      loaded_questions: loaded[e.vettri_set] ?? 0,
    }))
    res.json({ exams: result })
  })
)

// ─── POST /api/superadmin/vettri-exams/:id ───────────────────────────────────
// Patch a Vettri exam's gating/metadata via the is_admin()-gated RPC. Only the
// fields present in the body are changed (the RPC treats null as "leave as is").
router.post(
  '/vettri-exams/:id',
  asyncH(async (req: AuthedRequest, res) => {
    const { enabled, title, total_questions, duration_seconds, negative_mark } = req.body ?? {}
    const { data, error } = await req.db!.rpc('admin_set_vettri_exam', {
      p_id: req.params.id,
      p_enabled: typeof enabled === 'boolean' ? enabled : null,
      p_title: title ?? null,
      p_total_questions: total_questions == null ? null : Math.trunc(Number(total_questions)),
      p_duration_seconds: duration_seconds == null ? null : Math.trunc(Number(duration_seconds)),
      p_negative_mark: negative_mark == null ? null : Number(negative_mark),
    })
    if (error) return sendDbError(res, error)
    res.json({ exam: data })
  })
)

// ─── GET /api/superadmin/settings ────────────────────────────────────────────
// All app-settings rows as a raw key→value map.
router.get(
  '/settings',
  asyncH(async (_req: AuthedRequest, res) => {
    res.json({ settings: await readAllSettings() })
  })
)

// ─── POST /api/superadmin/settings ───────────────────────────────────────────
// Upsert one setting. Key must be in the writable allow-list.
router.post(
  '/settings',
  asyncH(async (req: AuthedRequest, res) => {
    const { key, value } = req.body ?? {}
    if (!key || !WRITABLE_SETTING_KEYS.includes(String(key))) {
      return res.status(400).json({ error: `Unknown setting key: ${key}` })
    }
    const stored = await writeSetting(String(key), value)
    res.json({ key, value: stored })
  })
)

// ─── Direct messaging: superadmin ↔ one student, a shared thread ────────────
// Replaces the old one-way POST /message-user (single fire-and-forget note,
// used by ContactReporter to clarify a question report). This is the general
// "message any user" surface for the Users tab, and a real two-way thread: the
// student can reply from their own /messages page (see routes/messages.ts),
// and ContactReporter now posts into the SAME thread so a report follow-up and
// a Users-tab conversation are one inbox per student, not two.

const THREAD_COLUMNS = 'id, sender, sender_id, body, body_ta, created_at'

// ─── GET /api/superadmin/messages/:userId ────────────────────────────────────
router.get(
  '/messages/:userId',
  asyncH(async (req: AuthedRequest, res) => {
    const userId = req.params.userId

    const { data: target, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name')
      .eq('id', userId)
      .maybeSingle()
    if (profileError) return sendDbError(res, profileError)
    if (!target) return res.status(404).json({ error: 'No such user.' })

    const { data, error } = await supabaseAdmin
      .from('user_messages')
      .select(THREAD_COLUMNS)
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
    if (error) return sendDbError(res, error)

    await supabaseAdmin
      .from('user_messages')
      .update({ read_by_admin_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('sender', 'user')
      .is('read_by_admin_at', null)

    res.json({ messages: data ?? [], name: target.full_name ?? null })
  })
)

// ─── POST /api/superadmin/messages/:userId ───────────────────────────────────
// Sends as the acting superadmin (sender_id), and pings the student via the
// existing notifyUser bell + Web Push, deep-linked to their Messages page.
router.post(
  '/messages/:userId',
  asyncH(async (req: AuthedRequest, res) => {
    const userId = req.params.userId
    const body = String(req.body?.body ?? '').trim()
    const bodyTa = String(req.body?.body_ta ?? '').trim() || null
    if (!body) return res.status(400).json({ error: 'Message is required.' })
    if (body.length > 4000) return res.status(400).json({ error: 'Message is too long.' })

    const { data: target, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name')
      .eq('id', userId)
      .maybeSingle()
    if (profileError) return sendDbError(res, profileError)
    if (!target) return res.status(404).json({ error: 'No such user.' })

    const { data, error } = await supabaseAdmin
      .from('user_messages')
      .insert({ user_id: userId, sender: 'admin', sender_id: req.userId, body, body_ta: bodyTa })
      .select(THREAD_COLUMNS)
      .single()
    if (error) return sendDbError(res, error)

    await notifyUser(userId, {
      title: 'New message from TNPSC Mentors',
      title_ta: 'TNPSC Mentors இடமிருந்து புதிய செய்தி',
      body: body.slice(0, 200),
      body_ta: bodyTa ? bodyTa.slice(0, 200) : null,
      url: '/messages',
    })

    res.status(201).json({ message: data })
  })
)

export default router
