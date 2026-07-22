// ─── Cross-platform binary download ─────────────────────────────────────────
// The counterpart to savePdf for files we hold as a Blob (e.g. a generated
// .pptx). Same reasoning: an <a download> click works on the web but is silently
// dropped inside the Capacitor WebView, so the native app writes the file to the
// cache and opens the Android share/save sheet instead.

import { Capacitor } from '@capacitor/core'

const isNative = Capacitor.isNativePlatform()

/** Strip anything unsafe for a filename and guarantee the wanted extension. */
export function normalizeFilename(filename: string, ext: string): string {
  const suffix = ext.startsWith('.') ? ext : `.${ext}`
  const base = filename
    .replace(new RegExp(`${suffix.replace('.', '\\.')}$`, 'i'), '')
    .replace(/[^a-z0-9_-]+/gi, '_')
    .slice(0, 80)
  return `${base || 'download'}${suffix}`
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    // readAsDataURL gives `data:<mime>;base64,<payload>` — Filesystem wants only
    // the payload.
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
    reader.onerror = () => reject(new Error('Could not read the generated file.'))
    reader.readAsDataURL(blob)
  })
}

/** Save a generated Blob: browser download on the web, share sheet in the app. */
export async function saveBlob(blob: Blob, filename: string, ext: string): Promise<void> {
  const name = normalizeFilename(filename, ext)

  if (!isNative) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    document.body.appendChild(a)
    a.click()
    a.remove()
    // Revoke on the next tick — revoking synchronously can cancel the download.
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
    return
  }

  const { Filesystem, Directory } = await import('@capacitor/filesystem')
  const { Share } = await import('@capacitor/share')

  const { uri } = await Filesystem.writeFile({
    path: name,
    data: await blobToBase64(blob),
    directory: Directory.Cache,
  })

  try {
    await Share.share({ title: name, files: [uri], dialogTitle: 'Save or share file' })
  } catch {
    // Dismissed share sheet or no target — the file is already in the app cache.
  }
}
