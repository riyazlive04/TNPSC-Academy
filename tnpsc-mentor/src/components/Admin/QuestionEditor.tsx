import { useState } from 'react'
import type { ReactNode } from 'react'
import { Loader2, X } from 'lucide-react'
import { SUBJECTS } from '../../lib/constants'
import { upsertAdminQuestion } from '../../lib/fetchQuestions'
import type { AnswerLetter, Category, Question, QuizConfig } from '../../types'
import { LETTERS } from '../../types'

const CATEGORIES: Category[] = ['pyq', 'samacheer', 'current_affairs', 'aptitude']
const DIFFICULTIES = ['easy', 'medium', 'hard']

interface QuestionEditorProps {
  /** The question being edited; null/undefined means "create new". */
  initial?: Question | null
  /** Config the admin arrived with - prefills classification for a new row. */
  config?: QuizConfig | null
  onClose: () => void
  onSaved: (q: Question, isNew: boolean) => void
}

type FormState = Record<string, string>

/** Seed the form from an existing question, falling back to the picker config. */
function buildInitialForm(initial?: Question | null, config?: QuizConfig | null): FormState {
  const q = initial ?? {}
  const c = config ?? ({} as QuizConfig)
  const s = (v: unknown) => (v == null ? '' : String(v))
  return {
    category: s((q as Question).category ?? c.category ?? 'pyq'),
    subject: s((q as Question).subject ?? c.subject),
    topic: s((q as Question).topic ?? c.topic),
    group_type: s((q as Question).group_type ?? c.group_type),
    standard: s((q as Question).standard ?? c.standard),
    year: s((q as Question).year),
    ca_month: s((q as Question).ca_month ?? c.ca_month),
    ca_type: s((q as Question).ca_type ?? c.ca_type),
    ca_topic: s((q as Question).ca_topic ?? c.ca_topic),
    aptitude_type: s((q as Question).aptitude_type ?? c.aptitude_type),
    aptitude_topic: s((q as Question).aptitude_topic ?? c.aptitude_topic),
    difficulty: s((q as Question).difficulty ?? 'medium'),
    source_url: s((q as Question).source_url),
    question_text: s((q as Question).question_text),
    option_a: s((q as Question).option_a),
    option_b: s((q as Question).option_b),
    option_c: s((q as Question).option_c),
    option_d: s((q as Question).option_d),
    explanation: s((q as Question).explanation),
    question_text_ta: s((q as Question).question_text_ta),
    option_a_ta: s((q as Question).option_a_ta),
    option_b_ta: s((q as Question).option_b_ta),
    option_c_ta: s((q as Question).option_c_ta),
    option_d_ta: s((q as Question).option_d_ta),
    explanation_ta: s((q as Question).explanation_ta),
  }
}

