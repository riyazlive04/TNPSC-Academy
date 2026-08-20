import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, Check, Crown, Trophy, Rocket, ListChecks, Loader2 } from 'lucide-react'
import { usePremiumStore } from '../store/premiumStore'
import { useEntitlementsStore } from '../store/entitlementsStore'
import { useCreditsStore } from '../store/creditsStore'
import { useT, type StringKey } from '../lib/i18n'

/** What the success screen shows per purchased plan (?plan= query param). The
 * perk lists mirror the purchase cards so the recap matches what was pitched. */
const PLAN_META: Record<
  string,
  {
    nameKey: StringKey
    validityKey: StringKey
    perkKeys: readonly StringKey[]
    accent: 'mint' | 'brand' | 'gold' | 'sky'
    /** Which entitlementsStore/premiumStore boolean proves this specific plan
     *  is actually active - see the `confirmed` check below. */
    flag: 'premium' | 'vettri' | 'rankBooster' | 'mockPack'
  }
> = {
  premium: {
    nameKey: 'premiumTitle',
    validityKey: 'premiumValidity',
    perkKeys: [
      'premiumPerk5',
      'premiumPerk7',
      'premiumPerk1',
      'premiumPerk2',
      'premiumPerk3',
      'premiumPerk4',
      'premiumPerk6',
      'premiumBonus1',
      'premiumBonus2',
      'premiumBonus3',
      'premiumBonus4',
    ],
    accent: 'mint',
    flag: 'premium',
  },
  vettri_full: {
    nameKey: 'vettriTitle',
    validityKey: 'vettriValidity',
    perkKeys: ['vettriPerk1', 'vettriBonus1', 'vettriBonus2', 'vettriBonus3'],
    accent: 'brand',
    flag: 'vettri',
  },
  vettri_month: {
    nameKey: 'vettriTitle',
    validityKey: 'vettriMonthValidity',
    perkKeys: ['vettriPerk1', 'vettriBonus1', 'vettriBonus2', 'vettriBonus3'],
    accent: 'brand',
    flag: 'vettri',
  },
  rank_booster_g2: {
    nameKey: 'rankBoosterTitle',
    validityKey: 'rankBoosterValidity',
    perkKeys: [
      'rankBoosterPerk1',
      'rankBoosterBonus1',
      'rankBoosterBonus2',
      'rankBoosterBonus3',
      'rankBoosterBonus4',
      'rankBoosterBonus5',
    ],
    accent: 'gold',
    flag: 'rankBooster',
  },
  group1_mock_pack: {
    nameKey: 'mockPackBannerTitle',
    validityKey: 'mockPackValidity',
    perkKeys: ['mockPackBannerSub', 'mockPackPerk2', 'mockPackPerk3'],
    accent: 'sky',
    flag: 'mockPack',
  },
}

/**
 * Landing screen right after a verified Premium / Vettri Nichayam payment.
 * The purchase cards navigate here the moment the server confirms the payment;
 * mounting it re-pulls every entitlement surface (premium, bundle, credits) so
 * the whole app unlocks instantly - no manual reload needed.
 *
 * The calling card already flips the relevant entitlementsStore/premiumStore
 * boolean optimistically before navigating here, so `confirmed` below is
 * almost always already true on first render; the refresh() calls just
 * reconcile that against the server. Reading the flag live (instead of just
 * trusting the `?plan=` param) means this screen only ever claims success
 * once the store actually agrees - it briefly shows a "confirming" state in
 * the rare case those haven't landed yet, and updates itself automatically
 * the moment they do (no polling needed - the store subscription re-renders
 * this component on its own).
 */
