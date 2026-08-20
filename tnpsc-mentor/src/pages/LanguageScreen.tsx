import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Globe } from 'lucide-react'
import { useLanguageStore, type Lang } from '../store/languageStore'
import { api } from '../lib/api'
import { useT } from '../lib/i18n'
import type { Tint } from '../components/UI/IconTile'

interface Opt {
  id: Lang
  /** Short script badge shown in the tint tile (no emoji - design-system.md). */
  badge: string
  tint: Tint
  titleKey: 'langEnglish' | 'langTamil' | 'langBoth'
  descKey: 'langEnglishDesc' | 'langTamilDesc' | 'langBothDesc'
}

const OPTS: Opt[] = [
  { id: 'en', badge: 'En', tint: 'blue', titleKey: 'langEnglish', descKey: 'langEnglishDesc' },
  { id: 'ta', badge: 'அ', tint: 'violet', titleKey: 'langTamil', descKey: 'langTamilDesc' },
  { id: 'both', badge: '', tint: 'green', titleKey: 'langBoth', descKey: 'langBothDesc' },
]

const TINT_CLS: Record<Tint, string> = {
  violet: 'bg-tint-violet text-primary',
  coral: 'bg-tint-coral text-accent',
  blue: 'bg-tint-blue text-sky',
  green: 'bg-tint-green text-mint',
}

export default function LanguageScreen() {
  const navigate = useNavigate()
  const setLang = useLanguageStore((s) => s.setLang)
  const current = useLanguageStore((s) => s.lang)
  const { t } = useT()
  const [selected, setSelected] = useState<Lang | null>(current)

  const proceed = () => {
    if (!selected) return
    setLang(selected)
    // Persist to the account so the choice follows the user across devices and
    // this screen is never shown again. Best-effort: the local store already
    // drives the UI, and the column may not exist until the migration is run.
    api.updateProfile({ language: selected }).catch(() => {})
    navigate('/test-arena', { replace: true })
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas bg-brand-radial px-4 py-10">
      <div className="w-full max-w-md animate-fadeIn">
        <div className="mb-7 flex flex-col items-center text-center">
          <img src="/logo-mark.png" alt="" className="mb-3 h-16 w-16 object-contain" />
          <h2 className="font-display text-2xl font-bold tracking-tight text-ink">
            {t('chooseLanguage')}
          </h2>
          <p className="tamil mt-1 font-body text-sm text-muted">{t('languageHint')}</p>
        </div>

        <div className="mb-6 flex flex-col gap-3">
          {OPTS.map((o) => {
            const active = selected === o.id
            return (
              <button
                key={o.id}
                onClick={() => setSelected(o.id)}
                aria-pressed={active}
                className={[
                  'flex items-center gap-4 rounded-card border px-4 py-4 text-left transition-colors',
                  active ? 'border-primary bg-selected' : 'border-line bg-card hover:border-primary/40',
                ].join(' ')}
              >
                <span
                  className={`grid h-11 w-11 flex-shrink-0 place-items-center rounded-tile font-display text-lg font-bold ${TINT_CLS[o.tint]}`}
                >
                  {o.badge || <Globe size={20} />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="tamil font-display text-base font-bold text-ink">{t(o.titleKey)}</div>
                  <div className="tamil font-body text-sm text-muted">{t(o.descKey)}</div>
                </div>
                <span
                  className={[
                    'grid h-6 w-6 flex-shrink-0 place-items-center rounded-full border transition-colors',
                    active ? 'border-primary bg-primary text-white' : 'border-line',
                  ].join(' ')}
                >
                  {active && <Check size={14} />}
                </span>
              </button>
            )
          })}
        </div>

        <button onClick={proceed} disabled={!selected} className="btn-brand w-full px-6 py-3.5 text-base">
          {t('continueBtn')} →
        </button>
      </div>
    </div>
  )
}
