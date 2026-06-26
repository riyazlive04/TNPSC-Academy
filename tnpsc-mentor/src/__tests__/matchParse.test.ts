import { describe, expect, it } from 'vitest'
import { parseMatchQuestion, formatMatchLabel } from '../types'

describe('parseMatchQuestion', () => {
  it('parses the classic List I (letters) / List II (numbers) layout', () => {
    const p = parseMatchQuestion(
      'Match the following:\nList I\n(a) Maltose\n(b) Fructose\n(c) Cellulose\n(d) Starch\nList II\n1. Disaccharide\n2. Hexose\n3. Structural polysaccharide\n4. Storage polysaccharide',
    )
    expect(p).not.toBeNull()
    expect(p!.listI.items.map((i) => i.label)).toEqual(['a', 'b', 'c', 'd'])
    expect(p!.listII.items.map((i) => i.label)).toEqual(['1', '2', '3', '4'])
  })

  it('parses an asymmetric layout (List I has 4, List II has 2 options)', () => {
    const p = parseMatchQuestion(
      'Match the features:\nList I\n(A) Seventh Schedule\n(B) Independent Judiciary\n(C) Single Constitution\n(D) Dual citizenship\n\nList II\n(1) Feature (F)\n(2) Not a Feature (NF)',
    )
    expect(p).not.toBeNull()
    expect(p!.listI.items).toHaveLength(4)
    expect(p!.listII.items).toHaveLength(2)
  })

  it('parses the reversed convention: List I numbers, List II (p)-(s) letters', () => {
    const p = parseMatchQuestion(
      'Match the housing schemes:\nList I\n(1) Indira Awas Yojana\n(2) PMGSY\n(3) Ambedkar Awas Yojana\nList II\n(p) Free dwelling units\n(q) Road connectivity\n(r) Housing assistance',
    )
    expect(p).not.toBeNull()
    expect(p!.listI.items.map((i) => i.label)).toEqual(['1', '2', '3'])
    expect(p!.listII.items.map((i) => i.label)).toEqual(['p', 'q', 'r'])
  })

  it('parses inline items on the "List I:" / "List II:" header line', () => {
    const p = parseMatchQuestion(
      'Match List I with List II:\nList I: (A) Maltose  (B) Fructose  (C) Cellulose  (D) Starch\nList II: (1) Storage  (2) Disaccharide  (3) Structural  (4) Hexose',
    )
    expect(p).not.toBeNull()
    expect(p!.listI.items).toHaveLength(4)
    expect(p!.listII.items).toHaveLength(4)
    expect(p!.listI.items[0].text).toBe('Maltose')
  })

  it('parses single-space inline parenthesised items', () => {
    const p = parseMatchQuestion(
      'Match the wind belts:\nList I: (a) Doldrums (b) Trade winds (c) Westerlies (d) Polar Easterlies\nList II: 1. Mid-latitudes  2. Near the equator  3. Polar regions  4. Tropics',
    )
    expect(p).not.toBeNull()
    expect(p!.listI.items.map((i) => i.text)).toEqual([
      'Doldrums',
      'Trade winds',
      'Westerlies',
      'Polar Easterlies',
    ])
  })

  it('parses "Column A" / "Column B" headers', () => {
    const p = parseMatchQuestion(
      'Match the apps:\nColumn A:\n1. SATHEE App\n2. BHAVYA\n3. DRAP\nColumn B:\na. Education ministry\nb. Swachh Bharat\nc. NICDC',
    )
    expect(p).not.toBeNull()
    expect(p!.listI.header).toMatch(/Column A/)
    expect(p!.listII.header).toMatch(/Column B/)
    expect(p!.listI.items).toHaveLength(3)
  })

  it('parses Tamil column words (நிரல் / பத்தி)', () => {
    const p = parseMatchQuestion(
      'பொருத்துக:\nநிரல் I:\n1. வணிகம்\n2. வணிகர்\n3. நுகர்வோர்\nநிரல் II:\na. வாங்குபவர்\nb. செயல்\nc. விற்பவர்',
    )
    expect(p).not.toBeNull()
    expect(p!.listI.items).toHaveLength(3)
    expect(p!.listII.items).toHaveLength(3)
  })

  it('parses the side-by-side reversed layout "1. Scheme - a. Purpose"', () => {
    const p = parseMatchQuestion(
      'Match the schemes with their purpose:\n1. Thayumanavar Scheme - a. Cyber safety for girls\n2. Agal Vilakku - b. Medical camps\n3. Verkalai Thedi - c. Doorstep ration',
    )
    expect(p).not.toBeNull()
    expect(p!.listI.items.map((i) => i.label)).toEqual(['1', '2', '3'])
    expect(p!.listII.items.map((i) => i.label)).toEqual(['a', 'b', 'c'])
  })

  it('does not split a parenthesised word inside item text', () => {
    const p = parseMatchQuestion(
      "Match:\nList I\n(a) VOC Pillai\n(b) Bharathi\nList II\n1. 'The Tamil who launched (steered) the ship'\n2. Poet",
    )
    expect(p).not.toBeNull()
    expect(p!.listII.items[0].text).toContain('(steered)')
    expect(p!.listII.items).toHaveLength(2)
  })

  it('is not fooled by a preamble that starts with an initial ("V. O. …")', () => {
    const p = parseMatchQuestion(
      'V. O. Chidambaram Pillai is remembered by several honorifics. Match List I with List II:\nList I\n(a) Kappalotiya Tamizhan\n(b) Sekkilutta Semmal\nList II\n1. The Tamil who steered the ship\n2. The noble one',
    )
    expect(p).not.toBeNull()
    expect(p!.listI.items.map((i) => i.label)).toEqual(['a', 'b'])
    expect(p!.preamble).toContain('V. O. Chidambaram')
  })

  it('returns null for non-match questions (no two lists)', () => {
    expect(
      parseMatchQuestion(
        'Arrange the following events in chronological order:\n(a) Champaran Satyagraha\n(b) Kheda Satyagraha\n(c) Ahmedabad Mill Strike\n(d) Non-Cooperation Movement',
      ),
    ).toBeNull()
    expect(parseMatchQuestion('Identify the wrongly matched pair:')).toBeNull()
    expect(parseMatchQuestion('')).toBeNull()
    expect(parseMatchQuestion(null)).toBeNull()
  })

  it('formats labels: numbers as "1.", letters as "(a)"', () => {
    expect(formatMatchLabel('1')).toBe('1.')
    expect(formatMatchLabel('a')).toBe('(a)')
    expect(formatMatchLabel('P')).toBe('(P)')
  })
})