export default function PaymentSuccessPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { t } = useT()
  const plan = PLAN_META[params.get('plan') ?? ''] ?? PLAN_META.premium

  const premium = useEntitlementsStore((s) => s.premium)
  const vettri = useEntitlementsStore((s) => s.vettri)
  const rankBooster = useEntitlementsStore((s) => s.rankBooster)
  const mockPack = useEntitlementsStore((s) => s.mockPack)
  const confirmed =
    plan.flag === 'premium'
      ? premium
      : plan.flag === 'vettri'
        ? vettri
        : plan.flag === 'rankBooster'
          ? rankBooster
          : mockPack

  useEffect(() => {
    void usePremiumStore.getState().refresh()
    void useEntitlementsStore.getState().refresh()
    void useCreditsStore.getState().reload()
  }, [])

  // Confirmation is normally instant (the calling card already set the flag
  // before navigating here); this timeout is only a safety valve so a slow
  // network never traps someone on the spinner forever - after it, fall back
  // to trusting the verified navigation itself, same as before this change.
  const [waited, setWaited] = useState(false)
  useEffect(() => {
    const id = setTimeout(() => setWaited(true), 8000)
    return () => clearTimeout(id)
  }, [])

  if (!confirmed && !waited) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-canvas bg-brand-radial px-4 py-10">
        <div className="flex flex-col items-center gap-4 text-center">
          <Loader2 size={32} className="animate-spin text-brand" />
          <p className="tamil max-w-xs font-body text-sm text-ink2">{t('paySuccessConfirming')}</p>
        </div>
      </div>
    )
  }

  const Icon =
    plan.accent === 'mint' ? Crown : plan.accent === 'gold' ? Rocket : plan.accent === 'sky' ? ListChecks : Trophy
  const chipTone =
    plan.accent === 'mint'
      ? 'bg-mintsoft text-mint'
      : plan.accent === 'gold'
        ? 'bg-goldsoft text-gold'
        : plan.accent === 'sky'
          ? 'bg-tint-blue text-sky'
          : 'bg-brand-soft text-brand'
  const tickTone =
    plan.accent === 'mint'
      ? 'text-mint'
      : plan.accent === 'gold'
        ? 'text-gold'
        : plan.accent === 'sky'
          ? 'text-sky'
          : 'text-brand'

  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas bg-brand-radial px-4 py-10">
      <div className="w-full max-w-md animate-slideUp text-center">
        {/* Big animated tick - restrained celebration, matching RewardOverlay. */}
        <span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-mint text-white shadow-mint">
          <Check size={38} strokeWidth={3} className="animate-checkPop" />
        </span>

        <h1 className="tamil mt-6 font-display text-2xl font-bold tracking-tight text-ink">
          {t('paySuccessTitle')}
        </h1>
        <p className="tamil mx-auto mt-2 max-w-sm font-body text-sm leading-relaxed text-ink2">
          {t('paySuccessSub')}
        </p>

        {/* Plan recap */}
        <div className="mt-7 rounded-card border border-line bg-card p-5 text-left shadow-card">
          <p className="tamil font-heading text-2xs font-bold uppercase tracking-widest text-ink2">
            {t('paySuccessPlanLabel')}
          </p>
          <div className="mt-2.5 flex items-center gap-3">
            <span className={`grid h-11 w-11 flex-shrink-0 place-items-center rounded-2xl ${chipTone}`}>
              <Icon size={20} />
            </span>
            <div className="min-w-0">
              <p className="tamil font-display text-base font-bold tracking-tight text-ink">
                {t(plan.nameKey)}
              </p>
              <p className="tamil mt-0.5 font-body text-xs text-ink2">{t(plan.validityKey)}</p>
            </div>
          </div>

          <div className="my-4 border-t border-dashed border-line" />

          <p className="tamil font-heading text-2xs font-bold uppercase tracking-widest text-ink2">
            {t('paySuccessUnlocked')}
          </p>
          <ul className="mt-2.5 space-y-1.5">
            {plan.perkKeys.map((k) => (
              <li key={k} className="flex items-start gap-2 font-body text-sm text-ink2">
                <Check size={15} className={`mt-0.5 flex-shrink-0 ${tickTone}`} />
                <span className="tamil">{t(k)}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* replace:true keeps Back from bouncing through the success screen. */}
        <div className="mt-6 flex flex-col gap-2.5">
          <button
            onClick={() => navigate('/test-arena', { replace: true })}
            className="btn-brand w-full px-6 py-3 text-sm"
          >
            {t('paySuccessStart')} <ArrowRight size={16} />
          </button>
          <button
            onClick={() => navigate('/profile', { replace: true })}
            className="btn-ghost w-full px-6 py-3 text-sm"
          >
            {t('paySuccessProfile')}
          </button>
        </div>
      </div>
    </div>
  )
}
