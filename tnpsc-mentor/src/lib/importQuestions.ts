import { api } from './api'
import type { AnswerLetter, Category } from '../types'

/**
 * Bulk-import pipeline for the Admin question bank. Parses a CSV or JSON file
 * into normalised question drafts, validates them, and inserts them through the
 * is_admin()-gated `admin_bulk_insert_questions` RPC (which tags each row
 * source_url = 'tnpsc-official' so the old mock bank can be purged cleanly).
 */

export const CATEGORIES: Category[] = ['pyq', 'samacheer', 'current_affairs', 'aptitude', 'outer']
const DIFFICULTIES = ['easy', 'medium', 'hard']
// A-D are required on every row; E is optional (only the 5-option analogy bank
// uses it). REQUIRED_LETTERS drives the "option is empty" check; ALL_LETTERS
// drives correct-answer validation and per-option why_wrong assembly.
const REQUIRED_LETTERS: AnswerLetter[] = ['A', 'B', 'C', 'D']
const ALL_LETTERS: AnswerLetter[] = ['A', 'B', 'C', 'D', 'E']

/** Canonical import columns. Required ones are marked in the docs / template. */
export interface ImportRow {
  category: string
  // "outer" subject banks carry a Type discriminator; when Type=outer the row's
  // `category` is really the subject slug and is remapped to category='outer'.
  Type?: string
  type?: string
  question_text: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  // Optional 5th option (analogy reasoning bank). Blank/absent on 4-option rows.
  option_e?: string
  correct_answer: string
  explanation?: string
  subject?: string
  unit?: string
  topic?: string
  group_type?: string
  standard?: string | number
  year?: string | number
  ca_month?: string
  ca_year?: string | number
  ca_type?: string
  ca_topic?: string
  question_type?: string
  // qid in source JSON is stored as external_id for deduplication / cross-reference.
  qid?: string
  external_id?: string
  aptitude_type?: string
  aptitude_topic?: string
  difficulty?: string
  source_url?: string
  question_text_ta?: string
  option_a_ta?: string
  option_b_ta?: string
  option_c_ta?: string
  option_d_ta?: string
  option_e_ta?: string
  explanation_ta?: string
  // Per-option "why wrong" - accepted as separate CSV columns or a JSON object.
  why_wrong_a?: string
  why_wrong_b?: string
  why_wrong_c?: string
  why_wrong_d?: string
  why_wrong?: Record<string, string>
  // Tamil per-option rationale (object form only).
  why_wrong_ta?: Record<string, string>
}

export interface RowError {
  row: number // 1-based, matching a spreadsheet
  message: string
}

export interface ParseResult {
  rows: Record<string, unknown>[]
  parseError?: string
}

// ─── CSV parsing (RFC-4180-ish: quotes, embedded commas/newlines, "" escapes) ─

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []
  let field = ''
  let record: string[] = []
  let inQuotes = false
  const src = text.replace(/\r\n?/g, '\n')

  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += c
      }
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      record.push(field)
      field = ''
    } else if (c === '\n') {
      record.push(field)
      rows.push(record)
      record = []
      field = ''
    } else {
      field += c
    }
  }
  // Flush the trailing field/record (file may not end in a newline).
  if (field.length > 0 || record.length > 0) {
    record.push(field)
    rows.push(record)
  }

  if (!rows.length) return []
  const header = rows[0].map((h) => h.trim().toLowerCase())
  return rows
    .slice(1)
    .filter((r) => r.some((c) => c.trim() !== '')) // skip blank lines
    .map((r) => {
      const obj: Record<string, string> = {}
      header.forEach((h, idx) => {
        obj[h] = (r[idx] ?? '').trim()
      })
      return obj
    })
}

/** Detect CSV vs JSON by extension/content and return raw row objects. */
export function parseImportText(filename: string, text: string): ParseResult {
  const isJson = filename.toLowerCase().endsWith('.json') || text.trim().startsWith('[')
  if (isJson) {
    try {
      const data = JSON.parse(text)
      if (!Array.isArray(data)) return { rows: [], parseError: 'JSON must be an array of question objects.' }
      return { rows: data }
    } catch (e) {
      return { rows: [], parseError: `Invalid JSON: ${e instanceof Error ? e.message : 'parse error'}` }
    }
  }
  try {
    return { rows: parseCsv(text) }
  } catch (e) {
    return { rows: [], parseError: `Could not parse CSV: ${e instanceof Error ? e.message : 'error'}` }
  }
}

// ─── Validation + normalisation ──────────────────────────────────────────────

const str = (v: unknown) => (v == null ? '' : String(v).trim())

