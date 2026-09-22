import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useToastStore } from '../store/toastStore'
import { useT, type StringKey } from '../lib/i18n'

/** `?payment=` reason (server lib/paymentRedirect.ts ReturnReason) → message. */
const REASON_KEY: Record<string, StringKey> = {
  failed: 'payErrPay',
  unverified: 'payErrVerify',
  pending: 'payErrPending',
}

/**
 * Says why a redirect-flow payment brought the buyer back to the page they
 * paid from instead of to /payment-success.
 *
 * On iPhones and in-app browsers Razorpay Checkout leaves our page to pay
 * (see redirectCallbackUrl in lib/razorpay.ts), so the in-page failure toast
 * the purchase hooks show never gets a chance to run. The server's callback
 * sends a `?payment=<reason>` flag back instead; this shows it once and strips
 * it, so a reload or a shared link doesn't repeat it. Mounted once at the app
 * root because the flag can land on any page that sells a plan.
 */
export default function PaymentReturnNotice() {
  const location = useLocation()
  const navigate = useNavigate()
  const { t } = useT()

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const key = REASON_KEY[params.get('payment') ?? '']
    if (!key) return
    // The pending message carries the support address, so it stays up long
    // enough to be read and copied.
    useToastStore.getState().push('error', t(key), key === 'payErrPending' ? 12000 : 5000)
    params.delete('payment')
    const search = params.toString()
    navigate(
      { pathname: location.pathname, search: search ? `?${search}` : '', hash: location.hash },
      { replace: true, state: location.state }
    )
    // Keyed on the query alone: it runs when a flag arrives, and the replace
    // above removes the flag, so it cannot fire twice for one return.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search])

  return null
}
