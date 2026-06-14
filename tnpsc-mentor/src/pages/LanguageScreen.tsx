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
    <div className="flex min-h-screen items-center justify-center bg-brand-gradient px-4 py-10">
      <div className="w-full max-w-md animate-fadeIn">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="mb-3 grid h-12 w-12 place-items-center rounded-xl bg-white/10 text-xl font-semibold text-white ring-1 ring-white/15">
            த
          </span>
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-white">
            TNPSC Mentor
          </h1>
        </div>

        <div className="rounded-2xl border border-line bg-card p-6 shadow-card sm:p-8">
          <div className="mb-6 flex flex-col items-center gap-2 text-center">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-tint text-ink">
              <Globe size={22} />
            </span>
            <h2 className="font-heading text-xl font-semibold tracking-tight text-ink">
              {t('chooseLanguage')}
            </h2>
            <p className="tamil font-body text-sm text-ink2">{t('languageHint')}</p>
          </div>

          <div className="mb-6 flex flex-col gap-3">
            {OPTS.map((o) => {
              const active = selected === o.id
              return (
                <button
                  key={o.id}
                  onClick={() => setSelected(o.id)}
                  className={[
                    'flex items-center gap-4 rounded-xl border px-4 py-4 text-left transition-all',
                    active
                      ? 'border-ink bg-tint'
                      : 'border-line bg-card hover:border-brand/40',
                  ].join(' ')}
                >
                  <span className="text-3xl">{o.flag}</span>
                  <div className="min-w-0 flex-1">
                    <div className="tamil font-heading text-lg font-bold text-ink">
                      {t(o.titleKey)}
                    </div>
                    <div className="tamil font-body text-xs text-ink2">{t(o.descKey)}</div>
                  </div>
                  <span
                    className={[
                      'grid h-6 w-6 place-items-center rounded-full border',
                      active ? 'border-brand bg-brand text-white' : 'border-line',
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
    </div>
  )
}
