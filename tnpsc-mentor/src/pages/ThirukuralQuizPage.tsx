import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowLeftRight,
  BookOpen,
  ChevronRight,
  HelpCircle,
  Layers,
  Library,
  PenLine,
  Shuffle,
} from 'lucide-react'
import SectionHeader from '../components/UI/SectionHeader'
import IconTile, { type Tint } from '../components/UI/IconTile'
import { List, ListRow } from '../components/UI/ListRow'
import { useT, type StringKey } from '../lib/i18n'
import {
  adhigaramList,
  filterQuestions,
  formatsFor,
  type TkFormat,
} from '../lib/thirukuralQuiz'
import type { QuizConfig } from '../types'

type Step = 'adhigaram' | 'type'

// Per-format presentation for the question-type branch.
const FORMAT_META: Record<TkFormat | 'all', { labelKey: StringKey; icon: React.ReactNode; tint: Tint }> = {
  all: { labelKey: 'tkMixed', icon: <Shuffle size={20} />, tint: 'violet' },
  meaning_choice: { labelKey: 'tkFmtMeaning', icon: <BookOpen size={18} />, tint: 'violet' },
  fill_in_the_blank: { labelKey: 'tkFmtFill', icon: <PenLine size={18} />, tint: 'violet' },
  quote_identification: { labelKey: 'tkFmtQuote', icon: <HelpCircle size={18} />, tint: 'violet' },
  multi_verse_synthesis: { labelKey: 'tkFmtSynthesis', icon: <Layers size={18} />, tint: 'violet' },
  match_the_following: { labelKey: 'tkFmtMatch', icon: <ArrowLeftRight size={18} />, tint: 'violet' },
}

/**
 * Thirukkural quiz picker - chapter (adhigaram) then question type. Choosing a
 * type hands off to the SAME pre-test instructions → quiz → result flow every
 * other section uses; the questions are served from the bundled bank (see
 * fetchQuestionsForConfig / submitTest, which special-case category 'thirukural').
 */
