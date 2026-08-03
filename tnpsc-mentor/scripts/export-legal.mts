// ─── legal/*.md ← src/lib/legalContent.ts ───────────────────────────────────
// Regenerates the markdown pack from the SAME content the site publishes, so the
// document handed to a payment provider or an advocate can no longer say
// something different from the page a user actually reads. That divergence is
// exactly what happened before: a thorough pair of drafts sat unpublished in
// legal/ while a thinner version was live.
//
//   npm run legal:export
//
// legal/md2docx.py then converts these to .docx as before.

import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  COMPANY,
  EFFECTIVE,
  LEGAL_DOCS,
  outstandingCompanyFacts,
  show,
} from '../src/lib/legalContent.js'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = join(here, '..', 'legal')

const FILENAMES: Record<string, string> = {
  privacy: 'PRIVACY_POLICY.md',
  guidelines: 'TERMS_AND_CONDITIONS.md',
  payment: 'PAYMENT_POLICY.md',
  refund: 'REFUND_AND_CANCELLATION_POLICY.md',
  'delete-account': 'ACCOUNT_DELETION.md',
}

mkdirSync(outDir, { recursive: true })

for (const [slug, doc] of Object.entries(LEGAL_DOCS)) {
  const effective = EFFECTIVE[slug as keyof typeof EFFECTIVE] ?? ''
  const lines: string[] = [
    `<!-- GENERATED FILE — DO NOT EDIT.`,
    `     Source: src/lib/legalContent.ts · Regenerate: npm run legal:export -->`,
    '',
    `# ${doc.title} — ${COMPANY.tradeName}`,
    '',
    `**Effective:** ${effective}`,
    '',
    `**Operator:** ${show(COMPANY.legalName, COMPANY.operator)}, trading as ${COMPANY.tradeName}`,
    `**Registered address:** ${show(COMPANY.address)}`,
    `**Contact:** ${COMPANY.supportEmail} · ${COMPANY.supportPhone}`,
    '',
    '---',
    '',
    doc.intro,
    '',
  ]

  for (const b of doc.blocks) {
    lines.push(`## ${b.h}`, '')
    for (const p of b.p ?? []) lines.push(p, '')
    for (const item of b.list ?? []) lines.push(`- ${item}`)
    if (b.list?.length) lines.push('')
  }

  lines.push(
    '---',
    '',
    `© ${new Date(effective).getFullYear() || 2026} ${COMPANY.tradeName}. An independent preparation ` +
      'product — not affiliated with, endorsed by, or connected to the Tamil Nadu Public Service Commission.',
    ''
  )

  const file = join(outDir, FILENAMES[slug] ?? `${slug.toUpperCase()}.md`)
  writeFileSync(file, lines.join('\n'), 'utf8')
  console.log(`wrote ${file}`)
}

const outstanding = outstandingCompanyFacts()
if (outstanding.length) {
  console.warn(`\n⚠  ${outstanding.length} fact(s) still outstanding — these documents are NOT ready to file:`)
  for (const f of outstanding) console.warn(`   · ${f}`)
  console.warn('\n   Fill them in src/lib/legalContent.ts → COMPANY. See docs/LEGAL_HANDOFF.md.')
  // Non-zero so a CI step or a careless `npm run legal:export && send-to-lawyer`
  // cannot silently ship a document full of "to be confirmed".
  process.exit(1)
}
console.log('\nAll company facts supplied. Documents are complete.')
