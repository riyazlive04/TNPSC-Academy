import { useEffect, useState } from 'react'
import { Play, Video } from 'lucide-react'
import MaterialViewer from '../Materials/MaterialViewer'
import { api, type Material } from '../../lib/api'
import { youtubeThumb, materialTitle } from '../../lib/materials'
import { useT } from '../../lib/i18n'

/**
 * The "Video Lessons" block on the Profile screen — the videos a superadmin
 * assigned placement='profile'. The whole section is HIDDEN until at least one
 * such video exists (no placeholder, no skeleton): it appears only once videos
 * are added. Tapping a video opens the shared in-app player.
 */
export default function ProfileVideos() {
  const { t, lang } = useT()
  // null = still loading; [] = loaded but empty. Either way the section is hidden.
  const [videos, setVideos] = useState<Material[] | null>(null)
  const [active, setActive] = useState<Material | null>(null)

  useEffect(() => {
    let cancelled = false
    api.materials
      .list('profile')
      .then((v) => !cancelled && setVideos(v))
      .catch(() => !cancelled && setVideos([]))
    return () => {
      cancelled = true
    }
  }, [])

  // Show nothing until there is at least one video to display.
  if (!videos || videos.length === 0) return null

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <Video size={18} className="text-brand" />
        <h2 className="font-heading text-base font-semibold tracking-tight text-ink">{t('videoLessons')}</h2>
      </div>
      <p className="tamil mb-3 font-body text-sm text-ink2">{t('videoLessonsSub')}</p>

      {/* Capped height with a vertical scroll so a long list scrolls within the
          section instead of stretching the Profile page. */}
      <div className="grid max-h-96 grid-cols-2 gap-3 overflow-y-auto overscroll-contain pr-1 sm:grid-cols-3">
        {videos.map((v, i) => (
            <button
              key={v.id}
              onClick={() => setActive(v)}
              style={{ '--i': i } as React.CSSProperties}
              className="card stagger-item interactive group flex flex-col overflow-hidden p-0 text-left"
            >
              <div className="relative aspect-video w-full overflow-hidden bg-tint">
                {v.youtube_id && (
                  <img
                    src={youtubeThumb(v.youtube_id)}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                )}
                <span className="absolute inset-0 grid place-items-center">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-black/55 text-white backdrop-blur-sm transition group-hover:bg-brand">
                    <Play size={18} fill="currentColor" />
                  </span>
                </span>
              </div>
              <span className="tamil line-clamp-2 p-2.5 font-heading text-sm font-semibold leading-snug text-ink">
                {materialTitle(v, lang)}
              </span>
            </button>
          ))}
        </div>

      {active && <MaterialViewer material={active} onClose={() => setActive(null)} />}
    </div>
  )
}
