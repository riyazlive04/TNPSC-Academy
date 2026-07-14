import type { Profile } from '../types'

/**
 * The personalised diagonal watermark tiled across a downloaded PDF: the
 * downloader's name and phone (falling back to their email handle, then the
 * brand). A shared/leaked sheet stays traceable to whoever generated it.
 *
 * Used by every student-facing PDF export (explanation sheet, CA magazine, CA
 * question sets) so the mark is identical everywhere. Returns '' when there's
 * no profile — callers treat an empty string as "no watermark".
 */
export function pdfWatermark(profile: Profile | null | undefined): string {
  if (!profile) return ''
  const name = (profile.full_name?.trim() || profile.email?.split('@')[0] || 'TNPSC MENTOR').toUpperCase()
  return [name, profile.phone?.trim()].filter(Boolean).join('  ·  ')
}
