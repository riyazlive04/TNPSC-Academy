import { Youtube } from 'lucide-react'
import { youtubeEmbedUrl } from '../../lib/youtube'
import { useT } from '../../lib/i18n'

interface YouTubeEmbedProps {
  /** The pasted YouTube URL/id (usually question.explanation_video_url). */
  url?: string | null
  className?: string
}

/**
 * Renders an admin-attached explanation video as an inline, responsive 16:9
 * YouTube player. Uses the privacy-friendly youtube-nocookie host (already
 * whitelisted in the app CSP). Renders nothing when there's no URL or the URL
 * isn't a recognisable YouTube link — so a bad paste never shows a broken frame.
 */
export default function YouTubeEmbed({ url, className = '' }: YouTubeEmbedProps) {
  const { t } = useT()
  const embed = youtubeEmbedUrl(url)
  if (!embed) return null

  return (
    <div className={`mt-3 ${className}`}>
      <p className="mb-1.5 flex items-center gap-1.5 font-heading text-xs font-bold uppercase tracking-wide text-secondary">
        <Youtube size={14} className="text-coral" />
        {t('videoExplanation')}
      </p>
      <div className="aspect-video w-full overflow-hidden rounded-xl border border-line bg-black">
        <iframe
          src={embed}
          title={t('videoExplanation')}
          className="h-full w-full"
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
    </div>
  )
}
