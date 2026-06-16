import type { ReactNode } from 'react'
import type { Question, DisplayLang, ParsedMatch, MatchList } from '../../types'
import { displayQuestion, parseMatchQuestion, formatMatchLabel } from '../../types'

interface QuestionStemProps {
  question: Question
  lang: DisplayLang
  /** Tailwind classes for the question/preamble text (controls size per screen). */
  textClassName: string
  /** Optional inline prefix before the stem text, e.g. a "Q1." label. */
  prefix?: ReactNode
}

/**
 * Renders a question stem. For "Match List I with List II" questions it lays the
 * two lists out side-by-side (like the printed exam) instead of stacking them
 * vertically; everything else renders as the usual pre-wrapped paragraph.
 */
export default function QuestionStem({ question, lang, textClassName, prefix }: QuestionStemProps) {
  if (question.question_type === 'match') {
    // Parse each language's raw text independently (bilingual 'both' would
    // otherwise concatenate two match blocks into one unparseable blob).
    const en = question.question_text
    const ta = question.question_text_ta?.trim() || null
    const texts =
      lang === 'ta' ? [ta ?? en] : lang === 'both' ? [en, ...(ta ? [ta] : [])] : [en]
    const parsed = texts.map(parseMatchQuestion)
    if (parsed.every(Boolean)) {
      return (
        <div className="mb-5 space-y-4 sm:mb-6">
          {(parsed as ParsedMatch[]).map((p, i) => (
            <MatchBlock
              key={i}
              parsed={p}
              textClassName={textClassName}
              prefix={i === 0 ? prefix : undefined}
            />
          ))}
        </div>
      )
    }
    // else: fall through to plain rendering below
  }

  return (
    <p className={`tamil whitespace-pre-line ${textClassName}`}>
      {prefix}
      {displayQuestion(question, lang)}
    </p>
  )
}

function MatchBlock({
  parsed,
  textClassName,
  prefix,
}: {
  parsed: ParsedMatch
  textClassName: string
  prefix?: ReactNode
}) {
  const { preamble, listI, listII, trailing } = parsed
  return (
    <div>
      {(preamble || prefix) && (
        <p className={`tamil mb-3 ${textClassName}`}>
          {prefix}
          {preamble}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        <ListColumn list={listI} />
        <ListColumn list={listII} />
      </div>
      {/* grid-cols-2 keeps List I / List II side-by-side at every width; columns
          shrink (min-w-0) and text wraps instead of overflowing on phones. */}
      {trailing && (
        <p className="tamil mt-3 text-sm font-medium text-navytext/70">{trailing}</p>
      )}
    </div>
  )
}

function ListColumn({ list }: { list: MatchList }) {
  return (
    <div className="min-w-0 rounded-xl border border-line bg-tint/40 p-2.5 sm:p-4">
      {list.header && (
        <p className="tamil mb-2 font-heading text-sm font-bold text-secondary sm:text-base">
          {list.header}
        </p>
      )}
      <ul className="flex flex-col gap-2">
        {list.items.map((item) => (
          <li
            key={item.label}
            className="tamil flex gap-1.5 text-sm leading-relaxed text-navytext sm:gap-2 sm:text-base"
          >
            <span className="font-heading font-bold text-navytext/70">
              {formatMatchLabel(item.label)}
            </span>
            <span className="min-w-0 flex-1 break-words">{item.text}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
