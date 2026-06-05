import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Globe } from 'lucide-react'
import { useLanguageStore, type Lang } from '../store/languageStore'
import { useT } from '../lib/i18n'

interface Opt {
  id: Lang
  flag: string
  titleKey: 'langEnglish' | 'langTamil' | 'langBoth'
  descKey: 'langEnglishDesc' | 'langTamilDesc' | 'langBothDesc'
}

const OPTS: Opt[] = [
  { id: 'en', flag: '🇬🇧', titleKey: 'langEnglish', descKey: 'langEnglishDesc' },
  { id: 'ta', flag: '🇮🇳', titleKey: 'langTamil', descKey: 'langTamilDesc' },
  { id: 'both', flag: '🌐', titleKey: 'langBoth', descKey: 'langBothDesc' },
]

export default function LanguageScreen() {
  const navigate = useNavigate()
  const setLang = useLanguageStore((s) => s.setLang)
  const current = useLanguageStore((s) => s.lang)
  const { t } = useT()
  const [selected, setSelected] = useState<Lang | null>(current)

  const proceed = () => {
    if (!selected) return
    setLang(selected)
    navigate('/test-arena', { replace: true })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-primary px-4 py-10">
      <div className="w-full max-w-md animate-fadeIn">
        <div className="mb-8 text-center">
          <h1 className="font-heading text-3xl font-bold tracking-wide text-white">
            <span className="text-warn">✳</span> TNPSC{' '}
            <span className="text-accent">MENTOR</span>
          </h1>
        </div>

        <div className="rounded-3xl bg-secondary/40 p-6 shadow-card backdrop-blur sm:p-8">
          <div className="mb-6 flex flex-col items-center gap-2 text-center">
            <Globe size={32} className="text-accent" />
            <h2 className="font-heading text-2xl font-bold uppercase tracking-wide text-white">
              {t('chooseLanguage')}
            </h2>
            <p className="font-body text-sm text-white/60">{t('languageHint')}</p>
          </div>

          <div className="mb-6 flex flex-col gap-3">
            {OPTS.map((o) => {
              const active = selected === o.id
              return (
                <button
                  key={o.id}
                  onClick={() => setSelected(o.id)}
                  className={[
                    'flex items-center gap-4 rounded-2xl border-2 px-4 py-4 text-left transition-all',
                    active
                      ? 'border-accent bg-accent/20'
                      : 'border-white/10 bg-white/5 hover:border-white/30',
                  ].join(' ')}
                >
                  <span className="text-3xl">{o.flag}</span>
                  <div className="flex-1">
                    <div className="tamil font-heading text-lg font-bold text-white">
                      {t(o.titleKey)}
                    </div>
                    <div className="tamil font-body text-xs text-white/55">
                      {t(o.descKey)}
                    </div>
                  </div>
                  <span
                    className={[
                      'flex h-6 w-6 items-center justify-center rounded-full border-2',
                      active ? 'border-accent bg-accent text-navytext' : 'border-white/30',
                    ].join(' ')}
                  >
                    {active && <Check size={14} />}
                  </span>
                </button>
              )
            })}
          </div>

          <button
            onClick={proceed}
            disabled={!selected}
            className="w-full rounded-full bg-accent px-6 py-3 font-heading text-lg font-bold uppercase tracking-wide text-navytext shadow-pill transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t('continueBtn')} →
          </button>
        </div>
      </div>
    </div>
  )
}
