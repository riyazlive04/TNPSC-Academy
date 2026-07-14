import type { CaQuestionItem } from './api'
import type { Question, DisplayLang } from '../types'
import { generateExplanationPdf } from './explanationPdf'

/**
 * "Download PDF" for a CA-questions set (a daily drop or a monthly bank). Maps
 * the stored MCQ rows onto the app's `Question` shape and reuses the existing
 * explanation-sheet generator (bilingual, Tamil-safe HTML→canvas→jsPDF). Lazy-
 * loaded on demand so jspdf/html2canvas stay out of the console's main chunk.
 */

/** One stored MCQ row → the Question shape the PDF generator consumes. */
function toQuestion(item: CaQuestionItem): Question {
  return {
    id: String(item.id ?? item.external_id),
    category: 'current_affairs' as Question['category'],
    topic: item.topic,
    question_type: item.question_type,
    difficulty: item.difficulty as Question['difficulty'],
    question_text: item.question_text,
    option_a: item.option_a,
    option_b: item.option_b,
    option_c: item.option_c,
    option_d: item.option_d,
    // The generator highlights the correct option by matching UPPERCASE letters.
    correct_answer: (item.correct_answer?.toUpperCase() as Question['correct_answer']) || undefined,
    explanation: item.explanation,
    why_wrong: (item.why_wrong as Question['why_wrong']) ?? null,
    question_text_ta: item.question_text_ta,
    option_a_ta: item.option_a_ta,
    option_b_ta: item.option_b_ta,
    option_c_ta: item.option_c_ta,
    option_d_ta: item.option_d_ta,
    explanation_ta: item.explanation_ta,
  }
}

export async function generateCaQuestionsPdf(opts: {
  items: CaQuestionItem[]
  /** Big heading, e.g. "Daily Current Affairs". */
  title: string
  /** Sub-title, e.g. "9 July 2026" or "July 2026". */
  label: string
  lang: DisplayLang
  /** Personalised watermark for student downloads (see pdfWatermark). */
  watermark?: string
}): Promise<void> {
  await generateExplanationPdf({
    questions: opts.items.map(toQuestion),
    title: opts.title,
    label: opts.label,
    lang: opts.lang,
    watermark: opts.watermark,
  })
}