export default function ThirukuralQuizPage() {
  const navigate = useNavigate()
  const { t, lang } = useT()

  const [step, setStep] = useState<Step>('adhigaram')
  const [adhigaram, setAdhigaram] = useState<number | 'all'>('all')

  const adhigarams = useMemo(() => adhigaramList(), [])
  const formats = useMemo(() => formatsFor(adhigaram), [adhigaram])
  const adhigaramPool = useMemo(() => filterQuestions('all', adhigaram).length, [adhigaram])

  const chosenAdhigaram =
    adhigaram === 'all' ? null : adhigarams.find((a) => a.no === adhigaram) ?? null
  const adhigaramLabel = chosenAdhigaram
    ? lang === 'ta'
      ? chosenAdhigaram.ta
      : chosenAdhigaram.en
    : t('tkAllChapters')

  const chooseAdhigaram = (no: number | 'all') => {
    setAdhigaram(no)
    setStep('type')
  }

  const back = () => {
    if (step === 'type') {
      setAdhigaram('all')
      return setStep('adhigaram')
    }
    navigate('/test-arena')
  }

  // Hand off to the shared pre-test flow (instructions → quiz → result).
  const startFormat = (format: TkFormat | 'all') => {
    const pool = filterQuestions(format, adhigaram).length
    if (pool === 0) return
    const config: QuizConfig = {
      category: 'thirukural',
      tkAdhigaram: adhigaram === 'all' ? undefined : adhigaram,
      tkFormat: format === 'all' ? undefined : format,
      label: `${adhigaramLabel} · ${t(FORMAT_META[format].labelKey)}`,
      availableCount: pool,
    }
    navigate('/quiz/instructions', { state: config })
  }

  const heading = step === 'adhigaram' ? t('tkChooseChapter') : t('tkChooseFormat')
  const hint = step === 'adhigaram' ? t('tkChapterHint') : t('typeStepHint')

  return (
    <>
      <div className="mx-auto max-w-3xl px-4 py-6 lg:py-8">
        {/* Back + breadcrumb */}
        <div className="mb-5 flex items-center justify-between gap-3">
          <button
            onClick={back}
            className="inline-flex items-center gap-2 font-heading text-sm font-semibold text-muted transition-colors hover:text-primary"
          >
            <ArrowLeft size={16} /> {step === 'adhigaram' ? t('testArena') : t('back')}
          </button>
          {step === 'type' && (
            <div className="flex min-w-0 items-center gap-1.5 text-xs font-semibold">
              <button
                onClick={() => {
                  setAdhigaram('all')
                  setStep('adhigaram')
                }}
                className="max-w-[12rem] truncate rounded-full bg-tint-violet px-2.5 py-1 font-heading text-primary transition-opacity hover:opacity-80"
              >
                <span className="tamil">{adhigaramLabel}</span>
              </button>
            </div>
          )}
        </div>

        {/* Title block */}
        <div className="mb-5">
          <span className="tamil font-display text-[13px] font-bold uppercase tracking-[0.14em] text-accent">
            {t('thirukuralBadge')}
          </span>
          <h1 className="tamil mt-1.5 font-display text-[22px] font-bold tracking-tight text-ink lg:text-[26px]">
            {heading}
          </h1>
          <p className="tamil mt-1 font-body text-[15px] text-muted">{hint}</p>
        </div>

        {/* Animated step body */}
        <div key={step} className="animate-fadeInFast">
          {step === 'adhigaram' && (
            <div className="space-y-6">
              {/* All chapters - the highlighted shortcut */}
              <button
                onClick={() => chooseAdhigaram('all')}
                className="hero-panel interactive group relative flex w-full items-center gap-4 p-5 text-left"
              >
                <span
                  className="pointer-events-none absolute inset-0 bg-hero-grid opacity-50"
                  style={{ backgroundSize: '18px 18px' }}
                />
                <span className="relative grid h-11 w-11 flex-shrink-0 place-items-center rounded-xl bg-white/15 text-white ring-1 ring-white/20">
                  <Library size={20} />
                </span>
                <span className="relative min-w-0 flex-1">
                  <span className="tamil block font-heading text-base font-semibold text-white">
                    {t('tkAllChapters')}
                  </span>
                  <span className="tamil block font-body text-xs text-white/70">
                    {t('tkAllChaptersSub')} ·{' '}
                    <span className="font-heading font-semibold tabular-nums text-white/90">
                      {filterQuestions('all', 'all').length}
                    </span>{' '}
                    {t('questionsCount')}
                  </span>
                </span>
                <ChevronRight
                  size={18}
                  className="relative flex-shrink-0 text-white/50 transition group-hover:translate-x-0.5 group-hover:text-white"
                />
              </button>

              <section className="space-y-1">
                <SectionHeader title={t('tkByChapter')} className="px-1" />
                <List>
                  {adhigarams.map((a, i) => (
                    <ListRow
                      key={a.no}
                      onClick={() => chooseAdhigaram(a.no)}
                      style={{ '--i': i } as React.CSSProperties}
                      leading={
                        <IconTile tint="violet">
                          <span className="font-heading text-[13px] font-bold">{a.no}</span>
                        </IconTile>
                      }
                      title={lang === 'ta' ? a.ta : a.en}
                      subtitle={
                        <span className="tamil flex items-baseline gap-1">
                          <span className="font-heading font-bold tabular-nums text-primary">
                            {a.count}
                          </span>
                          <span>{t('questionsCount')}</span>
                          {a.range && (
                            <span className="text-muted/70">
                              {' · '}
                              {a.range[0]}-{a.range[1]}
                            </span>
                          )}
                        </span>
                      }
                    />
                  ))}
                </List>
              </section>
            </div>
          )}

          {step === 'type' && (
            <div className="space-y-3">
              {/* Mixed - recommended, highlighted */}
              <button
                onClick={() => startFormat('all')}
                className="hero-panel interactive group relative flex w-full items-center gap-4 p-5 text-left"
              >
                <span
                  className="pointer-events-none absolute inset-0 bg-hero-grid opacity-50"
                  style={{ backgroundSize: '18px 18px' }}
                />
                <span className="relative grid h-11 w-11 flex-shrink-0 place-items-center rounded-xl bg-white/15 text-white ring-1 ring-white/20">
                  <Shuffle size={20} />
                </span>
                <span className="relative min-w-0 flex-1">
                  <span className="tamil block font-heading text-base font-semibold text-white">
                    {t('tkMixed')}
                  </span>
                  <span className="block font-body text-xs text-white/70">
                    {adhigaramPool} {t('questionsCount')}
                  </span>
                </span>
                <ChevronRight
                  size={18}
                  className="relative flex-shrink-0 text-white/50 transition group-hover:translate-x-0.5 group-hover:text-white"
                />
              </button>

              <List>
                {formats.map((f, i) => (
                  <ListRow
                    key={f.format}
                    onClick={() => startFormat(f.format)}
                    style={{ '--i': i } as React.CSSProperties}
                    leading={
                      <IconTile tint={FORMAT_META[f.format].tint}>
                        {FORMAT_META[f.format].icon}
                      </IconTile>
                    }
                    title={t(FORMAT_META[f.format].labelKey)}
                    trailing={
                      <span className="flex-shrink-0 font-heading text-sm font-semibold text-muted">
                        {f.count > 0 ? f.count : '-'}
                      </span>
                    }
                  />
                ))}
              </List>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
