import { readFileSync } from 'node:fs'

const cur1 = JSON.parse(readFileSync('_audit_fix2_current.json', 'utf8'))
const cur2 = JSON.parse(readFileSync('_audit_fix2_extra.json', 'utf8'))
const currentById = new Map([...cur1, ...cur2].map(r => [r.id, r]))

const out = JSON.parse(readFileSync('_audit_fix_output_2.json', 'utf8'))
const input = JSON.parse(readFileSync('_audit_fix_input_2.json', 'utf8'))

console.log('output entries:', out.length, '| input entries:', input.length)

let problems = 0
const seenIds = new Set()

for (const [i, o] of out.entries()) {
  const tag = `[${i}] ${o.id}`
  if (seenIds.has(o.id)) { console.log(tag, 'DUPLICATE ID'); problems++ }
  seenIds.add(o.id)

  const base = currentById.get(o.id)
  if (!base) { console.log(tag, 'NOT FOUND in current DB pull'); problems++; continue }

  if (o.action === 'deactivate') {
    const extraFields = Object.keys(o).filter(k => !['id','action','verification_note'].includes(k))
    if (extraFields.length) { console.log(tag, 'deactivate has extra fields:', extraFields); problems++ }
    continue
  }

  if (o.action !== 'update') { console.log(tag, 'unknown action', o.action); problems++; continue }

  const merged = { ...base, ...o }
  const letter = merged.correct_answer
  if (!letter || !['A','B','C','D'].includes(letter)) {
    console.log(tag, 'invalid correct_answer:', letter); problems++; continue
  }
  const optKey = 'option_' + letter.toLowerCase()
  const optVal = merged[optKey]
  if (optVal === undefined || optVal === null || String(optVal).trim() === '') {
    console.log(tag, `option ${optKey} is empty for correct_answer ${letter}`); problems++
  }

  // explanation should end referencing the same letter, if explanation present in merged
  if (merged.explanation) {
    const m = merged.explanation.match(/Option\s*\(([A-D])\)\s*$/)
    if (!m) {
      console.log(tag, 'explanation does not end with "Option (X)":', JSON.stringify(merged.explanation.slice(-60)))
      problems++
    } else if (m[1] !== letter) {
      console.log(tag, `explanation ends with Option (${m[1]}) but correct_answer is ${letter}`)
      problems++
    }
  }
  if (merged.explanation_ta) {
    const m = merged.explanation_ta.match(/விடை\s*\(([A-D])\)\s*$/)
    if (!m) {
      console.log(tag, 'explanation_ta does not end with "விடை (X)":', JSON.stringify(merged.explanation_ta.slice(-60)))
      problems++
    } else if (m[1] !== letter) {
      console.log(tag, `explanation_ta ends with விடை (${m[1]}) but correct_answer is ${letter}`)
      problems++
    }
  }

  // if only explanation changed but not explanation_ta (or vice versa), flag for manual look (not necessarily an error)
  const changedKeys = Object.keys(o).filter(k => !['id','action','verification_note'].includes(k))
  if (changedKeys.includes('explanation') !== changedKeys.includes('explanation_ta') && base.explanation_ta) {
    console.log(tag, 'NOTE: only one of explanation/explanation_ta changed, but row has both populated ->', changedKeys)
  }
}

console.log('\nTotal problems:', problems)

// Cross-check ids against input, allowing the one known correction
const inputIds = new Set(input.map(x => x.id))
const outputIds = new Set(out.map(x => x.id))
const missingFromOutput = [...inputIds].filter(id => !outputIds.has(id))
const extraInOutput = [...outputIds].filter(id => !inputIds.has(id))
console.log('\ninput ids not present in output (expected: the 1 stale id we corrected):', missingFromOutput)
console.log('output ids not present in input (expected: the 1 corrected real id):', extraInOutput)
