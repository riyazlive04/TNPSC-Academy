// ─── /api/ca-telegram — publish a CA issue to the Telegram channel ───────────
// A superadmin sends an approved current-affairs issue to t.me/tnpscmentors as
// two documents: the English PDF and the Tamil PDF, each with its own caption.
//
// Why the browser uploads the file: jsPDF cannot shape Tamil, so every PDF in
// this app is rendered in the browser (HTML → html2canvas → jsPDF) — see
// src/lib/magazinePdf.ts. The console builds both PDFs, POSTs each to /upload
// (raw body, like the materials/APK uploads), and then calls /send. The
// uploaded file is archived in the private ca-deliverables bucket so what went
// out to the channel is exactly what is on record, and a re-send needs no
// re-render.
//
// Caption copy lives in app_settings (editable here, no redeploy) and supports
// {date} {items} {link} {name} placeholders; the send dialog can also override
// the caption for a single issue without touching the saved template.

import express, { Router } from 'express'
import { asyncH, sendDbError } from '../util.js'
import { requireAuth, requireSuperadmin, type AuthedRequest } from '../middleware/auth.js'
import { supabaseAdmin } from '../supabase.js'
import { config, telegramChannelEnabled } from '../config.js'
import { readSettingString, writeSetting } from '../lib/settings.js'
import { CAPTION_MAX, DOCUMENT_MAX_BYTES, sendChannelDocument } from '../lib/telegramChannel.js'

const router = Router()

const admin = [requireAuth, requireSuperadmin] as const

const CA_TYPES = new Set(['day_wise', 'month_wise'])
const LANGS = new Set(['en', 'ta'])
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

const BUCKET = 'ca-deliverables'
/** Well under Telegram's 50 MB bot limit and the bucket's 50 MB object cap. */
const MAX_PDF_BYTES = Math.min(DOCUMENT_MAX_BYTES, 45 * 1024 * 1024)

const SETTING_CHANNEL = 'telegram_ca_channel'
const SETTING_CAPTION_EN = 'telegram_ca_caption_en'
const SETTING_CAPTION_TA = 'telegram_ca_caption_ta'

// Same defaults the migration seeds — kept here so a fresh environment with no
// app_settings rows still shows sensible copy in the console.
const DEFAULT_CAPTION_EN =
  '📘 Current Affairs — {date}\n{items} news items, exam-ready.\n\n' +
  'Daily current affairs, PYQs and mock tests: {link}'
const DEFAULT_CAPTION_TA =
  '📘 நடப்பு நிகழ்வுகள் — {date}\n{items} செய்திகள், தேர்வுக்குத் தயார்.\n\n' +
  'தினசரி நடப்பு நிகழ்வுகள், PYQ மற்றும் மாதிரித் தேர்வுகள்: {link}'

/** The channel to post to: superadmin setting first, env fallback. */
async function resolveChannel(): Promise<string> {
  return (await readSettingString(SETTING_CHANNEL, config.telegramCaChannel)).trim()
}

