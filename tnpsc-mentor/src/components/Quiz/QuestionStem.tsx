import { Fragment, type ReactNode } from 'react'
import type { Question, DisplayLang, ParsedMatch, MatchItem } from '../../types'
import { displayQuestion, parseMatchQuestion, formatMatchLabel } from '../../types'
import MathText from '../UI/MathText'

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
  // Render List I / List II side-by-side for two-list match questions. We try
  // this when the question is tagged 'match', and for the whole Group 2 / Group 4
  // PYQ banks ('pyq2'/'pyq4') where match tagging is uneven — the parser is the
  // gate: it returns null for non-matches, so we safely fall back to the plain
  // layout (single-list "which pair is correct?" items stay as a normal list).
  if (
    question.question_type === 'match' ||
    question.category === 'pyq2' ||
    question.category === 'pyq4'
  ) {
    // Parse each language's raw text independently (bilingual 'both' would
    // otherwise concatenate two match blocks into one unparseable blob).
    const en = question.question_text
    const ta = question.question_text_ta?.trim() || null
    const texts =
      lang === 'ta' ? [ta ?? en] : lang === 'both' ? [en, ...(ta ? [ta] : [])] : [en]
    const parsed = texts.map(parseMatchQuestion)
    // Each language stands on its own: in bilingual mode a malformed Tamil twin
    // used to drag the (perfectly parseable) English back to a flat paragraph.
    if (parsed.some(Boolean)) {
      return (
        <div className="mb-5 space-y-4 sm:mb-6">
          {texts.map((text, i) =>
            parsed[i] ? (
              <MatchBlock
                key={i}
                parsed={parsed[i] as ParsedMatch}
                textClassName={textClassName}
                prefix={i === 0 ? prefix : undefined}
              />
            ) : (
              <p key={i} className={`tamil whitespace-pre-line ${textClassName}`}>
                {i === 0 ? prefix : null}
                <MathText text={text} />
              </p>
            )
          )}
        </div>
      )
    }
    // else: fall through to plain rendering below
  }

  return (
    <p className={`tamil whitespace-pre-line ${textClassName}`}>
      {prefix}
      <MathText text={displayQuestion(question, lang)} />
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
  const hasHeader = Boolean(listI.header || listII.header)
  const rowCount = Math.max(listI.items.length, listII.items.length)
  return (
    <div>
      {(preamble || prefix) && (
        <p className={`tamil mb-3 ${textClassName}`}>
          {prefix}
          <MathText text={preamble} />
        </p>
      )}
      {/* One shared grid (not two independent columns) so each List I item and
          its List II counterpart sit on the same grid row and stay vertically
          aligned even when either text wraps to a different number of lines. The
          center border-l reads as two columns within a single card. */}
      <div className="overflow-hidden rounded-xl border border-line bg-tint/40">
        <div className="grid grid-cols-2">
          {hasHeader && (
            <>
              <HeaderCell>{listI.header}</HeaderCell>
              <HeaderCell className="border-l border-line">{listII.header}</HeaderCell>
            </>
          )}
          {Array.from({ length: rowCount }).map((_, r) => (
            <Fragment key={r}>
              <ItemCell item={listI.items[r]} topBorder={hasHeader || r > 0} />
              <ItemCell
                item={listII.items[r]}
                topBorder={hasHeader || r > 0}
                className="border-l border-line"
              />
            </Fragment>
          ))}
        </div>
      </div>
      {trailing && (
        <p className="tamil mt-3 text-sm font-medium text-navytext/70">{trailing}</p>
      )}
    </div>
  )
}

function HeaderCell({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={`tamil border-b border-line p-2.5 font-heading text-sm font-bold text-secondary sm:p-4 sm:text-base ${className}`}
    >
      {children}
    </p>
  )
}

function ItemCell({
  item,
  topBorder,
  className = '',
}: {
  item?: MatchItem
  topBorder: boolean
  className?: string
}) {
  return (
    <div
      className={`tamil flex gap-1.5 p-2.5 text-sm leading-relaxed text-navytext sm:gap-2 sm:p-4 sm:text-base ${
        topBorder ? 'border-t border-line' : ''
      } ${className}`}
    >
      {item && (
        <>
          {/* Already-paired rows ("(1) NHRC – 1993") number the row once, on the
              left; the right-hand cell carries no label of its own. */}
          {item.label && (
            <span className="font-heading font-bold text-navytext/70">
              {formatMatchLabel(item.label)}
            </span>
          )}
          <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
            <MathText text={item.text} />
          </span>
        </>
      )}
    </div>
  )
}
