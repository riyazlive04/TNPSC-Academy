import { ScrollText } from 'lucide-react'
import OptionButton from '../Quiz/OptionButton'
import type { DisplayLang } from '../../types'
import { useT } from '../../lib/i18n'
import {
  TK_LETTERS,
  tkInline,
  type TkBilingual,
  type TkLetter,
  type TkQuestion,
} from '../../lib/thirukuralQuiz'

interface Props {
  q: TkQuestion
  lang: DisplayLang
  selected: TkLetter | null
  onSelect: (letter: TkLetter) => void
  /** Review mode: highlight the correct option (and a wrong pick). */
  reveal?: boolean
}

/**
 * One Thirukkural question. Every format gets a styled "verse block" above the
 * standard A-D option list - fill-in-the-blank shows the couplet (with its blank
 * inline) exactly the way "match the following" lays its two lists out, so the
 * two special formats read consistently. Options reuse the shared OptionButton.
 */
export default function ThirukuralQuestionCard({ q, lang, selected, onSelect, reveal }: Props) {
  const { t } = useT()

  return (
    <div className="animate-fadeIn">
      {/* Quiet badges: chapter + difficulty. */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {q.adhigaram_en && (
          <span className="tamil max-w-[60vw] truncate rounded-full bg-tint-violet px-2.5 py-1 font-heading text-2xs font-semibold text-primary sm:max-w-[18rem]">
            {lang === 'ta' ? q.adhigaram_ta ?? q.adhigaram_en : q.adhigaram_en}
          </span>
        )}
        <span className="rounded-full bg-tint-coral px-2.5 py-1 font-heading text-2xs font-semibold uppercase tracking-wide text-accent">
          {q.difficulty}
        </span>
      </div>

      {/* Stem / prompt */}
      <p className="tamil mb-4 whitespace-pre-line font-display text-lg font-bold leading-relaxed text-ink sm:text-xl">
        {lang === 'ta'
          ? q.stem.ta || q.stem.en
          : lang === 'both' && q.stem.ta && q.stem.ta !== q.stem.en
            ? `${q.stem.en}\n${q.stem.ta}`
            : q.stem.en}
      </p>

      {/* Verse block(s) - the format-specific presentation. */}
      {q.couplet && (
        <VerseBlock couplet={q.couplet} lang={lang} label={t('tkVerse')} className="mb-5" />
      )}

      {q.couplets && (
        <div className="mb-5 grid gap-3 sm:grid-cols-2">
          {q.couplets.map((c, i) => (
            <VerseBlock
              key={i}
              couplet={c}
              lang={lang}
              label={`${t('tkVerse')} ${String.fromCharCode(65 + i)}`}
            />
          ))}
        </div>
      )}

      {q.left && q.right && (
        <div className="mb-5 grid grid-cols-2 gap-2 sm:gap-3">
          <MatchColumn
            header={t('tkListVerses')}
            entries={Object.entries(q.left)}
            lang={lang}
          />
          <MatchColumn
            header={t('tkListChapters')}
            entries={Object.entries(q.right)}
            lang={lang}
          />
        </div>
      )}

      {/* For match items, label the columns the option strings map onto. */}
      {q.left && (
        <p className="mb-2 px-1 font-heading text-2xs font-semibold uppercase tracking-wide text-muted">
          {Object.keys(q.left).join('  ·  ')}
        </p>
      )}

      {/* Options */}
      <div className="flex flex-col gap-2.5">
        {TK_LETTERS.map((letter) => {
          const isCorrect = Boolean(reveal) && q.answer === letter
          const isChosenWrong = Boolean(reveal) && selected === letter && q.answer !== letter
          return (
            <OptionButton
              key={letter}
              letter={letter}
              text={tkInline(q.options[letter], lang)}
              selected={!reveal && selected === letter}
              onSelect={() => onSelect(letter)}
              disabled={reveal}
              reveal={reveal ? { isCorrect, isChosenWrong } : undefined}
            />
          )
        })}
      </div>
    </div>
  )
}

/** A bilingual couplet in a tinted verse card (Tamil lines split on the "/"). */
function VerseBlock({
  couplet,
  lang,
  label,
  className = '',
}: {
  couplet: TkBilingual
  lang: DisplayLang
  label: string
  className?: string
}) {
  const showTa = lang !== 'en'
  const showEn = lang !== 'ta'
  const taLines = couplet.ta
    ? couplet.ta.split('/').map((s) => s.trim()).filter(Boolean)
    : []
  return (
    <div className={`rounded-card border border-line bg-tint-violet/40 p-4 ${className}`}>
      <span className="mb-2 flex items-center gap-1.5 font-heading text-2xs font-bold uppercase tracking-wide text-primary">
        <ScrollText size={13} />
        <span className="tamil">{label}</span>
      </span>
      {showTa && taLines.length > 0 && (
        <p className="tamil font-display text-base font-semibold leading-relaxed text-ink sm:text-lg">
          {taLines.map((line, i) => (
            <span key={i}>
              {i > 0 && <br />}
              {line}
            </span>
          ))}
        </p>
      )}
      {showEn && (
        <p
          className={`font-display italic leading-relaxed ${
            showTa ? 'mt-1.5 text-sm font-medium text-muted' : 'text-base font-semibold text-ink'
          }`}
        >
          {couplet.en}
        </p>
      )}
    </div>
  )
}

/** One side of a match grid (the verses, or the chapters), styled like the main
 *  app's "Match List I / List II" columns. */
function MatchColumn({
  header,
  entries,
  lang,
}: {
  header: string
  entries: [string, TkBilingual][]
  lang: DisplayLang
}) {
  return (
    <div className="min-w-0 rounded-xl border border-line bg-tint/40 p-2.5 sm:p-4">
      <p className="tamil mb-2 font-heading text-sm font-bold text-secondary sm:text-base">
        {header}
      </p>
      <ul className="flex flex-col gap-2">
        {entries.map(([label, val]) => (
          <li
            key={label}
            className="tamil flex gap-1.5 text-sm leading-relaxed text-navytext sm:gap-2 sm:text-base"
          >
            <span className="font-heading font-bold text-navytext/70">
              {/^\d+$/.test(label) ? `${label}.` : `(${label})`}
            </span>
            <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{tkInline(val, lang)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
