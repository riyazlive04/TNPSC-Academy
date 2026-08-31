// ─── Browser-side image downscaling ──────────────────────────────────────────
// Thumbnails are picked from a phone camera roll or a news site, so the file a
// superadmin chooses is routinely a 2–3 MB full-resolution PNG. It is then shown
// in a 160px-wide card — and, because every reader downloads it from Supabase
// Storage, an oversized thumbnail is paid for again on every visit by every
// student. Shrinking it here, before it ever reaches Storage, is the cheapest
// possible fix: one resize at upload time, forever after.
//
// Everything happens on a canvas in the browser — no dependency, no server work,
// and the original file on the admin's disk is untouched.

/** Long-edge cap. Cards are ~160px and the reader's header image ~2x that, so
 *  this still leaves room for a retina display and for future, larger layouts. */
export const THUMB_MAX_PX = 800
/** WebP quality. 0.82 is visually indistinguishable at these sizes and lands a
 *  typical news photo at 40–80 KB. */
export const THUMB_QUALITY = 0.82

/** Decode a file into an <img>, or reject if the browser can't read it. */
function decode(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('That file could not be read as an image.'))
    }
    img.src = url
  })
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

/**
 * Downscale `file` so its longest edge is at most `maxPx`, re-encoded as WebP
 * (JPEG on a browser that won't emit WebP).
 *
 * Deliberately forgiving: anything that goes wrong — an undecodable file, a
 * canvas that won't export, a "shrunk" result that came out bigger than the
 * original — returns the ORIGINAL file. A thumbnail upload should never fail
 * because the optimisation failed; the server's own size cap is the backstop.
 */
export async function downscaleImage(
  file: File,
  maxPx: number = THUMB_MAX_PX,
  quality: number = THUMB_QUALITY
): Promise<File> {
  try {
    const img = await decode(file)
    const { naturalWidth: w, naturalHeight: h } = img
    if (!w || !h) return file

    // Never upscale: a small source is already as cheap as it gets. It still
    // goes through the re-encode below when it's a PNG, which is where most of
    // the saving on a screenshot-style image comes from.
    const scale = Math.min(1, maxPx / Math.max(w, h))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(w * scale))
    canvas.height = Math.max(1, Math.round(h * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

    // WebP first; a browser that doesn't support it silently hands back a PNG
    // from toBlob, which would defeat the point — so check what we actually got.
    let type = 'image/webp'
    let blob = await toBlob(canvas, type, quality)
    if (!blob || blob.type !== type) {
      type = 'image/jpeg'
      blob = await toBlob(canvas, type, quality)
    }
    if (!blob || blob.size >= file.size) return file

    const base = file.name.replace(/\.[^.]+$/, '') || 'thumbnail'
    const ext = type === 'image/webp' ? 'webp' : 'jpg'
    return new File([blob], `${base}.${ext}`, { type, lastModified: Date.now() })
  } catch {
    return file
  }
}
