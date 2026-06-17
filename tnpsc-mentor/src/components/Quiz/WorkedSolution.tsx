import type { AnswerLetter, Question } from '../../types'
import { displayExplanation, displayOption, type DisplayLang } from '../../types'
import { parseSolution, type SectionKey } from '../../lib/aptitudeSolution'
import { useT } from '../../lib/i18n'

/**
 * Renders an aptitude explanation as a sectioned, textbook-style worked
 * solution (Given / From question / Asked) themed to the app: each section has
 * a labelled header with a divider rule, "Formula:" lines sit in bordered
 * equation boxes, and the final answer is a green callout. Legacy/unstructured
 * explanations degrade to a single untitled block of steps.
 */
export default function WorkedSolution({
  question,
  lang,
}: {
  question: Question
  lang: DisplayLang
}) {
  const { t } = useT()
  const text = displayExplanation(question, lang)
  if (!text) return null

  const { sections, answerLetter, sectioned } = parseSolution(text)
  const answer = (answerLetter ?? question.correct_answer) as AnswerLetter | undefined

  const sectionTitle: Record<Exclude<SectionKey, 'default'>, string> = {
    given: t('solGiven'),
    working: t('solWorking'),
    asked: t('solAsked'),
  }

  return (
    <div className="mt-3 rounded-xl border border-secondary/20 bg-secondary/5 p-4">
      {sections.map((section, si) => (
        <div key={si} className={si > 0 ? 'mt-3.5' : ''}>
          {section.key !== 'default' && (
            <p className="mb-1.5 border-b border-secondary/20 pb-1 font-heading text-xs font-bold uppercase tracking-wide text-secondary">
              {sectionTitle[section.key]}
            </p>
          )}
          {!sectioned && si === 0 && (
            <p className="mb-1.5 border-b border-secondary/20 pb-1 font-heading text-xs font-bold uppercase tracking-wide text-secondary">
              {t('explanationLabel')}
            </p>
          )}
          <div className="flex flex-col gap-1.5">
            {section.lines.map((line, i) =>
              line.kind === 'formula' ? (
                <div
                  key={i}
                  className="tamil rounded-lg border border-secondary/30 bg-tint px-3 py-1.5 text-[13px] font-semibold leading-relaxed text-ink"
                >
                  {line.label && (
                    <span className="mr-1 font-heading text-secondary">{line.label}:</span>
                  )}
                  {line.text}
                </div>
              ) : (
                <p
                  key={i}
                  className="tamil whitespace-pre-line pl-1 text-[13px] leading-relaxed text-navytext/80"
                >
                  {line.text}
                </p>
              )
            )}
          </div>
        </div>
      ))}

      {answer && (
        <div className="mt-3.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-lg border-l-4 border-green-400 bg-green-50 px-3 py-2">
          <span className="font-heading text-xs font-bold uppercase tracking-wide text-green-700">
            {t('solAnswer')}
          </span>
          <span className="tamil text-sm font-semibold text-green-700">
            ({answer}) {displayOption(question, answer, lang)}
          </span>
        </div>
      )}
    </div>
  )
}
