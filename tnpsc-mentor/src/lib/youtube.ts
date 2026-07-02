// ─── YouTube URL helpers ─────────────────────────────────────────────────────
// Admins paste a YouTube link on a question's explanation; students watch it
// embedded. We parse the many YouTube URL shapes into a stable video id and build
// a privacy-friendly (youtube-nocookie) embed URL. Anything we can't recognise
// returns null so the UI can skip rendering a broken iframe.

/** Extract the 11-char video id from any common YouTube URL/ID form, else null. */
export function youtubeId(input: string | null | undefined): string | null {
  if (!input) return null
  const raw = input.trim()
  if (!raw) return null

  // Bare id (exactly the 11-char YouTube id charset).
  if (/^[\w-]{11}$/.test(raw)) return raw

  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }

  const host = url.hostname.replace(/^www\./, '').toLowerCase()
  const isYouTube =
    host === 'youtube.com' ||
    host === 'm.youtube.com' ||
    host === 'youtube-nocookie.com' ||
    host === 'youtu.be'
  if (!isYouTube) return null

  // youtu.be/<id>
  if (host === 'youtu.be') {
    const id = url.pathname.slice(1).split('/')[0]
    return /^[\w-]{11}$/.test(id) ? id : null
  }

  // youtube.com/watch?v=<id>
  const v = url.searchParams.get('v')
  if (v && /^[\w-]{11}$/.test(v)) return v

  // /embed/<id>, /shorts/<id>, /live/<id>, /v/<id>
  const m = url.pathname.match(/\/(?:embed|shorts|live|v)\/([\w-]{11})/)
  if (m) return m[1]

  return null
}

/** Build a youtube-nocookie embed URL for a pasted link/id, or null if invalid. */
export function youtubeEmbedUrl(input: string | null | undefined): string | null {
  const id = youtubeId(input)
  return id ? `https://www.youtube-nocookie.com/embed/${id}` : null
}
