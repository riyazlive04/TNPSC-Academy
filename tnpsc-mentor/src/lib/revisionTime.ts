// Small client-side helpers for the topic-revision study gate. The unlock
// instant (`available_at`) is computed and stored server-side; here we only
// render how long is left until it.

/** Milliseconds until an ISO instant (negative once it has passed). */
export function msUntil(iso: string): number {
  return new Date(iso).getTime() - Date.now()
}

/** Compact countdown like "11h 30m", "2d 4h", or "<1m". Empty once unlocked. */
export function formatDuration(ms: number): string {
  if (ms <= 0) return ''
  const totalMin = Math.ceil(ms / 60_000)
  const d = Math.floor(totalMin / 1440)
  const h = Math.floor((totalMin % 1440) / 60)
  const m = totalMin % 60
  const parts: string[] = []
  if (d) parts.push(`${d}d`)
  if (h) parts.push(`${h}h`)
  if (m && !d) parts.push(`${m}m`) // drop minutes once we're showing days
  return parts.join(' ') || '<1m'
}
