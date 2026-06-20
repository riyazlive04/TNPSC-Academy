import type { ReactNode } from 'react'
import { Languages, Sun, Moon } from 'lucide-react'
import { useLanguageStore, type Lang } from '../../store/languageStore'
import { useThemeStore } from '../../store/themeStore'
import { useT, type StringKey } from '../../lib/i18n'

interface AuthShellProps {
  /** The form card rendered on the right / center. */
  children: ReactNode
}

const CHIP_KEYS: StringKey[] = ['chipPyq', 'chipSamacheer', 'chipCa', 'chipAptitude']

const LANG_LABEL: Record<Lang, string> = { en: 'EN', ta: 'தமிழ்', both: 'EN+த' }
const LANG_CYCLE: Lang[] = ['en', 'ta', 'both']

/**
 * Shared split-screen auth layout: a violet marketing hero on the left (desktop)
 * and the form panel on the right. Login, Register and Forgot all share this. A
 * language + theme switcher sits top-right (auth screens don't have the app's
 * top bar, so these controls live here).
 */
export default function AuthShell({ children }: AuthShellProps) {
  const { t, lang } = useT()
  const setLang = useLanguageStore((s) => s.setLang)
  const resolvedTheme = useThemeStore((s) => s.resolved)
  const toggleTheme = useThemeStore((s) => s.toggle)

  const cycleLang = () => setLang(LANG_CYCLE[(LANG_CYCLE.indexOf(lang) + 1) % LANG_CYCLE.length])

  return (
    <div className="relative grid min-h-dvh lg:grid-cols-2">
      {/* Language + theme controls (top-right, above both columns) */}
      <div className="pt-safe absolute right-4 top-4 z-20 flex items-center gap-2">
        <button
          onClick={cycleLang}
          aria-label={`${t('language')} (${LANG_LABEL[lang]})`}
          className="tamil inline-flex items-center gap-1.5 rounded-lg border border-line bg-card px-2.5 py-1.5 font-heading text-xs font-semibold text-muted transition-colors hover:border-primary/40 hover:text-primary"
        >
          <Languages size={14} /> {LANG_LABEL[lang]}
        </button>
        <button
          onClick={toggleTheme}
          aria-label={resolvedTheme === 'dark' ? t('lightMode') : t('darkMode')}
          className="grid h-8 w-8 place-items-center rounded-lg border border-line bg-card text-muted transition-colors hover:border-primary/40 hover:text-primary"
        >
          {resolvedTheme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>

      {/* ─── Left: violet marketing hero (desktop only) ───────────────────── */}
      <aside className="relative hidden overflow-hidden bg-brand-gradient p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 bg-hero-grid [background-size:22px_22px] opacity-60" />
        <div className="relative animate-slideDown">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-tile bg-white/15 text-lg font-semibold ring-1 ring-white/20">
              த
            </span>
            <span className="font-heading text-lg font-semibold tracking-tight">TNPSC Mentor</span>
          </div>
        </div>
        <div className="relative max-w-sm animate-slideUp">
          <h2 className="tamil font-heading text-4xl font-bold leading-tight tracking-tight">
            {t('authHeroTitle')}
          </h2>
          <p className="tamil mt-4 font-body text-base text-white/75">{t('authHeroSub')}</p>
          <div className="mt-8 flex flex-wrap gap-2">
            {CHIP_KEYS.map((key, i) => (
              <span
                key={key}
                style={{ '--i': i } as React.CSSProperties}
                className="tamil stagger-item rounded-full bg-white/10 px-3.5 py-1.5 font-heading text-xs font-medium text-white/90 ring-1 ring-white/15"
              >
                {t(key)}
              </span>
            ))}
          </div>
        </div>
        <div className="tamil relative font-body text-xs text-white/60">{t('authFooter')}</div>
      </aside>

      {/* ─── Right: form panel ────────────────────────────────────────────── */}
      <div className="flex min-h-dvh min-w-0 items-center justify-center bg-canvas bg-brand-radial px-4 py-10">
        <div className="w-full min-w-0 max-w-md animate-fadeIn">
          <div className="mb-7 flex flex-col items-center text-center lg:hidden">
            <span className="mb-3 grid h-12 w-12 place-items-center rounded-tile bg-brand-gradient text-xl font-semibold text-white shadow-brand">
              த
            </span>
            <h1 className="font-heading text-2xl font-semibold tracking-tight text-ink">
              TNPSC Mentor
            </h1>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}
