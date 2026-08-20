import type { AnswerLetter, Question } from '../../types'
import { displayOption, type DisplayLang } from '../../types'
import { parseSolution, type SectionKey } from '../../lib/aptitudeSolution'
import { useT } from '../../lib/i18n'
import MathText from '../UI/MathText'

/**
 * Renders an aptitude explanation as a sectioned, textbook-style worked solution
 * (Given / From question / Asked) themed to the app: each section has a labelled
 * header with a divider rule, "Formula:" lines sit in bordered equation boxes,
 * and the final answer is a green callout. Legacy/unstructured explanations
 * degrade to a single untitled block of steps.
 *
 * Bilingual: in 'both' mode English and Tamil are shown as TWO side-by-side
 * panes (each parsed independently), so the two languages never intermix. In a
 * single-language mode only that language's pane is shown.
 */
export default function WorkedSolution({
  question,
  lang,
}: {
  question: Question
  lang: DisplayLang
}) {
  const en = question.explanation?.trim() || ''
  const ta = question.explanation_ta?.trim() || ''

  // Which language panes to show. 'both' shows English + Tamil side by side, but
  // only when a distinct Tamil explanation exists (else it would duplicate EN).
  const showBoth = lang === 'both' && !!en && !!ta
  const soloLang: DisplayLang = lang === 'ta' && ta ? 'ta' : 'en'
  const soloText = soloLang === 'ta' ? ta : en || ta
  if (!soloText && !showBoth) return null

  return (
    <div className="mt-3">
      {showBoth ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <SolutionPane question={question} text={en} label="English" />
          <SolutionPane question={question} text={ta} label="தமிழ்" />
        </div>
      ) : (
        <SolutionPane question={question} text={soloText} lang={soloLang} />
      )}
    </div>
  )
}

/**
 * One language's worked solution. `label` (shown only in bilingual mode) prints
 * a small language chip above the card. `lang` picks the language for the answer
 * option text; in bilingual mode it is inferred from the label.
 */
function SolutionPane({
  question,
  text,
  label,
  lang,
}: {
  question: Question
  text: string
  label?: string
  lang?: DisplayLang
}) {
  const { t } = useT()
  if (!text) return null

  const { sections, answerLetter, sectioned } = parseSolution(text)
  const answer = (answerLetter ?? question.correct_answer) as AnswerLetter | undefined
  const optLang: DisplayLang = lang ?? (label === 'தமிழ்' ? 'ta' : 'en')

  const sectionTitle: Record<Exclude<SectionKey, 'default'>, string> = {
    given: t('solGiven'),
    working: t('solWorking'),
    asked: t('solAsked'),
  }

  return (
    <div className="rounded-xl border border-secondary/20 bg-secondary/5 p-4">
      {label && (
        <p className="mb-2 font-heading text-2xs font-bold uppercase tracking-wider text-secondary/70">
          {label}
        </p>
      )}
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
          <div className="flex flex-col gap-3">
            {section.lines.map((line, i) =>
              line.kind === 'formula' ? (
                <div
                  key={i}
                  className="tamil rounded-lg border border-secondary/30 bg-tint px-3 py-2 text-sm font-semibold leading-loose text-ink"
                >
                  {line.label && (
                    <span className="mr-1 font-heading text-secondary">{line.label}:</span>
                  )}
                  <MathText text={line.text} />
                </div>
              ) : (
                <p
                  key={i}
                  className="tamil whitespace-pre-line pl-1 text-sm leading-loose text-navytext/80"
                >
                  <MathText text={line.text} />
                </p>
              )
            )}
          </div>
        </div>
      ))}

      {answer && (
        <div className="mt-3.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-lg border-l-4 border-mint bg-mintsoft px-3 py-2">
          <span className="font-heading text-xs font-bold uppercase tracking-wide text-mint">
            {t('solAnswer')}
          </span>
          <span className="tamil text-sm font-semibold text-mint">
            ({answer}) <MathText text={displayOption(question, answer, optLang)} />
          </span>
        </div>
      )}
    </div>
  )
}
