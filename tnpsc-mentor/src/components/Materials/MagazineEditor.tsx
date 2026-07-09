import { useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  Bold,
  Check,
  Eye,
  List,
  Loader2,
  Newspaper,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react'
import LogoLoader from '../UI/LogoLoader'
import MagazineSections, { MagazineEmpty } from './MagazineContent'
import type { CaMagazineIssue, CaMagazineItem } from '../../lib/api'
import { api } from '../../lib/api'
import { MAGAZINE_SECTION_ORDER, groupBySection, issueDateLabel, sectionLabel } from '../../lib/caMagazine'
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
  const [mode, setMode] = useState<'preview' | 'edit'>('edit')
  const [previewLang, setPreviewLang] = useState<'en' | 'ta' | 'both'>(lang)
  const [adding, setAdding] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>('idle')

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
          <p className="truncate font-body text-[11px] text-ink2 sm:text-xs">{meta}</p>
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
              className={`rounded-full border px-3 py-1 font-heading text-[11px] font-semibold transition ${
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

      {/* ─── Body ────────────────────────────────────────────────────────── */}
      <div className="min-h-0 flex-1 overflow-y-auto">
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

        {/* Preview — exactly what students see */}
        {items !== null && mode === 'preview' && (
          <div className="mx-auto w-full max-w-3xl">
            {items.length === 0 ? <MagazineEmpty /> : <MagazineSections items={items} lang={previewLang} />}
          </div>
        )}

        {/* Edit — the document */}
        {items !== null && mode === 'edit' && (
          <div className="mx-auto w-full max-w-3xl px-3 py-5 sm:px-6 sm:py-8">
            <div className="px-1 py-2 sm:rounded-2xl sm:border sm:border-line sm:bg-card sm:px-10 sm:py-9 sm:shadow-soft">
              {/* Document title (static) */}
              <div className="border-b border-line pb-4">
                <h1 className="font-heading text-xl font-bold tracking-tight text-ink sm:text-2xl">{heading}</h1>
                <p className="mt-0.5 font-body text-sm text-ink2">{meta}</p>
              </div>

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
    <span className={`flex flex-shrink-0 items-center gap-1 font-heading text-[11px] font-semibold ${map.cls}`}>
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
  const [topic, setTopic] = useState(item.topic)
  const [title, setTitle] = useState(item.title)
  const [titleTa, setTitleTa] = useState(item.title_ta ?? '')
  const [content, setContent] = useState(item.content)
  const [contentTa, setContentTa] = useState(item.content_ta ?? '')
  const [confirmDel, setConfirmDel] = useState(false)
  const [deleting, setDeleting] = useState(false)
  // Last-saved snapshot — drives dirty detection so blurs don't re-save no-ops.
  const base = useRef({
    topic: item.topic,
    title: item.title,
    titleTa: item.title_ta ?? '',
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
      {/* Meta row: section chip + delete */}
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <SectionSelect value={topic} onChange={changeSection} />
        {confirmDel ? (
          <div className="flex items-center gap-1.5">
            <span className="font-body text-xs text-ink2">Delete?</span>
            <button
              onClick={del}
              disabled={deleting}
              className="press inline-flex items-center gap-1 rounded-full bg-coral px-2.5 py-1 font-heading text-[11px] font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
            >
              {deleting ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Yes
            </button>
            <button
              onClick={() => setConfirmDel(false)}
              className="rounded-full px-2 py-1 font-heading text-[11px] font-semibold text-ink2 hover:text-ink"
            >
              No
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDel(true)}
            className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-lg text-ink2/60 transition hover:bg-coralsoft hover:text-coral sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
            title="Delete item"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {/* English */}
      <AutoTextarea
        value={title}
        onChange={setTitle}
        onBlur={commit}
        placeholder="Title"
        className="font-heading text-[17px] font-semibold leading-snug text-ink"
      />
      <RichTextEditor
        value={content}
        onChange={setContent}
        onBlur={commit}
        placeholder="Write the item…"
        ariaLabel="Item content"
        className="mt-1.5"
      />

      {/* Tamil twin */}
      <div className="mt-3 border-l-2 border-line pl-3">
        <span className="tamil mb-0.5 block font-heading text-[10px] font-bold uppercase tracking-wider text-ink2/50">
          தமிழ் / Tamil
        </span>
        <AutoTextarea
          value={titleTa}
          onChange={setTitleTa}
          onBlur={commit}
          placeholder="தலைப்பு (Tamil title)"
          tamil
          className="font-heading text-[15px] font-semibold leading-snug text-ink"
        />
        <RichTextEditor
          value={contentTa}
          onChange={setContentTa}
          onBlur={commit}
          placeholder="தமிழ் உள்ளடக்கம்"
          ariaLabel="Tamil content"
          tamil
          className="mt-1.5"
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
  const [title, setTitle] = useState('')
  const [titleTa, setTitleTa] = useState('')
  const [content, setContent] = useState('')
  const [contentTa, setContentTa] = useState('')
  const [saving, setSaving] = useState(false)

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
        <div className="ml-auto">
          <SectionSelect value={topic} onChange={setTopic} />
        </div>
      </div>
      <AutoTextarea
        value={title}
        onChange={setTitle}
        placeholder="Title"
        className="font-heading text-[17px] font-semibold leading-snug text-ink"
      />
      <RichTextEditor
        value={content}
        onChange={setContent}
        placeholder="Write the item…"
        ariaLabel="New item content"
        className="mt-1.5"
      />
      <div className="mt-3 border-l-2 border-line pl-3">
        <span className="tamil mb-0.5 block font-heading text-[10px] font-bold uppercase tracking-wider text-ink2/50">
          தமிழ் / Tamil (optional)
        </span>
        <AutoTextarea
          value={titleTa}
          onChange={setTitleTa}
          placeholder="தலைப்பு"
          tamil
          className="font-heading text-[15px] font-semibold leading-snug text-ink"
        />
        <RichTextEditor
          value={contentTa}
          onChange={setContentTa}
          placeholder="தமிழ் உள்ளடக்கம்"
          ariaLabel="New Tamil content"
          tamil
          className="mt-1.5"
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
function RichTextEditor({
  value,
  onChange,
  onBlur,
  placeholder,
  ariaLabel,
  tamil = false,
  className = '',
}: {
  value: string
  onChange: (md: string) => void
  onBlur?: () => void
  placeholder?: string
  ariaLabel?: string
  tamil?: boolean
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  // Last markdown we rendered/serialized — guards against re-setting innerHTML
  // (which would reset the caret) while the user is typing. Sentinel forces the
  // first sync.
  const lastMd = useRef<string>(' ')
  const focused = useRef(false)
  const [empty, setEmpty] = useState(!value.trim())

  // Sync external value → HTML, but never while focused (would jump the caret).
  useEffect(() => {
    if (focused.current || !ref.current) return
    if (value === lastMd.current) return
    ref.current.innerHTML = markdownToHtml(value)
    lastMd.current = value
    setEmpty(!value.trim())
  }, [value])

  const serialize = () => {
    if (!ref.current) return
    const md = htmlToMarkdown(ref.current)
    lastMd.current = md
    setEmpty(!ref.current.textContent?.trim())
    onChange(md)
  }

  const exec = (command: string) => {
    // execCommand is deprecated but universally supported; fine for this
    // internal admin editor and far simpler than a rich-text framework.
    document.execCommand(command, false)
    serialize()
  }

  return (
    <div className={`group/rte ${className}`}>
      {/* Toolbar — subtle until the field is focused */}
      <div className="mb-1 flex gap-1 opacity-50 transition group-focus-within/rte:opacity-100">
        <ToolbarBtn title="Bold (Ctrl+B)" onPress={() => exec('bold')}>
          <Bold size={13} />
        </ToolbarBtn>
        <ToolbarBtn title="Bullet list" onPress={() => exec('insertUnorderedList')}>
          <List size={13} />
        </ToolbarBtn>
      </div>
      <div className="relative">
        {empty && placeholder && (
          <div
            className={`pointer-events-none absolute left-0 top-0 font-body text-[15px] leading-relaxed text-ink2/35 ${
              tamil ? 'tamil' : ''
            }`}
          >
            {placeholder}
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
          }}
          onBlur={() => {
            focused.current = false
            onBlur?.()
          }}
          className={`min-h-[1.6em] w-full font-body text-[15px] leading-relaxed text-ink2 outline-none [&_b]:font-semibold [&_b]:text-ink [&_li]:my-0.5 [&_p]:my-1 [&_strong]:font-semibold [&_strong]:text-ink [&_ul]:list-disc [&_ul]:pl-5 [&_ul_ul]:list-[circle] ${
            tamil ? 'tamil' : ''
          }`}
        />
      </div>
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
/** Borderless, auto-growing textarea — the doc-editor writing surface. */
function AutoTextarea({
  value,
  onChange,
  onBlur,
  placeholder,
  className = '',
  tamil = false,
}: {
  value: string
  onChange: (v: string) => void
  onBlur?: () => void
  placeholder?: string
  className?: string
  tamil?: boolean
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const el = ref.current
    if (el) {
      el.style.height = '0px'
      el.style.height = `${el.scrollHeight}px`
    }
  }, [value])
  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      className={`w-full resize-none border-0 bg-transparent p-0 outline-none placeholder:text-ink2/35 ${
        tamil ? 'tamil ' : ''
      }${className}`}
    />
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
      className="tamil max-w-[60vw] truncate rounded-full border border-line bg-card px-2.5 py-1 font-heading text-[11px] font-semibold uppercase tracking-wide text-ink2 outline-none transition hover:border-brand-ring focus:border-brand-ring sm:max-w-xs"
    >
      {options.map((topic) => (
        <option key={topic} value={topic}>
          {sectionLabel(topic, lang)}
        </option>
      ))}
    </select>
  )
}