/** '@name' / 'name' / 't.me/name' / '-1001234567890' → what the Bot API wants. */
function normalizeChannel(raw: string): string {
  const v = raw.trim().replace(/^https?:\/\/(t\.me|telegram\.me)\//i, '')
  if (!v) return ''
  if (/^-?\d+$/.test(v)) return v // numeric chat id (private channels)
  return v.startsWith('@') ? v : `@${v}`
}

/** Archive path of a language's PDF for one issue (overwritten on re-send). */
function storagePath(caType: string, date: string, lang: string): string {
  const kind = caType === 'day_wise' ? 'daily' : 'monthly'
  return `${date.slice(0, 7)}/telegram/CA_${kind}_${date}_${lang}.pdf`
}

// ─── Upload → send hand-off ──────────────────────────────────────────────────
// The console uploads a PDF and then, seconds later, asks us to send it. We were
// archiving those bytes to Storage and immediately downloading the very same
// bytes back out again to hand to Telegram — around 6 MB of Supabase egress per
// broadcast, for a file this process had just held in memory.
//
// Keep the uploaded buffer around for the short window between the two calls.
// A miss (a re-send of an older issue, or a server restart in between) still
// falls back to the archive, so this is a shortcut, never the source of truth.
const HANDOFF_TTL_MS = 30 * 60_000
/** Anything larger stays out of memory and is re-read from the archive — the
 *  daily issues are 2–6 MB, so this covers the normal case without letting a
 *  one-off 45 MB upload sit in the heap. */
const HANDOFF_MAX_ENTRY_BYTES = 16 * 1024 * 1024
/** Total ceiling across all held buffers (one broadcast = EN + TA). */
const HANDOFF_MAX_TOTAL_BYTES = 48 * 1024 * 1024

const handoff = new Map<string, { pdf: Buffer; until: number }>()
let handoffBytes = 0

function handoffDrop(path: string): void {
  const hit = handoff.get(path)
  if (!hit) return
  handoffBytes -= hit.pdf.length
  handoff.delete(path)
}

/** Remember an issue's PDF for the imminent /send. Oldest entries go first when
 *  the ceiling is reached (Map preserves insertion order). */
function handoffPut(path: string, pdf: Buffer): void {
  if (pdf.length > HANDOFF_MAX_ENTRY_BYTES) return
  handoffDrop(path)
  while (handoffBytes + pdf.length > HANDOFF_MAX_TOTAL_BYTES && handoff.size > 0) {
    const oldest = handoff.keys().next().value
    if (oldest === undefined) break
    handoffDrop(oldest)
  }
  handoff.set(path, { pdf, until: Date.now() + HANDOFF_TTL_MS })
  handoffBytes += pdf.length
}

/** The held PDF for a path, or null when it has expired or was never held. */
function handoffTake(path: string): Buffer | null {
  const hit = handoff.get(path)
  if (!hit) return null
  if (hit.until <= Date.now()) {
    handoffDrop(path)
    return null
  }
  return hit.pdf
}

/** Reject anything that isn't a real issue reference up front. */
function badIssue(caType: string, date: string): boolean {
  return !CA_TYPES.has(caType) || !DATE_RE.test(date)
}

// ─── GET /api/ca-telegram/admin/config ───────────────────────────────────────
// Channel + caption templates for the send dialog, with defaults applied.
router.get(
  '/admin/config',
  ...admin,
  asyncH(async (_req: AuthedRequest, res) => {
    const [channel, captionEn, captionTa] = await Promise.all([
      resolveChannel(),
      readSettingString(SETTING_CAPTION_EN, DEFAULT_CAPTION_EN),
      readSettingString(SETTING_CAPTION_TA, DEFAULT_CAPTION_TA),
    ])
    res.json({
      enabled: telegramChannelEnabled,
      channel,
      captions: { en: captionEn, ta: captionTa },
      captionMax: CAPTION_MAX,
    })
  })
)

// ─── PUT /api/ca-telegram/admin/config ───────────────────────────────────────
// Save the channel and/or the default caption templates. Only keys present in
// the body are written, so the dialog can save one caption on its own.
router.put(
  '/admin/config',
  ...admin,
  asyncH(async (req: AuthedRequest, res) => {
    const b = req.body ?? {}
    const writes: Promise<unknown>[] = []

    if (typeof b.channel === 'string') {
      writes.push(writeSetting(SETTING_CHANNEL, normalizeChannel(b.channel)))
    }
    for (const [key, field] of [
      [SETTING_CAPTION_EN, 'caption_en'],
      [SETTING_CAPTION_TA, 'caption_ta'],
    ] as const) {
      const v = b[field]
      if (typeof v !== 'string') continue
      if (v.length > CAPTION_MAX) {
        return res.status(400).json({ error: `A caption can be at most ${CAPTION_MAX} characters.` })
      }
      writes.push(writeSetting(key, v))
    }
    if (!writes.length) return res.status(400).json({ error: 'Nothing to update.' })
    await Promise.all(writes)

    const [channel, captionEn, captionTa] = await Promise.all([
      resolveChannel(),
      readSettingString(SETTING_CAPTION_EN, DEFAULT_CAPTION_EN),
      readSettingString(SETTING_CAPTION_TA, DEFAULT_CAPTION_TA),
    ])
    res.json({
      enabled: telegramChannelEnabled,
      channel,
      captions: { en: captionEn, ta: captionTa },
      captionMax: CAPTION_MAX,
    })
  })
)

// ─── GET /api/ca-telegram/admin/posts?ca_type=&date= ─────────────────────────
// What has already gone out for an issue — the console shows the latest send
// per language so a re-send is always a deliberate choice.
router.get(
  '/admin/posts',
  ...admin,
  asyncH(async (req: AuthedRequest, res) => {
    const caType = String(req.query.ca_type ?? '')
    const date = String(req.query.date ?? '')
    if (badIssue(caType, date)) return res.status(400).json({ error: 'Invalid issue reference.' })

    const { data, error } = await supabaseAdmin
      .from('ca_telegram_posts')
      .select('id, lang, chat_id, message_id, caption, file_name, file_size, sent_at')
      .eq('ca_type', caType)
      .eq('date', date)
      .order('sent_at', { ascending: false })
      .limit(20)
    if (error) return sendDbError(res, error)
    res.json({ posts: data ?? [] })
  })
)

// ─── GET /api/ca-telegram/admin/sent ─────────────────────────────────────────
// The latest send per (issue, language) across all issues, for the issue list's
// "sent" chips — one round trip instead of one per row.
router.get(
  '/admin/sent',
  ...admin,
  asyncH(async (_req: AuthedRequest, res) => {
    const { data, error } = await supabaseAdmin
      .from('ca_telegram_posts')
      .select('ca_type, date, lang, sent_at')
      .order('sent_at', { ascending: false })
      .limit(500)
    if (error) return sendDbError(res, error)

    // Newest first, so the first row seen for a key IS the latest send.
    const latest: Record<string, { en?: string; ta?: string }> = {}
    for (const r of (data ?? []) as { ca_type: string; date: string; lang: 'en' | 'ta'; sent_at: string }[]) {
      const key = `${r.ca_type}|${r.date}`
      const entry = (latest[key] ??= {})
      entry[r.lang] ??= r.sent_at
    }
    res.json({ sent: latest })
  })
)

// ─── POST /api/ca-telegram/admin/upload?ca_type=&date=&lang= ─────────────────
// The browser-rendered PDF, raw in the body (Content-Type: application/pdf).
// Mirrors the materials/APK uploads so the global JSON parser skips it. Stored
// with upsert so re-rendering an issue replaces its archived copy.
router.post(
  '/admin/upload',
  ...admin,
  express.raw({ type: () => true, limit: '50mb' }),
  asyncH(async (req: AuthedRequest, res) => {
    const caType = String(req.query.ca_type ?? '')
    const date = String(req.query.date ?? '')
    const lang = String(req.query.lang ?? '')
    if (badIssue(caType, date) || !LANGS.has(lang)) {
      return res.status(400).json({ error: 'Invalid issue reference.' })
    }
    const body = req.body
    if (!Buffer.isBuffer(body) || body.length === 0) {
      return res.status(400).json({ error: 'No PDF was uploaded.' })
    }
    if (body.length > MAX_PDF_BYTES) {
      return res.status(413).json({ error: 'That PDF is too large for Telegram (max 45 MB).' })
    }

    const path = storagePath(caType, date, lang)
    const { error } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, body, { contentType: 'application/pdf', upsert: true })
    if (error) {
      console.error('[ca-telegram upload]', error)
      return res.status(502).json({ error: 'Could not store the PDF. Please try again.' })
    }
    // The send is the next call — keep the bytes so it doesn't pull them back
    // out of Storage.
    handoffPut(path, body)
    res.status(201).json({ path, size: body.length })
  })
)

