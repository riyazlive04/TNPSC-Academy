import type { AnswerLetter } from '../types'

/**
 * Parser that turns an aptitude explanation into a sectioned "worked solution"
 * (Given / From question / Asked), so it can be rendered like a textbook
 * solution. Explanations authored in the sectioned convention carry header
 * lines ("Given:", "From question:", "Asked:" - or their Tamil equivalents);
 * within a section, "Formula:" / "Rule:" lines are emphasised and a trailing
 * "→ Option (X)" becomes the answer. Unstructured/legacy text still renders:
 * it just falls into a single default section as plain steps.
 */

export type SolutionLineKind = 'formula' | 'step'
export type SectionKey = 'given' | 'working' | 'asked' | 'default'

export interface SolutionLine {
  kind: SolutionLineKind
  /** Label captured from a "Formula:"/"Rule:" prefix, if any. */
  label?: string
  text: string
}

export interface SolutionSection {
  key: SectionKey
  lines: SolutionLine[]
}

export interface ParsedSolution {
  sections: SolutionSection[]
  /** Letter parsed from a trailing "→ Option (X)". */
  answerLetter?: AnswerLetter
  /** True when at least one real section header was found. */
  sectioned: boolean
}

// Section headers (English + the Tamil equivalents the bank is authored with).
const SECTION_HEADERS: { re: RegExp; key: SectionKey }[] = [
  { re: /^given\s*[:：]?\s*$/i, key: 'given' },
  { re: /^(from question|working|solution)\s*[:：]?\s*$/i, key: 'working' },
  { re: /^asked\s*[:：]?\s*$/i, key: 'asked' },
  { re: /^(தரவுகள்|கொடுக்கப்பட்டவை|தரப்பட்டவை)\s*[:：]?\s*$/, key: 'given' },
  { re: /^(வினாவிலிருந்து|தீர்வு|செயல்முறை)\s*[:：]?\s*$/, key: 'working' },
  { re: /^(கேட்டது|தேவை|கேட்கப்பட்டது)\s*[:：]?\s*$/, key: 'asked' },
]

const FORMULA_RE = /^(formula|rule|வாய்ப்பாடு|விதி)\s*[:：]/i
const OPTION_RE = /(?:→|⇒|->)?\s*(?:option|விடை)\s*\(?\s*([A-D])\s*\)?\.?\s*$/i

export function parseSolution(text: string): ParsedSolution {
  const sections: SolutionSection[] = []
  let current: SolutionSection = { key: 'default', lines: [] }
  let answerLetter: AnswerLetter | undefined
  let sectioned = false

  const flush = () => {
    if (current.lines.length || current.key !== 'default') sections.push(current)
  }

  for (const raw of text.split('\n')) {
    let line = raw.trim()
    if (!line) continue

    const header = SECTION_HEADERS.find((h) => h.re.test(line))
    if (header) {
      flush()
      current = { key: header.key, lines: [] }
      sectioned = true
      continue
    }

    // Pull a trailing "→ Option (X)" off whatever line it's attached to.
    const m = line.match(OPTION_RE)
    if (m) {
      answerLetter = m[1].toUpperCase() as AnswerLetter
      line = line.replace(OPTION_RE, '').trim()
      line = line.replace(/[→⇒\---]\s*$/, '').trim()
      if (!line) continue
    }

    const fm = line.match(FORMULA_RE)
    if (fm) {
      const label = fm[0].replace(/[:：]\s*$/, '').trim()
      current.lines.push({ kind: 'formula', label, text: line.slice(fm[0].length).trim() })
    } else {
      current.lines.push({ kind: 'step', text: line })
    }
  }
  flush()

  return { sections, answerLetter, sectioned }
}
