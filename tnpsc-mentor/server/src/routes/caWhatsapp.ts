// ─── /api/ca-whatsapp — get a CA issue ready for the WhatsApp Channel ─────────
// WhatsApp Channels have no posting API (confirmed against Meta's own docs —
// a Channel is admin-post-only with no Graph API endpoint), so unlike
// /api/ca-telegram there is nothing here that sends anything. A superadmin
// copies a caption and downloads a PDF (rendered client-side, same as the
// Telegram flow — see src/lib/magazinePdf.ts), pastes both into the WhatsApp
// Business app by hand, then marks the language as posted. This route is just
// the caption templates plus that "marked posted" log.
//
// Caption copy lives in app_settings (editable here, no redeploy) and supports
// {date} {items} {link} {name} placeholders, same tokens as the Telegram tab.

import { Router } from 'express'
import { asyncH, sendDbError } from '../util.js'
import { requireAuth, requireSuperadmin, type AuthedRequest } from '../middleware/auth.js'
import { supabaseAdmin } from '../supabase.js'
import { readSettingString, writeSetting } from '../lib/settings.js'

const router = Router()

const admin = [requireAuth, requireSuperadmin] as const

const CA_TYPES = new Set(['day_wise', 'month_wise'])
const LANGS = new Set(['en', 'ta'])
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

const SETTING_CAPTION_EN = 'whatsapp_ca_caption_en'
const SETTING_CAPTION_TA = 'whatsapp_ca_caption_ta'

// Same defaults the migration seeds — kept here so a fresh environment with no
// app_settings rows still shows sensible copy in the console. WhatsApp captions
// use *asterisks* for bold (no HTML), unlike the Telegram copy.
const DEFAULT_CAPTION_EN =
  '📘 *Current Affairs — {date}*\n{items} news items, exam-ready.\n\n' +
  'Daily current affairs, PYQs and mock tests: {link}'
const DEFAULT_CAPTION_TA =
  '📘 *நடப்பு நிகழ்வுகள் — {date}*\n{items} செய்திகள், தேர்வுக்குத் தயார்.\n\n' +
  'தினசரி நடப்பு நிகழ்வுகள், PYQ மற்றும் மாதிரித் தேர்வுகள்: {link}'

function badIssue(caType: string, date: string): boolean {
  return !CA_TYPES.has(caType) || !DATE_RE.test(date)
}

// ─── GET /api/ca-whatsapp/admin/config ───────────────────────────────────────
router.get(
  '/admin/config',
  ...admin,
  asyncH(async (_req: AuthedRequest, res) => {
    const [captionEn, captionTa] = await Promise.all([
      readSettingString(SETTING_CAPTION_EN, DEFAULT_CAPTION_EN),
      readSettingString(SETTING_CAPTION_TA, DEFAULT_CAPTION_TA),
    ])
    res.json({ captions: { en: captionEn, ta: captionTa } })
  })
)

// ─── PUT /api/ca-whatsapp/admin/config ───────────────────────────────────────
// Only keys present in the body are written, so the dialog can save one
// language's template on its own.
router.put(
  '/admin/config',
  ...admin,
  asyncH(async (req: AuthedRequest, res) => {
    const b = req.body ?? {}
    const writes: Promise<unknown>[] = []
    for (const [key, field] of [
      [SETTING_CAPTION_EN, 'caption_en'],
      [SETTING_CAPTION_TA, 'caption_ta'],
    ] as const) {
      const v = b[field]
      if (typeof v !== 'string') continue
      writes.push(writeSetting(key, v))
    }
    if (!writes.length) return res.status(400).json({ error: 'Nothing to update.' })
    await Promise.all(writes)

    const [captionEn, captionTa] = await Promise.all([
      readSettingString(SETTING_CAPTION_EN, DEFAULT_CAPTION_EN),
      readSettingString(SETTING_CAPTION_TA, DEFAULT_CAPTION_TA),
    ])
    res.json({ captions: { en: captionEn, ta: captionTa } })
  })
)

// ─── GET /api/ca-whatsapp/admin/posts?ca_type=&date= ─────────────────────────
// What has already been marked posted for an issue.
router.get(
  '/admin/posts',
  ...admin,
  asyncH(async (req: AuthedRequest, res) => {
    const caType = String(req.query.ca_type ?? '')
    const date = String(req.query.date ?? '')
    if (badIssue(caType, date)) return res.status(400).json({ error: 'Invalid issue reference.' })

    const { data, error } = await supabaseAdmin
      .from('ca_whatsapp_posts')
      .select('id, lang, caption, sent_at')
      .eq('ca_type', caType)
      .eq('date', date)
      .order('sent_at', { ascending: false })
      .limit(20)
    if (error) return sendDbError(res, error)
    res.json({ posts: data ?? [] })
  })
)

// ─── GET /api/ca-whatsapp/admin/sent ─────────────────────────────────────────
// The latest mark per (issue, language) across all issues, for the issue
// list's "posted" chips — one round trip instead of one per row.
router.get(
  '/admin/sent',
  ...admin,
  asyncH(async (_req: AuthedRequest, res) => {
    const { data, error } = await supabaseAdmin
      .from('ca_whatsapp_posts')
      .select('ca_type, date, lang, sent_at')
      .order('sent_at', { ascending: false })
      .limit(500)
    if (error) return sendDbError(res, error)

    // Newest first, so the first row seen for a key IS the latest mark.
    const latest: Record<string, { en?: string; ta?: string }> = {}
    for (const r of (data ?? []) as { ca_type: string; date: string; lang: 'en' | 'ta'; sent_at: string }[]) {
      const key = `${r.ca_type}|${r.date}`
      const entry = (latest[key] ??= {})
      entry[r.lang] ??= r.sent_at
    }
    res.json({ sent: latest })
  })
)

// ─── POST /api/ca-whatsapp/admin/mark-sent ───────────────────────────────────
// Log that one language of one issue was posted to the Channel by hand.
router.post(
  '/admin/mark-sent',
  ...admin,
  asyncH(async (req: AuthedRequest, res) => {
    const b = req.body ?? {}
    const caType = String(b.ca_type ?? '')
    const date = String(b.date ?? '')
    const lang = String(b.lang ?? '')
    if (badIssue(caType, date)) return res.status(400).json({ error: 'Invalid issue reference.' })
    if (!LANGS.has(lang)) return res.status(400).json({ error: 'Invalid language.' })
    const caption = typeof b.caption === 'string' ? b.caption : ''
    if (!caption.trim()) return res.status(400).json({ error: 'The caption is empty.' })

    const { data, error } = await supabaseAdmin
      .from('ca_whatsapp_posts')
      .insert({ ca_type: caType, date, lang, caption, sent_by: req.userId })
      .select('id, lang, caption, sent_at')
      .single()
    if (error) return sendDbError(res, error)
    res.status(201).json({ post: data })
  })
)

export default router
