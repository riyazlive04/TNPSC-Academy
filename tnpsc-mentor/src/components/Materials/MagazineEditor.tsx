import { useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  Bold,
  Check,
  Eye,
  Image as ImageIcon,
  List,
  Loader2,
  Newspaper,
  Pencil,
  Plus,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import LogoLoader from '../UI/LogoLoader'
import MagazineSections, { MagazineEmpty } from './MagazineContent'
import type { CaMagazineIssue, CaMagazineItem } from '../../lib/api'
import { api } from '../../lib/api'
import {
  KNOW_LEVELS,
  KNOW_LEVEL_TONE,
  MAGAZINE_SECTION_ORDER,
  displayItemTitle,
  groupBySection,
  isKnowLevel,
  issueDateLabel,
  knowLevelShort,
  sectionLabel,
  type KnowLevel,
} from '../../lib/caMagazine'
import { htmlToMarkdown, markdownToHtml } from '../../lib/caMagazineMarkdown'
import { useT } from '../../lib/i18n'
import { toast } from '../../store/toastStore'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

/**
 * Full-screen document editor for one CA-magazine issue (superadmin only).
 * The Edit view is a single "page" of borderless, auto-growing title/body
 * fields that reads like a doc — not a form — with per-item inline auto-save
 * (on blur / section change). The Preview toggle renders the exact student view
 * (shared MagazineContent). Responsive: a bordered page on desktop, edge-to-edge
 * on mobile. Not a modal — it owns the whole viewport.
 */
export default function MagazineEditor({
  issue,
  onClose,
  onCountChange,
}: {
  issue: CaMagazineIssue
  onClose: () => void
  /** Report the new item count so the parent list chip can stay in sync. */
  onCountChange?: (count: number) => void
}) {
  const { t, lang } = useT()
  const [items, setItems] = useState<CaMagazineItem[] | null>(null)
  const [failed, setFailed] = useState(false)
  // The issue's news image (daily issues only). Absent is normal.
  const [newsImage, setNewsImage] = useState<string | null>(null)
  const [mode, setMode] = useState<'preview' | 'edit'>('edit')
  const [previewLang, setPreviewLang] = useState<'en' | 'ta' | 'both'>(lang)
  const [adding, setAdding] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  // The scrolling column (see the Body comment below).
  const bodyRef = useRef<HTMLDivElement>(null)

  // Commit any focused field before leaving, so Escape/close never drops an edit.
  const requestClose = () => {
    ;(document.activeElement as HTMLElement | null)?.blur?.()
    onClose()
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && requestClose()
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchItems = () => {
    setFailed(false)
    setItems(null)
    api.caMagazine
      .adminItems(issue.ca_type, issue.date)
      .then(setItems)
      .catch(() => setFailed(true))
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(fetchItems, [issue.ca_type, issue.date])

  // News image — fetched independently so a missing image never blocks the
  // editor. Lets the superadmin verify it before approving the issue.
  useEffect(() => {
    let cancelled = false
    setNewsImage(null)
    api.caMagazine
      .adminNewsImage(issue.ca_type, issue.date)
      .then((url) => !cancelled && setNewsImage(url))
      .catch(() => !cancelled && setNewsImage(null))
    return () => {
      cancelled = true
    }
  }, [issue.ca_type, issue.date])

  const setAndReport = (next: CaMagazineItem[]) => {
    setItems(next)
    onCountChange?.(next.length)
  }
  const handleAdded = (item: CaMagazineItem) => {
    setAndReport([...(items ?? []), item])
    setAdding(false)
  }
  const handleUpdated = (item: CaMagazineItem) =>
    setItems((prev) => prev?.map((x) => (x.id === item.id ? item : x)) ?? prev)
  const handleDeleted = (id: string) => setAndReport((items ?? []).filter((x) => x.id !== id))

  const grouped = items ? groupBySection(items) : []
  const heading = `${issue.ca_type === 'day_wise' ? 'Daily' : 'Monthly'} CA Magazine`
  const meta = `${issueDateLabel(issue.ca_type, issue.date)} · ${items?.length ?? issue.items} items`

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-canvas animate-fadeInFast">
      {/* ─── Top bar ─────────────────────────────────────────────────────── */}
      <header className="flex flex-shrink-0 items-center gap-2 border-b border-line bg-card px-3 py-2.5 sm:gap-3 sm:px-5">
        <button
          onClick={requestClose}
          className="focus-ring grid h-8 w-8 flex-shrink-0 place-items-center rounded-full text-muted hover:bg-tint-violet hover:text-primary"
          aria-label={t('close')}
        >
          <X size={18} />
        </button>
        <span className="hidden h-9 w-9 flex-shrink-0 place-items-center rounded-lg bg-brand-soft text-brand sm:grid">
          <Newspaper size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-heading text-sm font-semibold text-ink sm:text-base">{heading}</h2>
          <p className="truncate font-body text-2xs text-ink2 sm:text-xs">{meta}</p>
        </div>

        {mode === 'edit' && <SaveStatus state={saveState} />}

        <div className="flex flex-shrink-0 rounded-lg bg-tint p-0.5">
          {(['edit', 'preview'] as const).map((m) => (
            <button
              key={m}
              onClick={() => {
                if (m === 'preview') (document.activeElement as HTMLElement | null)?.blur?.()
                setMode(m)
              }}
              className={`press flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-heading text-xs font-semibold transition sm:px-3 ${
                mode === m ? 'bg-card text-brand shadow-pill' : 'text-ink2 hover:text-ink'
              }`}
            >
              {m === 'edit' ? <Pencil size={14} /> : <Eye size={14} />}
              <span className="hidden sm:inline">{m === 'edit' ? 'Edit' : 'Preview'}</span>
            </button>
          ))}
        </div>
      </header>

      {/* ─── Preview language chips ──────────────────────────────────────── */}
      {mode === 'preview' && (
        <div className="flex flex-shrink-0 items-center gap-1.5 border-b border-line bg-card/60 px-4 py-2 sm:px-6">
          {(['en', 'ta', 'both'] as const).map((l) => (
            <button
              key={l}
              onClick={() => setPreviewLang(l)}
              className={`rounded-full border px-3 py-1 font-heading text-2xs font-semibold transition ${
                previewLang === l
                  ? 'border-brand bg-brand text-white'
                  : 'border-line bg-card text-ink2 hover:border-brand-ring hover:text-ink'
              }`}
            >
              {l === 'en' ? 'English' : l === 'ta' ? 'தமிழ்' : 'Both'}
            </button>
          ))}
        </div>
      )}

      {/* ─── Body ────────────────────────────────────────────────────────────
          The scroll lives on the CENTRED COLUMN, not on the full-width screen,
          so the scrollbar sits beside the text instead of way out at the window
          corner. The empty margins either side would then be inert, so they
          forward their wheel to the column - no part of the screen feels dead. */}
      <div
        className="flex min-h-0 flex-1 justify-center"
        onWheel={(e) => {
          const el = bodyRef.current
          if (!el || el.contains(e.target as Node)) return // the column handles its own
          el.scrollTop += e.deltaY
        }}
      >
        <div ref={bodyRef} className="min-h-0 w-full max-w-3xl overflow-y-auto">
        {items === null && !failed && (
          <div className="flex justify-center py-20">
            <LogoLoader size={56} />
          </div>
        )}

        {failed && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <AlertTriangle size={30} className="text-coral" />
            <p className="font-body text-ink2">{t('couldNotLoad')}</p>
            <button onClick={fetchItems} className="btn-ghost btn-sm">
              {t('retry')}
            </button>
          </div>
        )}

        {/* Preview — exactly what students see, news image included. */}
        {items !== null && mode === 'preview' && (
          <div className="w-full">
            {newsImage && (
              <figure className="border-b border-line px-4 pb-4 pt-4 sm:px-6">
                <img
                  src={newsImage}
                  alt={`News image — ${issueDateLabel(issue.ca_type, issue.date)}`}
                  loading="lazy"
                  onError={() => setNewsImage(null)}
                  className="w-full rounded-xl border border-line bg-card object-cover"
                />
              </figure>
            )}
            {items.length === 0 ? <MagazineEmpty /> : <MagazineSections items={items} lang={previewLang} />}
          </div>
        )}

        {/* Edit — the document */}
        {items !== null && mode === 'edit' && (
          <div className="w-full px-3 py-5 sm:px-6 sm:py-8">
            <div className="px-1 py-2 sm:rounded-2xl sm:border sm:border-line sm:bg-card sm:px-10 sm:py-9 sm:shadow-soft">
              {/* Document title (static) */}
              <div className="border-b border-line pb-4">
                <h1 className="font-heading text-xl font-bold tracking-tight text-ink sm:text-2xl">{heading}</h1>
                <p className="mt-0.5 font-body text-sm text-ink2">{meta}</p>
              </div>

              <ThumbnailEditor
                issue={issue}
                url={newsImage}
                onChange={setNewsImage}
              />

              {items.length === 0 && !adding && (
                <div className="py-10">
                  <MagazineEmpty />
                </div>
              )}

              {grouped.map(({ topic, items: sectionItems }) => (
                <section key={topic} className="mt-7 first:mt-6">
                  <h2 className="tamil mb-1 font-heading text-xs font-bold uppercase tracking-[0.12em] text-brand">
                    {sectionLabel(topic, lang)}
                  </h2>
                  <div className="divide-y divide-line/70">
                    {sectionItems.map((item) => (
                      <DocItem
                        key={item.id}
                        item={item}
                        onUpdated={handleUpdated}
                        onDeleted={handleDeleted}
                        reportSave={setSaveState}
                      />
                    ))}
                  </div>
                </section>
              ))}

              {/* Add item */}
              <div className="mt-8 border-t border-line pt-5">
                {adding ? (
                  <AddItemComposer issue={issue} onAdded={handleAdded} onCancel={() => setAdding(false)} />
                ) : (
                  <button
                    onClick={() => setAdding(true)}
                    className="press inline-flex items-center gap-2 rounded-lg border border-dashed border-line px-4 py-2.5 font-heading text-sm font-semibold text-ink2 transition hover:border-brand-ring hover:text-brand"
                  >
                    <Plus size={16} /> Add item
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  )
}

// ─── Thumbnail ─────────────────────────────────────────────────────────────────
// The image students see on the dashboard carousel and at the top of the issue.
// A DAILY issue gets one from the pipeline automatically; uploading here
// overrides it (and is the only way to give a MONTHLY issue one). "Use the
// original" deletes the override, which falls the issue back to the pipeline's
// image — so a bad pick is never destructive.
const THUMB_MIME = ['image/jpeg', 'image/png', 'image/webp']
const THUMB_MAX_MB = 8

function ThumbnailEditor({
  issue,
  url,
  onChange,
}: {
  issue: CaMagazineIssue
  url: string | null
  onChange: (url: string | null) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<'upload' | 'remove' | null>(null)
  // Whether the CURRENT image came from an upload here. Only known for sure
  // after acting in this session, so the fallback hint stays honest.
  const [custom, setCustom] = useState<boolean | null>(null)

  const pick = () => fileRef.current?.click()

  const upload = async (file: File) => {
    if (!THUMB_MIME.includes(file.type)) {
      toast.error('Use a JPG, PNG or WebP image.')
      return
    }
    if (file.size > THUMB_MAX_MB * 1024 * 1024) {
      toast.error(`That image is too large (max ${THUMB_MAX_MB} MB).`)
      return
    }
    setBusy('upload')
    try {
      const next = await api.caMagazine.uploadNewsImage(issue.ca_type, issue.date, file)
      onChange(next)
      setCustom(true)
      toast.success('Thumbnail updated.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not upload the image.')
    } finally {
      setBusy(null)
      // Let the same file be picked again after a failed attempt.
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const remove = async () => {
    setBusy('remove')
    try {
      const next = await api.caMagazine.removeNewsImage(issue.ca_type, issue.date)
      onChange(next)
      setCustom(false)
      toast.success(next ? 'Reverted to the original image.' : 'Thumbnail removed.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not remove the image.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="mt-5 rounded-xl border border-line p-3 sm:p-4">
      <div className="flex items-start gap-3">
        {url ? (
          <img
            src={url}
            alt=""
            className="h-16 w-24 flex-shrink-0 rounded-lg border border-line object-cover sm:h-20 sm:w-32"
          />
        ) : (
          <span className="grid h-16 w-24 flex-shrink-0 place-items-center rounded-lg border border-dashed border-line text-ink2 sm:h-20 sm:w-32">
            <ImageIcon size={20} />
          </span>
        )}

        <div className="min-w-0 flex-1">
          <p className="font-heading text-sm font-semibold text-ink">Thumbnail</p>
          <p className="mt-0.5 font-body text-xs leading-snug text-ink2">
            {url
              ? 'Shown on the dashboard carousel and above the issue.'
              : issue.ca_type === 'day_wise'
                ? 'No image for this date yet. Upload one to give the issue a thumbnail.'
                : 'Monthly issues have no image of their own — upload one here.'}
          </p>

          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <button
              onClick={pick}
              disabled={busy !== null}
              className="btn-soft press h-8 gap-1.5 px-3 text-xs disabled:opacity-50"
            >
              {busy === 'upload' ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
              {url ? 'Replace' : 'Upload'}
            </button>
            {url && custom !== false && (
              <button
                onClick={remove}
                disabled={busy !== null}
                className="press inline-flex h-8 items-center gap-1.5 rounded-lg px-3 font-heading text-xs font-semibold text-ink2 transition hover:bg-coralsoft hover:text-coral disabled:opacity-50"
              >
                {busy === 'remove' ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                {issue.ca_type === 'day_wise' ? 'Use the original' : 'Remove'}
              </button>
            )}
            <span className="font-body text-2xs text-ink2">JPG, PNG or WebP · max {THUMB_MAX_MB} MB</span>
          </div>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept={THUMB_MIME.join(',')}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void upload(file)
        }}
      />
    </div>
  )
}

// ─── Save-state pill ───────────────────────────────────────────────────────────
function SaveStatus({ state }: { state: SaveState }) {
  if (state === 'idle') return null
  const map = {
    saving: { icon: <Loader2 size={13} className="animate-spin" />, text: 'Saving…', cls: 'text-ink2' },
    saved: { icon: <Check size={13} />, text: 'Saved', cls: 'text-mint' },
    error: { icon: <AlertTriangle size={13} />, text: 'Not saved', cls: 'text-coral' },
  }[state]
  return (
    <span className={`flex flex-shrink-0 items-center gap-1 font-heading text-2xs font-semibold ${map.cls}`}>
      {map.icon}
      <span className="hidden sm:inline">{map.text}</span>
    </span>
  )
}

// ─── One editable item (document block, inline auto-save) ───────────────────────
function DocItem({
  item,
  onUpdated,
  onDeleted,
  reportSave,
}: {
  item: CaMagazineItem
  onUpdated: (item: CaMagazineItem) => void
  onDeleted: (id: string) => void
  reportSave: (s: SaveState) => void
}) {
  // A round-up row is titled after its own section, and the pipeline keeps
  // pushing the section's OLD name. Show it under the section's current name so
  // the editor never contradicts the heading above it — seeded into the
  // dirty-detection baseline too, so merely opening an issue saves nothing; the
  // corrected title only persists if something in the item is actually edited.
  // The Tamil twin of these round-up rows is stored as the English name too, so
  // it is renamed the same way rather than swapped to the Tamil section label.
  const shownTitle = displayItemTitle(item.title, item.topic)
  const shownTitleTa = displayItemTitle(item.title_ta ?? '', item.topic)

  const [topic, setTopic] = useState(item.topic)
  const [knowLevel, setKnowLevel] = useState<KnowLevel | null>(
    isKnowLevel(item.know_level) ? item.know_level : null
  )
  const [title, setTitle] = useState(shownTitle)
  const [titleTa, setTitleTa] = useState(shownTitleTa)
  const [content, setContent] = useState(item.content)
  const [contentTa, setContentTa] = useState(item.content_ta ?? '')
  const [confirmDel, setConfirmDel] = useState(false)
  const [deleting, setDeleting] = useState(false)
  // One toolbar for both writing surfaces below — see useRteToolbar.
  const toolbar = useRteToolbar()
  // Last-saved snapshot — drives dirty detection so blurs don't re-save no-ops.
  const base = useRef({
    topic: item.topic,
    knowLevel: isKnowLevel(item.know_level) ? item.know_level : null,
    title: shownTitle,
    titleTa: shownTitleTa,
    content: item.content,
    contentTa: item.content_ta ?? '',
  })

  const commit = async () => {
    const dirty =
      title !== base.current.title ||
      titleTa !== base.current.titleTa ||
      content !== base.current.content ||
      contentTa !== base.current.contentTa
    if (!dirty) return
    if (!title.trim() || !content.trim()) return // incomplete — wait for valid input
    reportSave('saving')
    try {
      const updated = await api.caMagazine.adminUpdateItem(item.id, {
        title: title.trim(),
        title_ta: titleTa.trim() || null,
        content: content.trim(),
        content_ta: contentTa.trim() || null,
      })
      base.current = {
        ...base.current,
        title: updated.title,
        titleTa: updated.title_ta ?? '',
        content: updated.content,
        contentTa: updated.content_ta ?? '',
      }
      setTitle(updated.title)
      setTitleTa(updated.title_ta ?? '')
      setContent(updated.content)
      setContentTa(updated.content_ta ?? '')
      onUpdated(updated)
      reportSave('saved')
    } catch (e) {
      reportSave('error')
      toast.error(e instanceof Error ? e.message : 'Could not save.')
    }
  }

  const changeSection = async (next: string) => {
    if (next === base.current.topic) return
    setTopic(next)
    reportSave('saving')
    try {
      const updated = await api.caMagazine.adminUpdateItem(item.id, { topic: next })
      base.current.topic = updated.topic
      onUpdated(updated)
      reportSave('saved')
    } catch (e) {
      setTopic(base.current.topic)
      reportSave('error')
      toast.error(e instanceof Error ? e.message : 'Could not move the item.')
    }
  }

  // Saved on pick, like the section chip — a triage pass over a whole issue is
  // a run of single taps, and making each one wait on a blur elsewhere would
  // lose changes the moment the reviewer scrolled on.
  const changeKnowLevel = async (next: KnowLevel | null) => {
    if (next === base.current.knowLevel) return
    setKnowLevel(next)
    reportSave('saving')
    try {
      const updated = await api.caMagazine.adminUpdateItem(item.id, { know_level: next })
      base.current.knowLevel = isKnowLevel(updated.know_level) ? updated.know_level : null
      onUpdated(updated)
      reportSave('saved')
    } catch (e) {
      setKnowLevel(base.current.knowLevel)
      reportSave('error')
      toast.error(e instanceof Error ? e.message : 'Could not set the level.')
    }
  }

  const del = async () => {
    setDeleting(true)
    try {
      await api.caMagazine.adminDeleteItem(item.id)
      onDeleted(item.id)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not delete.')
      setDeleting(false)
      setConfirmDel(false)
    }
  }

  return (
    <div className="group relative rounded-xl px-3 py-3.5 transition hover:bg-tint/25 focus-within:bg-tint/30">
      {/* Everything that acts ON this item lives above its heading, in one row:
          section and know level on the left, formatting and delete on the right.
          The bold/list buttons used to sit under the title, directly above the
          English surface — which read as belonging to that surface alone, even
          though the Tamil twin below needed them just as much. Delete was
          hover-only on desktop, so the row looked like it held nothing but the
          section chip and the action was invisible on touch; both are now
          always here. */}
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <SectionSelect value={topic} onChange={changeSection} />
          <KnowLevelSelect value={knowLevel} onChange={changeKnowLevel} />
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          {/* Hidden while the delete confirm is open — that row is already
              three controls wide and would wrap on a phone. */}
          {!confirmDel && <RteToolbar toolbar={toolbar} />}
          {confirmDel ? (
            <div className="flex items-center gap-1.5">
              <span className="font-body text-xs text-ink2">Delete?</span>
              <button
                onClick={del}
                disabled={deleting}
                className="press inline-flex items-center gap-1 rounded-full bg-coral px-2.5 py-1 font-heading text-2xs font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
              >
                {deleting ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Yes
              </button>
              <button
                onClick={() => setConfirmDel(false)}
                className="rounded-full px-2 py-1 font-heading text-2xs font-semibold text-ink2 hover:text-ink"
              >
                No
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDel(true)}
              className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-lg text-ink2/60 transition hover:bg-coralsoft hover:text-coral"
              title="Delete item"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {/* English */}
      <ItemEditor
        title={title}
        content={content}
        onChange={(v) => {
          setTitle(v.title)
          setContent(v.content)
        }}
        onBlur={commit}
        titlePlaceholder="Title"
        bodyPlaceholder="Write the item…"
        ariaLabel="Item heading and content"
        toolbar={toolbar}
      />

      {/* Tamil twin */}
      <div className="mt-3 border-l-2 border-line pl-3">
        <span className="tamil mb-0.5 block font-heading text-2xs font-bold uppercase tracking-wider text-ink2/50">
          தமிழ் / Tamil
        </span>
        <ItemEditor
          title={titleTa}
          content={contentTa}
          onChange={(v) => {
            setTitleTa(v.title)
            setContentTa(v.content)
          }}
          onBlur={commit}
          titlePlaceholder="தலைப்பு (Tamil title)"
          bodyPlaceholder="தமிழ் உள்ளடக்கம்"
          ariaLabel="Tamil heading and content"
          toolbar={toolbar}
          tamil
        />
      </div>
    </div>
  )
}

// ─── Add-item composer (same doc styling) ──────────────────────────────────────
function AddItemComposer({
  issue,
  onAdded,
  onCancel,
}: {
  issue: CaMagazineIssue
  onAdded: (item: CaMagazineItem) => void
  onCancel: () => void
}) {
  const [topic, setTopic] = useState(MAGAZINE_SECTION_ORDER[1]) // TAMIL NADU
  const [knowLevel, setKnowLevel] = useState<KnowLevel | null>(null)
  const [title, setTitle] = useState('')
  const [titleTa, setTitleTa] = useState('')
  const [content, setContent] = useState('')
  const [contentTa, setContentTa] = useState('')
  const [saving, setSaving] = useState(false)
  const toolbar = useRteToolbar()

  const submit = async () => {
    if (saving) return
    if (!title.trim() || !content.trim()) return toast.error('Title and content are required.')
    setSaving(true)
    try {
      const item = await api.caMagazine.adminAddItem({
        ca_type: issue.ca_type,
        date: issue.date,
        topic,
        title: title.trim(),
        content: content.trim(),
        title_ta: titleTa.trim() || null,
        content_ta: contentTa.trim() || null,
        know_level: knowLevel,
      })
      toast.success('Item added.')
      onAdded(item)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not add the item.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-brand-ring/40 bg-tint/30 px-3 py-3.5">
      <div className="mb-2 flex items-center gap-2">
        <Plus size={15} className="text-brand" />
        <h4 className="font-heading text-sm font-semibold text-ink">New item</h4>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
          <SectionSelect value={topic} onChange={setTopic} />
          <KnowLevelSelect value={knowLevel} onChange={setKnowLevel} />
          <RteToolbar toolbar={toolbar} />
        </div>
      </div>
      <ItemEditor
        title={title}
        content={content}
        onChange={(v) => {
          setTitle(v.title)
          setContent(v.content)
        }}
        titlePlaceholder="Title"
        bodyPlaceholder="Write the item…"
        ariaLabel="New item heading and content"
        toolbar={toolbar}
      />
      <div className="mt-3 border-l-2 border-line pl-3">
        <span className="tamil mb-0.5 block font-heading text-2xs font-bold uppercase tracking-wider text-ink2/50">
          தமிழ் / Tamil (optional)
        </span>
        <ItemEditor
          title={titleTa}
          content={contentTa}
          onChange={(v) => {
            setTitleTa(v.title)
            setContentTa(v.content)
          }}
          titlePlaceholder="தலைப்பு"
          bodyPlaceholder="தமிழ் உள்ளடக்கம்"
          ariaLabel="New Tamil heading and content"
          toolbar={toolbar}
          tamil
        />
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button onClick={onCancel} className="btn-ghost btn-sm">
          Cancel
        </button>
        <button onClick={submit} disabled={saving} className="btn-brand press btn-sm disabled:opacity-60">
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Add item
        </button>
      </div>
    </div>
  )
}

// ─── Rich-text editor (renders bold + bullets live; stores markdown) ────────────
/**
 * A small contentEditable that shows the item's markdown as formatted text —
 * **bold** appears bold, `- ` lines become real bullets — so there's no raw
 * markup on screen. Editing round-trips back to markdown (the storage format),
 * so the student reader and the pipeline are unaffected. Bold via the toolbar or
 * Ctrl/Cmd+B (native in contentEditable); bullets via the list button.
 */
/**
 * A formatting command applied to whichever editor currently holds the caret.
 * An item has TWO writing surfaces (English and its Tamil twin) but only ONE
 * toolbar, up in the meta row — so the toolbar can't own an editor, it has to
 * follow the focus between them.
 */
interface RteHandle {
  exec: (command: string) => void
}

export interface RteToolbarController {
  /** Called by an editor on focus (itself) and on blur (null). */
  attach: (handle: RteHandle | null) => void
  exec: (command: string) => void
  /** True while some editor holds the caret — the toolbar is inert otherwise. */
  active: boolean
}

/** Wires one meta-row toolbar to an item's writing surfaces. */
function useRteToolbar(): RteToolbarController {
  const handle = useRef<RteHandle | null>(null)
  const [active, setActive] = useState(false)
  return {
    attach: (h) => {
      handle.current = h
      setActive(!!h)
    },
    exec: (command) => handle.current?.exec(command),
    active,
  }
}

/**
 * Heading AND body in ONE editable root, because that is the only way a text
 * selection can run from the heading down into the bullets: the heading used to
 * be a <textarea>, and a browser selection can never leave a form control, so a
 * drag that started in the title stopped dead at its edge and Ctrl+C took the
 * heading alone. Two sibling contentEditable divs would not have fixed it
 * either — a selection is clamped to a single editing host.
 *
 * The split is positional and needs no bookkeeping: the FIRST block is the
 * title, everything after it is the content. The same rule drives the styling
 * (first-child), so what looks like the heading is always exactly what is saved
 * as one. Pressing Enter at the end of the title therefore starts the body,
 * which is what that keystroke should do anyway.
 */
function ItemEditor({
  title,
  content,
  onChange,
  onBlur,
  titlePlaceholder,
  bodyPlaceholder,
  ariaLabel,
  toolbar,
  tamil = false,
  className = '',
}: {
  title: string
  content: string
  onChange: (next: { title: string; content: string }) => void
  onBlur?: () => void
  titlePlaceholder?: string
  bodyPlaceholder?: string
  ariaLabel?: string
  /** The item's shared toolbar; this editor claims it while focused. */
  toolbar: RteToolbarController
  tamil?: boolean
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  // Last title+markdown we rendered/serialized — guards against re-setting
  // innerHTML (which would reset the caret) while the user is typing. The
  // sentinel forces the first sync.
  const last = useRef({ title: '\u0000', content: '\u0000' })
  const focused = useRef(false)
  const [empty, setEmpty] = useState(!title.trim() && !content.trim())

  // Sync external value → HTML, but never while focused (would jump the caret).
  useEffect(() => {
    if (focused.current || !ref.current) return
    if (title === last.current.title && content === last.current.content) return
    ref.current.innerHTML = `<div>${escapeText(title) || '<br>'}</div>${markdownToHtml(content)}`
    last.current = { title, content }
    setEmpty(!title.trim() && !content.trim())
  }, [title, content])

  const serialize = () => {
    const root = ref.current
    if (!root) return
    // First node is the heading, everything after it the body. Cloning lets the
    // body be read without touching the live DOM the caret is sitting in.
    const nextTitle = (root.firstChild?.textContent ?? '').trim()
    const rest = root.cloneNode(true) as HTMLElement
    if (rest.firstChild) rest.removeChild(rest.firstChild)
    const nextContent = htmlToMarkdown(rest)
    last.current = { title: nextTitle, content: nextContent }
    setEmpty(!root.textContent?.trim())
    onChange({ title: nextTitle, content: nextContent })
  }

  const exec = (command: string) => {
    // execCommand is deprecated but universally supported; fine for this
    // internal admin editor and far simpler than a rich-text framework.
    document.execCommand(command, false)
    serialize()
  }

  // The heading's look comes from the same first-child rule that decides what
  // IS the heading, so the two can never disagree.
  const headingStyle = tamil
    ? '[&>*:first-child]:font-heading [&>*:first-child]:text-base [&>*:first-child]:font-semibold [&>*:first-child]:leading-snug [&>*:first-child]:text-ink'
    : '[&>*:first-child]:font-heading [&>*:first-child]:text-lg [&>*:first-child]:font-semibold [&>*:first-child]:leading-snug [&>*:first-child]:text-ink'

  return (
    <div className={className}>
      <div className="relative">
        {empty && (titlePlaceholder || bodyPlaceholder) && (
          <div
            className={`pointer-events-none absolute left-0 top-0 ${tamil ? 'tamil' : ''}`}
          >
            {titlePlaceholder && (
              <div
                className={`font-heading font-semibold leading-snug text-ink2/35 ${
                  tamil ? 'text-base' : 'text-lg'
                }`}
              >
                {titlePlaceholder}
              </div>
            )}
            {bodyPlaceholder && (
              <div className="font-body text-base leading-relaxed text-ink2/35">
                {bodyPlaceholder}
              </div>
            )}
          </div>
        )}
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label={ariaLabel}
          onInput={serialize}
          onFocus={() => {
            focused.current = true
            toolbar.attach({ exec })
          }}
          onBlur={() => {
            focused.current = false
            // A toolbar press can't reach here — the buttons preventDefault on
            // mousedown, so the caret never leaves. Any blur that DOES land is
            // the user genuinely going elsewhere, and the toolbar goes inert.
            toolbar.attach(null)
            onBlur?.()
          }}
          className={`min-h-[3.2em] w-full font-body text-base leading-relaxed text-ink2 outline-none [&_b]:font-semibold [&_b]:text-ink [&_li]:my-0.5 [&_p]:my-1 [&_strong]:font-semibold [&_strong]:text-ink [&_ul]:list-disc [&_ul]:pl-5 [&_ul_ul]:list-[circle] ${headingStyle} ${
            tamil ? 'tamil' : ''
          }`}
        />
      </div>
    </div>
  )
}

/** The item's one formatting toolbar, rendered up in the meta row beside the
 *  delete button. Dimmed until a writing surface actually has the caret, so it
 *  never looks like it would do something when it wouldn't. */
function RteToolbar({ toolbar }: { toolbar: RteToolbarController }) {
  return (
    <div
      className={`flex items-center gap-1 transition ${toolbar.active ? 'opacity-100' : 'opacity-40'}`}
    >
      <ToolbarBtn title="Bold (Ctrl+B)" onPress={() => toolbar.exec('bold')}>
        <Bold size={13} />
      </ToolbarBtn>
      <ToolbarBtn title="Bullet list" onPress={() => toolbar.exec('insertUnorderedList')}>
        <List size={13} />
      </ToolbarBtn>
    </div>
  )
}

function ToolbarBtn({
  children,
  title,
  onPress,
}: {
  children: React.ReactNode
  title: string
  onPress: () => void
}) {
  return (
    <button
      type="button"
      title={title}
      // mousedown (not click) + preventDefault keeps the editor's selection so
      // the command applies to the selected text instead of losing focus first.
      onMouseDown={(e) => {
        e.preventDefault()
        onPress()
      }}
      className="grid h-6 w-6 place-items-center rounded border border-line bg-card text-ink2 transition hover:border-brand-ring hover:text-brand"
    >
      {children}
    </button>
  )
}

// ─── Shared bits ───────────────────────────────────────────────────────────────
/** Plain text → HTML text. The title is stored as plain text (no markdown), so
 *  it is escaped rather than parsed on the way into the editable root. */
function escapeText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}


/**
 * Compact know-level picker, styled to match SectionSelect but tinted by the
 * level so a scan down a long issue shows the triage at a glance. The empty
 * option is real and must stay: an item the superadmin has not judged yet is a
 * distinct state from one judged "good to know", and clearing back to it is the
 * only way to undo a mis-click.
 */
function KnowLevelSelect({
  value,
  onChange,
}: {
  value: KnowLevel | null
  onChange: (v: KnowLevel | null) => void
}) {
  const { lang } = useT()
  const tone = value ? KNOW_LEVEL_TONE[value] : 'bg-card text-ink2/70'
  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(isKnowLevel(e.target.value) ? e.target.value : null)}
      title="How essential is this item?"
      className={`tamil max-w-[45vw] truncate rounded-full border border-line px-2.5 py-1 font-heading text-2xs font-semibold uppercase tracking-wide outline-none transition hover:border-brand-ring focus:border-brand-ring sm:max-w-xs ${tone}`}
    >
      <option value="">Set level…</option>
      {KNOW_LEVELS.map((level) => (
        <option key={level} value={level}>
          {knowLevelShort(level, lang)}
        </option>
      ))}
    </select>
  )
}

/** Compact section picker styled as a chip. Keeps a custom/unknown topic usable. */
function SectionSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { lang } = useT()
  const options = MAGAZINE_SECTION_ORDER.includes(value) ? MAGAZINE_SECTION_ORDER : [value, ...MAGAZINE_SECTION_ORDER]
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="tamil max-w-[60vw] truncate rounded-full border border-line bg-card px-2.5 py-1 font-heading text-2xs font-semibold uppercase tracking-wide text-ink2 outline-none transition hover:border-brand-ring focus:border-brand-ring sm:max-w-xs"
    >
      {options.map((topic) => (
        <option key={topic} value={topic}>
          {sectionLabel(topic, lang)}
        </option>
      ))}
    </select>
  )
}
