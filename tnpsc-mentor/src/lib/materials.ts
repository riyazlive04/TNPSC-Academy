import type { Material, MaterialKind } from './api'

// ─── YouTube URL helpers ─────────────────────────────────────────────────────
/** Thumbnail for a video id (hqdefault always exists for valid public videos). */
export function youtubeThumb(id: string): string {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
}
/**
 * Privacy-friendly embed URL (no-cookie host) for the in-app player. `playsinline=1`
 * keeps playback INSIDE the app on mobile (Capacitor webview) instead of handing
 * off to the fullscreen/native YouTube player; rel/modestbranding trim the chrome.
 */
export function youtubeEmbed(id: string): string {
  return `https://www.youtube-nocookie.com/embed/${id}?playsinline=1&rel=0&modestbranding=1`
}
/** Canonical watch URL (the "Open on YouTube" fallback link). */
export function youtubeWatch(id: string): string {
  return `https://www.youtube.com/watch?v=${id}`
}

// ─── Display helpers ─────────────────────────────────────────────────────────
/** A human label for a material kind (English; the console is admin-facing). */
export function kindLabel(kind: MaterialKind): string {
  switch (kind) {
    case 'video':
      return 'Video'
    case 'image':
      return 'Image'
    case 'pdf':
      return 'PDF'
    default:
      return 'Document'
  }
}

/** Title in the chosen language, falling back to the primary title. */
export function materialTitle(m: Material, lang: 'en' | 'ta' | 'both'): string {
  const ta = m.title_ta?.trim()
  if (lang === 'ta' && ta) return ta
  if (lang === 'both' && ta) return `${m.title} / ${ta}`
  return m.title
}

/** Pretty file size, e.g. "2.4 MB" / "640 KB". */
export function formatFileSize(bytes: number): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
