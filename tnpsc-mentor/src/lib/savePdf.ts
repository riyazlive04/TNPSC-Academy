// ─── Cross-platform PDF saving ──────────────────────────────────────────────
// On the web, jsPDF's doc.save() triggers a normal browser download. Inside the
// Capacitor WebView that download is silently dropped (no <a download> handling,
// no file picker), so the user taps "Download" and nothing happens. Here we
// detect the native app and instead write the PDF to the device cache with
// @capacitor/filesystem, then open the Android share/save sheet via
// @capacitor/share so the user can store it or send it on.

import type { jsPDF } from 'jspdf'
import { Capacitor } from '@capacitor/core'

const isNative = Capacitor.isNativePlatform()

/** Strip anything unsafe for a filename and guarantee a .pdf suffix. */
function normalizeName(filename: string): string {
  const base = filename.replace(/\.pdf$/i, '').replace(/[^a-z0-9_-]+/gi, '_').slice(0, 80)
  return `${base || 'document'}.pdf`
}

/**
 * Save a generated jsPDF document. Browser download on the web; native
 * filesystem write + share sheet inside the installed app.
 */
export async function savePdfDoc(doc: jsPDF, filename: string): Promise<void> {
  const name = normalizeName(filename)

  if (!isNative) {
    doc.save(name)
    return
  }

  const { Filesystem, Directory } = await import('@capacitor/filesystem')
  const { Share } = await import('@capacitor/share')

  // jsPDF can emit base64 directly (no data: prefix) - exactly what Filesystem
  // wants for a binary write.
  const base64 = doc.output('datauristring').split(',')[1]

  const { uri } = await Filesystem.writeFile({
    path: name,
    data: base64,
    directory: Directory.Cache,
  })

  try {
    // `files` (not `url`) is the documented way to share an on-device file - the
    // plugin sets up the FileProvider grant so the receiving app can read it.
    await Share.share({
      title: name,
      files: [uri],
      dialogTitle: 'Save or share PDF',
    })
  } catch {
    // User dismissed the share sheet, or no share target. The file is already
    // written to the app cache, so this is not a hard failure.
  }
}
