// ─── Serve a built archive locally, the way nginx will serve it ──────────────
//   node scripts/qbank/serve.mjs [--out qbank-dist] [--port 4178]
//
// Deliberately mimics the live server rather than being a generic static host.
// The archive is a tree of index.html files with no file extensions in any of
// its URLs, so whether it works at all depends entirely on the `try_files`
// behaviour in deploy/nginx-tnpsc.conf:
//
//   try_files $uri $uri/index.html $uri/ /index.html
//
// A dev server that is more forgiving than that would hide exactly the bug
// worth catching — a link that resolves on a laptop and 404s in production.
// So: the same four steps, in the same order, and nothing else.
//
// It also mounts the tree at /questions/ rather than at the root, because that
// is the path every internal link, canonical and sitemap entry is written
// against. Serving it at / would make every one of those links wrong.

import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { resolve, dirname, join, extname, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BASE } from './render.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const argv = process.argv.slice(2)
const argOf = (flag, dflt) => {
  const i = argv.indexOf(flag)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt
}
const OUT = resolve(ROOT, argOf('--out', 'qbank-dist'))
const PORT = Number(argOf('--port', 4178))

if (!existsSync(OUT)) {
  console.error(`Nothing built at ${OUT} — run: node scripts/qbank/build.mjs`)
  process.exit(1)
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
}

const isFile = (p) => existsSync(p) && statSync(p).isFile()

let served = 0
let missing = 0

const server = createServer((req, res) => {
  const url = decodeURIComponent((req.url ?? '/').split('?')[0])

  // Everything outside /questions/ belongs to the React app in production, so
  // there is nothing here to serve it with. Say so plainly instead of 404ing,
  // which would look like a broken archive link when it is not one.
  if (!url.startsWith(`${BASE}/`) && url !== BASE) {
    res.writeHead(url === '/' ? 302 : 404, url === '/' ? { Location: `${BASE}/` } : { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(
      url === '/'
        ? ''
        : `<!doctype html><meta charset=utf-8><body style="font:16px system-ui;padding:40px;max-width:40em">
<h1>Not part of the archive</h1>
<p><code>${url}</code> is served by the React app in production, not by this tree.
Only <code>${BASE}/</code> is built here.</p>
<p><a href="${BASE}/">Go to the archive</a></p>`,
    )
    return
  }

  // Resolve under OUT, refusing anything that climbs out of it.
  const rel = normalize(url.slice(BASE.length)).replace(/^[\\/]+/, '')
  const base = join(OUT, rel)
  if (!base.startsWith(OUT)) {
    res.writeHead(403).end('Forbidden')
    return
  }

  // try_files $uri $uri/index.html $uri/ — in that order.
  const candidates = [base, join(base, 'index.html')]
  const hit = candidates.find(isFile)

  if (!hit) {
    missing++
    console.log(`  404  ${url}`)
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(
      `<!doctype html><meta charset=utf-8><body style="font:16px system-ui;padding:40px;max-width:40em">
<h1>404 — not in the built tree</h1>
<p><code>${url}</code> resolved to no file. In production nginx would fall through to the
React app's <code>/index.html</code> here, so this would render the SPA's not-found page.</p>
<p><a href="${BASE}/">Back to the archive</a></p>`,
    )
    return
  }

  served++
  res.writeHead(200, {
    'Content-Type': TYPES[extname(hit).toLowerCase()] ?? 'application/octet-stream',
    'Cache-Control': 'no-store',
  })
  createReadStream(hit).pipe(res)
})

server.listen(PORT, () => {
  console.log(`\n  Serving ${OUT}`)
  console.log(`  as nginx would, at http://localhost:${PORT}${BASE}/\n`)
  console.log('  Figures and the sign-up buttons point at the live site, so those work.')
  console.log('  Ctrl-C to stop.\n')
})

process.on('SIGINT', () => {
  console.log(`\n  ${served} files served, ${missing} misses.`)
  process.exit(0)
})
