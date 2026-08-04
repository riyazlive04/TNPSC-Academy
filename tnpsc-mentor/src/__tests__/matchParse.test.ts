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

  // Header-less bodies: the paper labels the two lists from ANY family, in
  // either order. Assuming "letters first, then numbers" dropped all of these
  // to a flat paragraph.
  it('parses numbers first, then letters (no list headers)', () => {
    const p = parseMatchQuestion(
      'Match the following:\n1. Bharathiraja\n2. K. Bhagyaraj\n3. Jaspal Rana\n4. Salim Kumar\na. Malayalam actor\nb. Shooting coach\nc. Tamil film director\nd. Screenplay King\nSelect the correct match.',
    )
    expect(p).not.toBeNull()
    expect(p!.listI.items.map((i) => i.label)).toEqual(['1', '2', '3', '4'])
    expect(p!.listII.items.map((i) => i.label)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('parses a roman-numeral second list ((a)-(d) then (i)-(iv))', () => {
    const p = parseMatchQuestion(
      "Match List I with List II and select the correct option:\n(a) Simmond's disease\n(b) Diabetes mellitus\n(c) Cushing's disease\n(d) Myxoedema\n(i) Thyroid gland\n(ii) Adrenal gland\n(iii) Pituitary gland\n(iv) Pancreas",
    )
    expect(p).not.toBeNull()
    expect(p!.listI.items.map((i) => i.label)).toEqual(['a', 'b', 'c', 'd'])
    expect(p!.listII.items.map((i) => i.label)).toEqual(['i', 'ii', 'iii', 'iv'])
  })

  it('parses lists separated by their own prose headers', () => {
    const p = parseMatchQuestion(
      'Match the following :\nTamil Nadu Government Awards\n(a) Tamilthai award\n(b) Kabilar award\n(c) V.O.C. award\nAwarder\n(i) Poet Piraisudan\n(ii) K. Selvan\n(iii) New Mumbai Tamil Sangam',
    )
    expect(p).not.toBeNull()
    expect(p!.listI.header).toBe('Tamil Nadu Government Awards')
    expect(p!.listII.header).toBe('Awarder')
  })

  it('does not turn a fill-in-the-blank + word bank into a match', () => {
    expect(
      parseMatchQuestion(
        "Complete the blanks using the phrasal verbs given in the options :\n1. You'd better ring her ___________ and tell her.\n2. I invited her to drop ___________ any time.\n3. If you can't afford it, you'll have to do ___________ it.\n(a) out\n(b) in\n(c) up",
      ),
    ).toBeNull()
  })

  // "Which pair is wrongly matched?" items arrive already paired, one per line.
  // The paper prints them as two columns, so we lay them out that way too.
  it('parses one-pair-per-line bodies into two columns', () => {
    const p = parseMatchQuestion(
      'Find out Incorrectly paired :\nCommission – Year of Establishment\n(1) NHRC – 1993\n(2) Central Information Commission – 2005\n(3) Central Vigilance Commission – 1963\n(4) Central Bureau of Investigation – 1969',
    )
    expect(p).not.toBeNull()
    expect(p!.listI.header).toBe('Commission')
    expect(p!.listII.header).toBe('Year of Establishment')
    expect(p!.listI.items.map((i) => i.text)).toEqual([
      'NHRC',
      'Central Information Commission',
      'Central Vigilance Commission',
      'Central Bureau of Investigation',
    ])
    // The row is numbered once, on the left - the right column has no label.
    expect(p!.listII.items.map((i) => i.label)).toEqual(['', '', '', ''])
    expect(p!.listII.items[0].text).toBe('1993')
  })

  it('does not split a hyphenated term when pairing lines', () => {
    // "Heart-lung" has no spaces around its hyphen, so it is not a separator;
    // with no spaced separator at all, this is a plain list, not a pair table.
    expect(
      parseMatchQuestion(
        'Which of the following is correctly paired?\n(1) Heart-lung machine\n(2) X-ray tube\n(3) Semi-conductor diode',
      ),
    ).toBeNull()
  })

  it('formats labels: numbers as "1.", letters as "(a)"', () => {
    expect(formatMatchLabel('1')).toBe('1.')
    expect(formatMatchLabel('a')).toBe('(a)')
    expect(formatMatchLabel('P')).toBe('(P)')
  })
})
