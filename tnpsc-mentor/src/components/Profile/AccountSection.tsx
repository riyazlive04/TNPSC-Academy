// ─── Account controls (store-mandated) ──────────────────────────────────────
// Two things both stores require of an app that has accounts and sells anything:
//
//  • Restore purchases — Apple expects any app selling through the store to let a
//    buyer recover access on a new device without paying twice. It doubles as the
//    manual retry for a purchase whose server hand-off was interrupted. Native
//    only; on the web, entitlement already follows the account.
//
//  • Delete account — Apple 5.1.1(v) and Google Play's User Data policy both make
//    in-app account deletion mandatory for any app that offers account creation.
//    It must delete the account AND the data, not just deactivate.

import { useState } from 'react'
import { RefreshCw, Trash2, Loader2, AlertTriangle } from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import { useT } from '../../lib/i18n'
import { toast } from '../../store/toastStore'
import { api } from '../../lib/api'
import { useAuth } from '../../hooks/useAuth'
import { finishPendingPurchases } from '../../lib/iap'
import { useEntitlementsStore } from '../../store/entitlementsStore'
import { useCreditsStore } from '../../store/creditsStore'

export default function AccountSection() {
  const { t } = useT()
  const { signOut } = useAuth()
  const isNative = Capacitor.isNativePlatform()

  const refreshEntitlements = useEntitlementsStore((s) => s.refresh)
  const reloadCredits = useCreditsStore((s) => s.reload)

  const [restoring, setRestoring] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)

  const restore = async () => {
    if (restoring) return
    setRestoring(true)
    try {
      // `seen`, not `recorded`: the user asked "do I own this?". A plan the
      // server already knew about is still a successful restore, and answering
      // "nothing to restore" there would read as their purchase being lost.
      const { seen } = await finishPendingPurchases()
      if (seen > 0) {
        refreshEntitlements()
        reloadCredits()
        toast.success(t('restoreFound'))
      } else {
        toast.info(t('restoreNone'))
      }
    } finally {
      setRestoring(false)
    }
  }

  const doDelete = async () => {
    if (deleting) return
    setDeleting(true)
    try {
      await api.deleteAccount()
      // The account is gone server-side; drop every local trace and land on the
      // signed-out shell rather than leaving a dead session in memory.
      toast.success(t('deleteAccountDone'))
      await signOut()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('deleteAccountError'))
      setDeleting(false)
    }
  }

  // Typing the word is a deliberate speed bump: this is irreversible and takes
  // every test result, bookmark and paid entitlement with it.
  const CONFIRM_WORD = t('deleteAccountConfirmWord')
  const canDelete = confirmText.trim().toUpperCase() === CONFIRM_WORD.toUpperCase()

  return (
    <div className="card p-5">
      <h3 className="font-heading text-base font-semibold text-ink">{t('accountTitle')}</h3>
      <p className="tamil mb-4 mt-1 font-body text-sm text-ink2">{t('accountSub')}</p>

      {isNative && (
        <button
          onClick={restore}
          disabled={restoring}
          className="mb-3 flex w-full items-center gap-3 rounded-field border border-line bg-canvas px-3.5 py-3 text-left transition-colors hover:border-brand/40 disabled:opacity-60"
        >
          <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
            {restoring ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <RefreshCw size={16} />
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="tamil block font-display text-sm font-semibold text-ink">
              {t('restorePurchases')}
            </span>
            <span className="tamil block font-body text-xs text-ink2">
              {restoring ? t('restoreRunning') : t('restorePurchasesSub')}
            </span>
          </span>
        </button>
      )}

      {!confirmOpen ? (
        <button
          onClick={() => setConfirmOpen(true)}
          className="flex w-full items-center gap-3 rounded-field border border-line bg-canvas px-3.5 py-3 text-left transition-colors hover:border-coral/50"
        >
          <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg bg-coral/10 text-coral">
            <Trash2 size={16} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="tamil block font-display text-sm font-semibold text-ink">
              {t('deleteAccount')}
            </span>
            <span className="tamil block font-body text-xs text-ink2">
              {t('deleteAccountSub')}
            </span>
          </span>
        </button>
      ) : (
        <div className="rounded-field border border-coral/40 bg-coral/5 p-4">
          <div className="mb-2 flex items-center gap-2">
            <AlertTriangle size={16} className="flex-shrink-0 text-coral" />
            <span className="font-heading text-sm font-semibold text-ink">
              {t('deleteAccountTitle')}
            </span>
          </div>
          <p className="tamil mb-3 font-body text-xs leading-relaxed text-ink2">
            {t('deleteAccountWarning')}
          </p>
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={CONFIRM_WORD}
            spellCheck={false}
            autoCapitalize="characters"
            aria-label={t('deleteAccountConfirmLabel')}
            className="mb-3 w-full rounded-field border border-line bg-canvas px-3 py-2 font-body text-sm text-ink placeholder:text-ink2/50 focus:border-coral/50 focus:outline-none focus:ring-2 focus:ring-coral/20"
          />
          <div className="flex gap-2">
            <button
              onClick={() => {
                setConfirmOpen(false)
                setConfirmText('')
              }}
              disabled={deleting}
              className="flex-1 rounded-pill border border-line bg-card px-4 py-2 font-heading text-sm font-semibold text-ink2 transition-colors hover:text-ink disabled:opacity-60"
            >
              {t('cancel')}
            </button>
            <button
              onClick={doDelete}
              disabled={!canDelete || deleting}
              className="flex flex-1 items-center justify-center gap-2 rounded-pill bg-coral px-4 py-2 font-heading text-sm font-semibold text-white transition-all hover:brightness-105 disabled:opacity-50"
            >
              {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              {t('deleteAccountConfirm')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
