import { useState, type ReactNode } from 'react'

interface AvatarProps {
  /** Photo URL (e.g. the Google profile picture). Null/empty → fallback shown. */
  src?: string | null
  /** Used for the alt text and the default initial fallback. */
  name?: string | null
  /** Sizing + shape + (for the fallback) bg/text classes. Applied to BOTH the
   * <img> and the fallback <span>, so pass one set of classes and it just works.
   * The image adds object-cover on top so it fills the shape without distortion. */
  className?: string
  /** Custom fallback when there's no image (defaults to the name's first letter).
   * Pass an icon here for places that use an icon instead of initials. */
  children?: ReactNode
}

/**
 * Profile avatar that shows the user's photo when available and falls back to an
 * initial (or a supplied icon) otherwise. Also falls back if the image 404s/403s
 * at load time. `referrerPolicy="no-referrer"` keeps Google's lh3 URLs from being
 * rejected for hotlinking.
 */
export default function Avatar({ src, name, className = '', children }: AvatarProps) {
  const [failed, setFailed] = useState(false)
  const initial = (name?.trim()?.charAt(0) || '?').toUpperCase()

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={name ? `${name}'s profile photo` : 'Profile photo'}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={`${className} object-cover`}
      />
    )
  }
  return <span className={className}>{children ?? initial}</span>
}
