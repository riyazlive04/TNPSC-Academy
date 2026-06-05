import { jsPDF } from 'jspdf'
import type { Question, QuizConfig, TestAnswer } from '../types'
import { LETTERS, optionText } from '../types'

interface GeneratePdfParams {
  config: QuizConfig
  questions: Question[]
  answers: Record<string, TestAnswer>
  scorePercentage: number
  correct: number
  total: number
  label: string
}

const NAVY: [number, number, number] = [13, 27, 42] // #0D1B2A
const BLUE: [number, number, number] = [13, 71, 161] // #0D47A1
const GREEN: [number, number, number] = [22, 163, 74]
const RED: [number, number, number] = [220, 38, 38]
const GREY: [number, number, number] = [90, 90, 90]

/**
 * Generates and auto-downloads the explanation report PDF. The caller MUST
 * only invoke this once the 80% PDF-unlock gate has been satisfied.
 */
export function generateExplanationPdf({
  config,
  questions,
  answers,
  scorePercentage,
  correct,
  total,
  label,
}: GeneratePdfParams): void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 40
  const contentW = pageW - margin * 2
  let y = margin

  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - margin - 24) {
      addFooter(doc, pageW, pageH, margin)
      doc.addPage()
      y = margin
    }
  }

  // ── Header band ──
  doc.setFillColor(...BLUE)
  doc.rect(0, 0, pageW, 70, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.text('TNPSC Mentor — Explanation Report', margin, 44)
  y = 92

  // ── Test details ──
  doc.setTextColor(...NAVY)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text(label, margin, y)
  y += 18

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...GREY)
  const date = new Date().toLocaleString()
  doc.text(
    `Category: ${config.category}   |   Date: ${date}   |   Score: ${correct}/${total} (${scorePercentage}%)`,
    margin,
    y
  )
  y += 22
  doc.setDrawColor(220, 220, 220)
  doc.line(margin, y, pageW - margin, y)
  y += 18

  // ── Questions ──
  questions.forEach((q, idx) => {
    const ans = answers[q.id]
    const qLines = doc.splitTextToSize(`${idx + 1}. ${q.question_text}`, contentW)
    ensureSpace(qLines.length * 14 + 90)

    doc.setTextColor(...NAVY)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text(qLines, margin, y)
    y += qLines.length * 14 + 4

    // options
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    LETTERS.forEach((letter) => {
      const isCorrect = q.correct_answer === letter
      const isChosenWrong = ans?.selected_answer === letter && !ans.is_correct
      if (isCorrect) doc.setTextColor(...GREEN)
      else if (isChosenWrong) doc.setTextColor(...RED)
      else doc.setTextColor(...NAVY)

      let suffix = ''
      if (isCorrect) suffix = '   [Correct]'
      else if (isChosenWrong) suffix = '   [Your answer]'

      const optLines = doc.splitTextToSize(
        `${letter}. ${optionText(q, letter)}${suffix}`,
        contentW - 12
      )
      ensureSpace(optLines.length * 12 + 4)
      doc.text(optLines, margin + 12, y)
      y += optLines.length * 12 + 2
    })

    // explanation
    if (q.explanation) {
      y += 4
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(9.5)
      doc.setTextColor(...GREY)
      const expLines = doc.splitTextToSize(`Explanation: ${q.explanation}`, contentW - 8)
      ensureSpace(expLines.length * 12 + 8)
      doc.text(expLines, margin + 4, y)
      y += expLines.length * 12
    }

    y += 14
    doc.setDrawColor(235, 235, 235)
    doc.line(margin, y - 6, pageW - margin, y - 6)
  })

  addFooter(doc, pageW, pageH, margin)

  const safe = label.replace(/[^a-z0-9]+/gi, '_').slice(0, 50)
  doc.save(`TNPSC_Mentor_${safe || 'Report'}.pdf`)
}

function addFooter(doc: jsPDF, pageW: number, pageH: number, margin: number) {
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...GREY)
  const page = doc.getNumberOfPages()
  doc.text(
    '✳ TNPSC MENTOR — Prepare smart. Score high.',
    margin,
    pageH - margin + 8
  )
  doc.text(`Page ${page}`, pageW - margin - 30, pageH - margin + 8)
}
