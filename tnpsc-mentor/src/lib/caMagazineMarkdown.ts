// Converters between the magazine's stored markdown (bullet lines with `- `,
// 2-space nesting, `**bold**`) and the HTML shown in the rich-text editor. The
// storage format stays markdown so the student reader (parseBullets/Rich) and
// the VPS pipeline keep working unchanged — only the editor renders it live.
// Browser-only (uses the DOM); imported solely by the admin editor.

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** One inline segment of markdown → HTML (`**bold**` → <strong>), text escaped. */
function inlineToHtml(text: string): string {
  return escapeHtml(text).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
}

/**
 * Markdown → HTML for the editor. Bullet runs become properly nested <ul>/<li>
 * (so contentEditable list editing behaves), non-bullet lines become <p>.
 */
export function markdownToHtml(md: string): string {
  const root = document.createElement('div')
  let uls: (HTMLUListElement | undefined)[] = []
  let lastLi: (HTMLLIElement | undefined)[] = []
  const bulletRe = /^(\s*)-\s+(.*)$/

  for (const raw of (md ?? '').split('\n')) {
    if (!raw.trim()) continue
    const m = raw.match(bulletRe)
    if (m) {
      const depth = Math.min(2, Math.floor(m[1].length / 2))
      if (!uls[depth]) {
        const ul = document.createElement('ul')
        const parentLi = depth > 0 ? lastLi[depth - 1] : undefined
        if (parentLi) parentLi.appendChild(ul)
        else root.appendChild(ul)
        uls[depth] = ul
      }
      const li = document.createElement('li')
      li.innerHTML = inlineToHtml(m[2]) || '<br>'
      uls[depth]!.appendChild(li)
      lastLi[depth] = li
      // Deeper levels reset once we're back at a shallower depth.
      uls = uls.slice(0, depth + 1)
      lastLi = lastLi.slice(0, depth + 1)
    } else {
      const p = document.createElement('p')
      p.innerHTML = inlineToHtml(raw.trim()) || '<br>'
      root.appendChild(p)
      uls = []
      lastLi = []
    }
  }
  return root.innerHTML || '<p><br></p>'
}

function isBold(el: HTMLElement): boolean {
  const fw = el.style?.fontWeight || ''
  if (fw === 'bold' || fw === 'bolder') return true
  const n = parseInt(fw, 10)
  return !Number.isNaN(n) && n >= 600
}

/** Inline content of a node → markdown; nested lists are skipped (handled by the block walker). */
function inlineToMd(node: Node): string {
  let out = ''
  node.childNodes.forEach((n) => {
    if (n.nodeType === Node.TEXT_NODE) {
      out += n.textContent ?? ''
    } else if (n.nodeType === Node.ELEMENT_NODE) {
      const el = n as HTMLElement
      const tag = el.tagName
      if (tag === 'UL' || tag === 'OL') return // nested list — not inline
      if (tag === 'BR') {
        out += ' '
      } else if (tag === 'STRONG' || tag === 'B' || isBold(el)) {
        const inner = inlineToMd(el).trim()
        if (inner) out += `**${inner}**`
      } else {
        out += inlineToMd(el)
      }
    }
  })
  return out
}

/**
 * Editor HTML → markdown. Walks the block structure: <ul>/<li> (with nesting)
 * back into `- ` lines with 2-space indent, paragraphs/plain nodes into lines.
 */
export function htmlToMarkdown(root: HTMLElement): string {
  const lines: string[] = []

  const walkList = (ul: HTMLElement, depth: number) => {
    ul.childNodes.forEach((child) => {
      if (child.nodeType !== Node.ELEMENT_NODE) return
      const li = child as HTMLElement
      if (li.tagName !== 'LI') return
      const text = inlineToMd(li).trim()
      lines.push(`${'  '.repeat(depth)}- ${text}`)
      li.childNodes.forEach((c) => {
        if (c.nodeType === Node.ELEMENT_NODE && (c as HTMLElement).tagName === 'UL') {
          walkList(c as HTMLElement, depth + 1)
        }
      })
    })
  }

  root.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = (node.textContent ?? '').trim()
      if (t) lines.push(t)
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement
      if (el.tagName === 'UL' || el.tagName === 'OL') {
        walkList(el, 0)
      } else {
        const t = inlineToMd(el).trim()
        if (t) lines.push(t)
        // A list nested directly inside a <div>/<p> (some browsers do this).
        el.childNodes.forEach((c) => {
          if (c.nodeType === Node.ELEMENT_NODE && (c as HTMLElement).tagName === 'UL') {
            walkList(c as HTMLElement, 0)
          }
        })
      }
    }
  })

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}
