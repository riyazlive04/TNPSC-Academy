import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, Home, ShieldCheck } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useLanguageStore, type Lang } from '../../store/languageStore'
import { useT } from '../../lib/i18n'

interface AppLayoutProps {
  children: ReactNode
  /** Hide the top brand bar (e.g. inside the immersive quiz screen). */
  bare?: boolean
}

/**
 * Shared shell: dark navy background + the "✳ TNPSC MENTOR" brand bar with a
 * Home button, an admin indicator, and Sign Out.
 */
const LANG_LABEL: Record<Lang, string> = { en: 'EN', ta: 'தமிழ்', both: 'EN+த' }
const LANG_CYCLE: Lang[] = ['en', 'ta', 'both']

export default function AppLayout({ children, bare = false }: AppLayoutProps) {
  const navigate = useNavigate()
  const { signOut, profile, isAdmin } = useAuth()
  const { t } = useT()
  const lang = useLanguageStore((s) => s.lang) ?? 'en'
  const setLang = useLanguageStore((s) => s.setLang)

  const cycleLang = () => {
    const idx = LANG_CYCLE.indexOf(lang)
    setLang(LANG_CYCLE[(idx + 1) % LANG_CYCLE.length])
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-primary">
      {!bare && (
        <header className="sticky top-0 z-30 border-b border-white/10 bg-primary/95 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
            <button
              onClick={() => navigate('/test-arena')}
              className="flex items-center gap-2 font-heading text-xl font-bold tracking-wide text-white transition hover:opacity-90"
            >
              <span className="text-warn">✳</span>
              <span>
                TNPSC <span className="text-accent">MENTOR</span>
              </span>
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={cycleLang}
                title="Change language"
                className="tamil rounded-full bg-white/10 px-3 py-1.5 font-heading text-xs font-bold text-white transition hover:bg-white/20"
              >
                {LANG_LABEL[lang]}
              </button>
              {isAdmin && (
                <span className="hidden items-center gap-1 rounded-full bg-accent px-3 py-1.5 font-heading text-xs font-bold uppercase text-navytext sm:inline-flex">
                  <ShieldCheck size={14} /> {t('admin')}
                </span>
              )}
              {profile?.full_name && (
                <span className="hidden max-w-[140px] truncate font-body text-sm text-white/70 sm:inline">
                  {profile.full_name}
                </span>
              )}
              <button
                onClick={() => navigate('/test-arena')}
                title="Home"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
              >
                <Home size={18} />
              </button>
              <button
                onClick={handleSignOut}
                title="Sign out"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-warn"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </header>
      )}
      <main>{children}</main>
    </div>
  )
}