// ─── POST /api/ca-telegram/admin/send ────────────────────────────────────────
// Publish the uploaded PDFs to the channel — one message per language, each
// with its own caption. Languages are sent in order and INDEPENDENTLY: if Tamil
// fails, the English post still stands and the response says exactly what
// happened, so the operator never has to guess whether to re-send both.
router.post(
  '/admin/send',
  ...admin,
  asyncH(async (req: AuthedRequest, res) => {
    if (!telegramChannelEnabled) {
      return res.status(503).json({ error: 'The Telegram bot is not configured on the server.' })
    }
    const b = req.body ?? {}
    const caType = String(b.ca_type ?? '')
    const date = String(b.date ?? '')
    if (badIssue(caType, date)) return res.status(400).json({ error: 'Invalid issue reference.' })

    const langs = (Array.isArray(b.langs) ? b.langs : [])
      .map((l: unknown) => String(l))
      .filter((l: string) => LANGS.has(l))
    if (!langs.length) return res.status(400).json({ error: 'Choose at least one language to send.' })

    const captions = (b.captions ?? {}) as Record<string, unknown>
    for (const lang of langs) {
      const c = captions[lang]
      if (typeof c !== 'string' || !c.trim()) {
        return res.status(400).json({ error: `The ${lang === 'ta' ? 'Tamil' : 'English'} caption is empty.` })
      }
      if (c.length > CAPTION_MAX) {
        return res.status(400).json({
          error: `The ${lang === 'ta' ? 'Tamil' : 'English'} caption is over Telegram's ${CAPTION_MAX}-character limit.`,
        })
      }
    }

    const chatId = normalizeChannel(await resolveChannel())
    if (!chatId) {
      return res.status(400).json({ error: 'No Telegram channel is set. Add one in the send dialog first.' })
    }

    const results: { lang: string; ok: boolean; messageId?: number; error?: string }[] = []
    for (const lang of langs) {
      const path = storagePath(caType, date, lang)
      let pdf = handoffTake(path)
      if (!pdf) {
        // Not the freshly uploaded file (a re-send, or a restart in between) —
        // read it back out of the archive, and hold it in case of a retry.
        const { data: file, error: dlErr } = await supabaseAdmin.storage.from(BUCKET).download(path)
        if (dlErr || !file) {
          results.push({ lang, ok: false, error: 'The generated PDF was not found. Please try sending again.' })
          continue
        }
        pdf = Buffer.from(await file.arrayBuffer())
        handoffPut(path, pdf)
      }
      const kind = caType === 'day_wise' ? '' : '_Monthly'
      const fileName = `TNPSC_Mentors_Current_Affairs${kind}_${date}_${lang.toUpperCase()}.pdf`
      const caption = String(captions[lang])

      const sent = await sendChannelDocument({ chatId, pdf, filename: fileName, caption })
      if (!sent.ok) {
        results.push({ lang, ok: false, error: sent.error })
        continue
      }

      const { error: logErr } = await supabaseAdmin.from('ca_telegram_posts').insert({
        ca_type: caType,
        date,
        lang,
        chat_id: chatId,
        message_id: sent.messageId || null,
        caption,
        file_name: fileName,
        file_size: pdf.length,
        storage_path: path,
        sent_by: req.userId,
      })
      // The post IS live at this point — a failed log must not read as a failed
      // send, so it is reported as success and only logged server-side.
      if (logErr) console.error('[ca-telegram] send log failed', logErr.message)

      results.push({ lang, ok: true, messageId: sent.messageId })
    }

    // Nothing reached the channel → a 502 whose `error` is the reason, so the
    // dialog can show it directly. A PARTIAL success stays 200 and the caller
    // reads per-language results.
    if (!results.some((r) => r.ok)) {
      return res.status(502).json({
        chatId,
        results,
        error: results[0]?.error ?? 'Telegram rejected the post.',
      })
    }
    res.json({ chatId, results })
  })
)

export default router