/** Validate raw rows; returns the clean drafts plus per-row errors. */
export function validateRows(raw: Record<string, unknown>[]): {
  valid: Record<string, unknown>[]
  errors: RowError[]
} {
  const valid: Record<string, unknown>[] = []
  const errors: RowError[] = []
  // Track external_ids seen so far so a duplicate within this batch is rejected
  // (a re-import of the same qid twice would otherwise insert two copies).
  const seenExternalIds = new Set<string>()

  raw.forEach((r, i) => {
    const rowNum = i + 2 // +1 for 0-index, +1 for the header line
    // "outer" subject banks tag rows with Type=outer and put the subject slug in
    // `category`; remap so category='outer' and the subject is preserved.
    const isOuter = str(r.Type ?? r.type).toLowerCase() === 'outer'
    const category = isOuter ? 'outer' : str(r.category).toLowerCase()
    const unit = str(r.unit)
    const subject = str(r.subject) || (isOuter ? unit || str(r.category) : '')
    const correct = str(r.correct_answer).toUpperCase()
    const rowErrs: string[] = []

    if (!CATEGORIES.includes(category as Category))
      rowErrs.push(`category "${str(r.category)}" must be one of ${CATEGORIES.join(', ')}`)
    if (!str(r.question_text)) rowErrs.push('question_text is empty')
    for (const l of REQUIRED_LETTERS) {
      if (!str(r[`option_${l.toLowerCase()}`])) rowErrs.push(`option_${l.toLowerCase()} is empty`)
    }
    const hasE = !!str(r.option_e)
    if (!ALL_LETTERS.includes(correct as AnswerLetter))
      rowErrs.push(`correct_answer "${str(r.correct_answer)}" must be A, B, C, D or E`)
    if (correct === 'E' && !hasE)
      rowErrs.push('correct_answer is E but option_e is empty')

    const standard = str(r.standard)
    if (standard && ![6, 7, 8, 9, 10].includes(Number(standard)))
      rowErrs.push('standard must be 6-10')
    const difficulty = str(r.difficulty).toLowerCase()
    if (difficulty && !DIFFICULTIES.includes(difficulty))
      rowErrs.push('difficulty must be easy, medium or hard')

    // Year fields, when present, must be whole numbers (a "2o24" typo would
    // otherwise sail through and corrupt the bank).
    const year = str(r.year)
    if (year && !/^\d+$/.test(year)) rowErrs.push(`year "${year}" must be numeric`)
    const caYear = str(r.ca_year)
    if (caYear && !/^\d+$/.test(caYear)) rowErrs.push(`ca_year "${caYear}" must be numeric`)

    // Duplicate external_id within this batch (accepts qid or external_id).
    const externalId = str(r.external_id) || str(r.qid)
    if (externalId) {
      if (seenExternalIds.has(externalId))
        rowErrs.push(`duplicate external_id "${externalId}" in this batch`)
      else seenExternalIds.add(externalId)
    }

    if (rowErrs.length) {
      errors.push({ row: rowNum, message: rowErrs.join('; ') })
      return
    }

    // Assemble why_wrong from per-letter columns or a provided object.
    const why: Record<string, string> = {}
    const provided = (r.why_wrong as Record<string, string> | undefined) ?? {}
    for (const l of ALL_LETTERS) {
      if (l === 'E' && !hasE) continue
      const v = str(r[`why_wrong_${l.toLowerCase()}`]) || str(provided[l])
      if (l !== correct && v) why[l] = v
    }
    // Tamil rationale (object form only).
    const whyTa: Record<string, string> = {}
    const providedTa = (r.why_wrong_ta as Record<string, string> | undefined) ?? {}
    for (const l of ALL_LETTERS) {
      if (l === 'E' && !hasE) continue
      const v = str(providedTa[l])
      if (l !== correct && v) whyTa[l] = v
    }

    valid.push({
      category,
      question_text: str(r.question_text),
      option_a: str(r.option_a),
      option_b: str(r.option_b),
      option_c: str(r.option_c),
      option_d: str(r.option_d),
      option_e: str(r.option_e),
      correct_answer: correct,
      explanation: str(r.explanation),
      subject,
      unit,
      topic: str(r.topic),
      group_type: str(r.group_type),
      standard,
      year: str(r.year),
      ca_month: str(r.ca_month),
      ca_year: str(r.ca_year),
      ca_type: str(r.ca_type),
      ca_topic: str(r.ca_topic),
      question_type: str(r.question_type),
      // Accept qid (source JSON) or external_id (CSV) for the same column.
      external_id: str(r.external_id) || str(r.qid),
      aptitude_type: str(r.aptitude_type),
      aptitude_topic: str(r.aptitude_topic),
      difficulty,
      source_url: str(r.source_url),
      question_text_ta: str(r.question_text_ta),
      option_a_ta: str(r.option_a_ta),
      option_b_ta: str(r.option_b_ta),
      option_c_ta: str(r.option_c_ta),
      option_d_ta: str(r.option_d_ta),
      option_e_ta: str(r.option_e_ta),
      explanation_ta: str(r.explanation_ta),
      why_wrong: Object.keys(why).length ? why : null,
      why_wrong_ta: Object.keys(whyTa).length ? whyTa : null,
    })
  })

  return { valid, errors }
}

/** Insert validated rows in chunks via the batch RPC. Returns total inserted. */
export async function bulkInsertQuestions(
  rows: Record<string, unknown>[],
  chunkSize = 500
): Promise<number> {
  let inserted = 0
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)
    const result = await api.adminBulkInsert(chunk)
    inserted += result.inserted ?? chunk.length
  }
  return inserted
}
