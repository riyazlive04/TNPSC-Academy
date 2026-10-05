/**
 * Which questions have genuinely been asked more than once?
 *
 * TNPSC reuses material across Group 1, 2 and 4, but far less than folklore
 * says: of 5,274 previous-year questions, only ~85 sit in a cluster that spans
 * more than one paper, and the largest cluster is four. That is why the pages
 * show a repeat badge only when there IS a repeat, and show topic frequency —
 * which is large and real — as the everyday "how important is this" signal.
 *
 * Matching is by token overlap rather than exact text, because the same
 * question is retyped between papers with small differences: punctuation, "₹"
 * against "Rs.", a renumbered option list. Exact matching finds 15 groups where
 * near matching finds 38, and spot-checking the extra 23 showed them to be the
 * same question each time.
 */

const WORD = /[^a-z0-9஀-௿]+/g

const norm = (s) => String(s ?? '').toLowerCase().normalize('NFKC').replace(WORD, ' ').trim()
const tokens = (s) => norm(s).split(' ').filter((w) => w.length > 2)

/** Overlap of two token sets, 0..1. */
function jaccard(a, b) {
  let shared = 0
  for (const w of a) if (b.has(w)) shared++
  return shared / (a.size + b.size - shared)
}

/**
 * Group questions that are the same question asked again.
 *
 * @param {object[]} rows questions, each needing `question_text` and an `id`
 * @param {object} [opts]
 * @param {number} [opts.threshold=0.75] token overlap to count as the same
 * @returns {Map<string, object[]>} question id -> its siblings INCLUDING itself,
 *   containing only clusters that span more than one paper
 */
export function findRepeats(rows, { threshold = 0.75 } = {}) {
  // Document frequency, so we can pick each question's rarest words to index
  // on. Indexing on every word would compare every pair sharing "which" — all
  // of them. Indexing on the rarest four makes the comparison set tiny while
  // still catching any pair that shares substantial wording.
  const df = new Map()
  const docs = []
  for (const q of rows) {
    const set = new Set(tokens(q.question_text))
    if (set.size < 5) continue // too short to judge; "Galena is" matches anything
    for (const w of set) df.set(w, (df.get(w) ?? 0) + 1)
    docs.push({ q, set })
  }

  const buckets = new Map()
  for (const d of docs) {
    const rare = [...d.set].sort((a, b) => df.get(a) - df.get(b)).slice(0, 4)
    for (const w of rare) {
      if (!buckets.has(w)) buckets.set(w, [])
      buckets.get(w).push(d)
    }
  }

  // Union-find, so a-b and b-c land in one cluster of three.
  const parent = new Map(docs.map((d) => [d.q.id, d.q.id]))
  const find = (x) => {
    while (parent.get(x) !== x) {
      parent.set(x, parent.get(parent.get(x)))
      x = parent.get(x)
    }
    return x
  }

  const compared = new Set()
  for (const list of buckets.values()) {
    // A bucket this large means the word was not actually rare for this corpus
    // (an option letter, a Tamil particle). Comparing it is O(n^2) for nothing.
    if (list.length > 60) continue
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const key = list[i].q.id < list[j].q.id
          ? `${list[i].q.id}:${list[j].q.id}`
          : `${list[j].q.id}:${list[i].q.id}`
        if (compared.has(key)) continue
        compared.add(key)
        if (jaccard(list[i].set, list[j].set) < threshold) continue
        const a = find(list[i].q.id)
        const b = find(list[j].q.id)
        if (a !== b) parent.set(a, b)
      }
    }
  }

  const clusters = new Map()
  for (const d of docs) {
    const root = find(d.q.id)
    if (!clusters.has(root)) clusters.set(root, [])
    clusters.get(root).push(d.q)
  }

  // A "cluster" of two questions from the SAME paper is a printing artefact or
  // a genuinely duplicated question in that paper, not a repeat across years —
  // saying "also asked in Group 4 2012" when it means the same sitting would be
  // a lie. Only clusters touching two or more papers survive.
  const out = new Map()
  for (const group of clusters.values()) {
    if (group.length < 2) continue
    const papers = new Set(group.map((q) => `${q.category}-${q.year}`))
    if (papers.size < 2) continue
    for (const q of group) out.set(q.id, group)
  }
  return out
}