export default function QuestionEditor({
  initial,
  config,
  onClose,
  onSaved,
}: QuestionEditorProps) {
  const isNew = !initial?.id
  const [form, setForm] = useState<FormState>(() => buildInitialForm(initial, config))
  const [correct, setCorrect] = useState<AnswerLetter>(initial?.correct_answer ?? 'A')
  const [why, setWhy] = useState<Record<string, string>>(() => {
    const w = initial?.why_wrong ?? {}
    return { A: w.A ?? '', B: w.B ?? '', C: w.C ?? '', D: w.D ?? '' }
  })
  const [showClassification, setShowClassification] = useState(isNew)
  const [showTamil, setShowTamil] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (k: string) => (v: string) => setForm((f) => ({ ...f, [k]: v }))

  const handleSave = async () => {
    // Required-field validation before hitting the server.
    const missing: string[] = []
    if (!form.question_text.trim()) missing.push('question text')
    for (const l of LETTERS) {
      if (!form[`option_${l.toLowerCase()}`].trim()) missing.push(`option ${l}`)
    }
    if (!form.category) missing.push('category')
    if (missing.length) {
      setError(`Please fill in: ${missing.join(', ')}.`)
      return
    }

    // Only keep why-wrong reasons for letters that are actually wrong.
    const whyWrong: Partial<Record<AnswerLetter, string>> = {}
    for (const l of LETTERS) {
      if (l !== correct && why[l]?.trim()) whyWrong[l] = why[l].trim()
    }

    setSaving(true)
    setError('')
    try {
      const saved = await upsertAdminQuestion({
        ...(initial?.id ? { id: initial.id } : {}),
        category: form.category as Category,
        subject: form.subject,
        topic: form.topic,
        group_type: form.group_type as Question['group_type'],
        standard: form.standard ? Number(form.standard) : undefined,
        year: form.year ? Number(form.year) : undefined,
        ca_month: form.ca_month,
        ca_type: form.ca_type as Question['ca_type'],
        ca_topic: form.ca_topic,
        aptitude_type: form.aptitude_type as Question['aptitude_type'],
        aptitude_topic: form.aptitude_topic,
        difficulty: form.difficulty as Question['difficulty'],
        source_url: form.source_url,
        question_text: form.question_text.trim(),
        option_a: form.option_a.trim(),
        option_b: form.option_b.trim(),
        option_c: form.option_c.trim(),
        option_d: form.option_d.trim(),
        correct_answer: correct,
        explanation: form.explanation.trim(),
        why_wrong: Object.keys(whyWrong).length ? whyWrong : null,
        question_text_ta: form.question_text_ta.trim() || null,
        option_a_ta: form.option_a_ta.trim() || null,
        option_b_ta: form.option_b_ta.trim() || null,
        option_c_ta: form.option_c_ta.trim() || null,
        option_d_ta: form.option_d_ta.trim() || null,
        explanation_ta: form.explanation_ta.trim() || null,
      })
      onSaved(saved, isNew)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      setError(
        msg.includes('not authorized')
          ? 'You are not authorised to edit questions.'
          : `Could not save: ${msg}`
      )
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4">
      <div className="animate-pop my-4 w-full max-w-2xl rounded-3xl border border-line bg-card p-5 shadow-card sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-heading text-xl font-bold text-navytext">
            {isNew ? 'New Question' : 'Edit Question'}
          </h3>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-ink2 transition hover:bg-ink/5"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Classification (collapsible) */}
        <Collapsible
          label="Classification & metadata"
          open={showClassification}
          onToggle={() => setShowClassification((v) => !v)}
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <SelectField label="Category" value={form.category} onChange={set('category')} options={CATEGORIES} />
            <SelectField label="Difficulty" value={form.difficulty} onChange={set('difficulty')} options={DIFFICULTIES} />
            <SelectField label="Subject" value={form.subject} onChange={set('subject')} options={['', ...SUBJECTS]} />
            <Field label="Topic" value={form.topic} onChange={set('topic')} />
            <Field label="Standard" value={form.standard} onChange={set('standard')} placeholder="6-10" />
            <Field label="Year" value={form.year} onChange={set('year')} placeholder="e.g. 2023" />
            <Field label="CA Month" value={form.ca_month} onChange={set('ca_month')} placeholder="August 2025" />
            <Field label="CA Type" value={form.ca_type} onChange={set('ca_type')} placeholder="month_wise" />
            <Field label="CA Topic" value={form.ca_topic} onChange={set('ca_topic')} />
            <Field label="Aptitude Type" value={form.aptitude_type} onChange={set('aptitude_type')} placeholder="numerics" />
            <Field label="Aptitude Topic" value={form.aptitude_topic} onChange={set('aptitude_topic')} />
            <Field label="Source URL" value={form.source_url} onChange={set('source_url')} />
          </div>
        </Collapsible>

        {/* Question + options */}
        <TextArea label="Question text *" value={form.question_text} onChange={set('question_text')} rows={3} />

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {LETTERS.map((l) => (
            <div key={l}>
              <div className="mb-1 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCorrect(l)}
                  className={[
                    'flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition',
                    correct === l ? 'bg-green-500 text-white' : 'bg-primary/10 text-primary hover:bg-primary/20',
                  ].join(' ')}
                  aria-label={`Mark option ${l} correct`}
                >
                  {l}
                </button>
                <span className="font-heading text-xs font-semibold uppercase text-ink2">
                  Option {l} {correct === l && <span className="text-green-600">· correct</span>}
                </span>
              </div>
              <input
                value={form[`option_${l.toLowerCase()}`]}
                onChange={(e) => set(`option_${l.toLowerCase()}`)(e.target.value)}
                className={INPUT_CLS}
              />
              {l !== correct && (
                <input
                  value={why[l]}
                  onChange={(e) => setWhy((w) => ({ ...w, [l]: e.target.value }))}
                  placeholder={`Why ${l} is wrong (optional)`}
                  className="mt-1 w-full rounded-lg border border-line bg-canvas px-3 py-1.5 font-body text-xs text-ink2 outline-none focus:border-brand-ring"
                />
              )}
            </div>
          ))}
        </div>

        <div className="mt-3">
          <TextArea label="Explanation" value={form.explanation} onChange={set('explanation')} rows={3} />
        </div>

        {/* Tamil (collapsible) */}
        <div className="mt-3">
          <Collapsible
            label="Tamil translation (optional)"
            open={showTamil}
            onToggle={() => setShowTamil((v) => !v)}
          >
            <TextArea label="Question (Tamil)" value={form.question_text_ta} onChange={set('question_text_ta')} rows={2} />
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {LETTERS.map((l) => (
                <Field
                  key={l}
                  label={`Option ${l} (Tamil)`}
                  value={form[`option_${l.toLowerCase()}_ta`]}
                  onChange={set(`option_${l.toLowerCase()}_ta`)}
                />
              ))}
            </div>
            <div className="mt-2">
              <TextArea label="Explanation (Tamil)" value={form.explanation_ta} onChange={set('explanation_ta')} rows={2} />
            </div>
          </Collapsible>
        </div>

        {error && (
          <p className="mt-4 rounded-lg bg-coralsoft px-3 py-2 font-body text-sm font-medium text-coral">
            {error}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="rounded-full border border-line bg-card px-5 py-2.5 font-heading text-sm font-semibold text-ink2 transition hover:text-ink disabled:opacity-50"
          >
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving} className="btn-brand inline-flex items-center gap-2 px-6 py-2.5 text-sm">
            {saving && <Loader2 size={16} className="animate-spin" />}
            {isNew ? 'Create' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Small form primitives ──────────────────────────────────────────────────

const INPUT_CLS =
  'w-full rounded-lg border border-line bg-canvas px-3 py-2 font-body text-sm text-ink outline-none focus:border-brand-ring'
const LABEL_CLS = 'mb-1 block font-heading text-xs font-semibold uppercase tracking-wide text-ink2'

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <label className="block">
      <span className={LABEL_CLS}>{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={INPUT_CLS} />
    </label>
  )
}

function TextArea({
  label,
  value,
  onChange,
  rows = 3,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  rows?: number
}) {
  return (
    <label className="block">
      <span className={LABEL_CLS}>{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className={`${INPUT_CLS} resize-y`}
      />
    </label>
  )
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: string[]
}) {
  return (
    <label className="block">
      <span className={LABEL_CLS}>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={INPUT_CLS}>
        {options.map((o) => (
          <option key={o} value={o}>
            {o === '' ? '-' : o}
          </option>
        ))}
      </select>
    </label>
  )
}

function Collapsible({
  label,
  open,
  onToggle,
  children,
}: {
  label: string
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <div className="mb-3 rounded-2xl border border-line">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-2.5 font-heading text-sm font-semibold text-ink"
      >
        {label}
        <span className="text-ink2">{open ? '−' : '+'}</span>
      </button>
      {open && <div className="border-t border-line p-4">{children}</div>}
    </div>
  )
}
