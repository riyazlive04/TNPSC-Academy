/**
 * Pack the built `dist/` into a live-update (OTA) bundle zip.
 *
 *   npm run build                       # same build the website gets
 *   node scripts/pack-web-bundle.mjs 2.0.5+w1
 *
 * Prints the file to upload plus its sha256 and size. Upload it in the
 * superadmin console (App → Live updates), which recomputes the checksum
 * server-side — the printed one is for eyeballing that you shipped the file you
 * meant to. See docs/live-updates.md.
 *
 * The zip holds dist's CONTENTS at the archive root (index.html at top level),
 * which is what the updater plugin unpacks over the app's web directory.
 */
import { createHash } from 'node:crypto'
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import JSZip from 'jszip'

const version = (process.argv[2] ?? '').trim()
if (!version) {
  console.error('Usage: node scripts/pack-web-bundle.mjs <bundle-version>   e.g. 2.0.5+w1')
  process.exit(2)
}
if (version === 'builtin') {
  console.error('"builtin" is reserved by the updater plugin for the store build\'s assets.')
  process.exit(2)
}

const root = resolve(process.cwd(), 'dist')
try {
  if (!statSync(root).isDirectory()) throw new Error('not a directory')
} catch {
  console.error(`No dist/ at ${root} — run "npm run build" first.`)
  process.exit(1)
}

/** Every file under dir, recursively, as absolute paths. */
function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name)
    return e.isDirectory() ? walk(p) : [p]
  })
}

const files = walk(root)
if (!files.some((f) => relative(root, f).replace(/\\/g, '/') === 'index.html')) {
  console.error('dist/ has no index.html — that build is incomplete; refusing to pack it.')
  process.exit(1)
}

const zip = new JSZip()
for (const file of files) {
  // Forward slashes: zip entry names are POSIX even when packed on Windows.
  zip.file(relative(root, file).replace(/\\/g, '/'), readFileSync(file))
}

// DEFLATE, fixed dates left to JSZip's default — the checksum is computed from
// the bytes we actually write, so reproducibility across runs isn't required.
const buf = await zip.generateAsync({
  type: 'nodebuffer',
  compression: 'DEFLATE',
  compressionOptions: { level: 9 },
})

const outDir = resolve(process.cwd(), 'dist-bundles')
mkdirSync(outDir, { recursive: true })
const outFile = join(outDir, `tnpsc-web-${version.replace(/[^a-zA-Z0-9.\-_+]/g, '-')}.zip`)
writeFileSync(outFile, buf)

const sha = createHash('sha256').update(buf).digest('hex')
console.log(`bundle:   ${outFile}`)
console.log(`version:  ${version}`)
console.log(`files:    ${files.length}`)
console.log(`size:     ${(buf.length / 1024 / 1024).toFixed(2)} MB`)
console.log(`sha256:   ${sha}`)
