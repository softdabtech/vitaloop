/**
 * PaywallModal — full-screen modal shown when a 402 PAYMENT_REQUIRED response
 * is received anywhere in the app.
 *
 * Trigger programmatically:
 *   window.dispatchEvent(new CustomEvent('paywall:trigger', { detail: { reason: 'UPLOAD_LIMIT_REACHED' } }))
 *
 * Or mount with explicit `open` prop for page-level use.
 */
import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { PREMIUM_PRICE_LABEL } from '../lib/pricing.js'
import { useUserEntitlements } from '../hooks/useQueries.js'
import { isUkrainianLocale } from '../lib/locale.js'
import { requestPremiumAccess } from '../lib/premiumAccess.js'
import { useAuth } from '../hooks/useAuth.js'
import { gaPaywallImpression } from '../lib/analytics.js'

const COPY = {
  en: {
    title: 'Vitaloop Premium',
    features: [
      'Unlimited lab uploads and manual entries',
      'Personal action plans after each report',
      'Biomarker trend tracking and progress charts',
      'Longitudinal history across uploads',
      'Follow-up check-ins and retest planning',
      'Exportable summaries for clinician visits',
    ],
    reasons: {
      UPLOAD_LIMIT_REACHED: 'Free plan includes 1 analysis total (PDF upload or manual entry). Upgrade for unlimited analyses.',
      BIOMARKER_QUOTA_EXCEEDED: 'Free plan includes 1 analysis total (PDF upload or manual entry). Upgrade to continue.',
      SUBSCRIPTION_REQUIRED: 'This feature is available with Vitaloop Premium.',
    },
    fallback: 'Unlock unlimited analyses, action plans, and longitudinal tracking.',
    accessError: 'Please email info@softdab.tech to activate Premium access.',
    redirecting: 'Preparing email…',
    continue: 'Request access',
    footer: 'Premium access is currently activated manually.',
    close: 'Close',
  },
  uk: {
    title: 'VITALOOP Premium',
    features: [
      'Необмежені завантаження аналізів і ручне введення',
      'Персональний план дій після кожного звіту',
      'Динаміка біомаркерів і графіки прогресу',
      'Історія результатів у часі',
      'Чек-іни, план повторних аналізів і нагадування',
      'Експорт підсумків для консультації з лікарем',
    ],
    reasons: {
      UPLOAD_LIMIT_REACHED: 'Безкоштовний план включає 1 аналіз: PDF, фото або ручне введення. Premium відкриває необмежені аналізи.',
      BIOMARKER_QUOTA_EXCEEDED: 'Безкоштовний план включає 1 аналіз. Перейдіть на Premium, щоб продовжити.',
      SUBSCRIPTION_REQUIRED: 'Ця функція доступна у VITALOOP Premium.',
    },
    fallback: 'Відкрийте необмежені аналізи, плани дій і відстеження динаміки.',
    accessError: 'Напишіть на info@softdab.tech, щоб активувати Premium.',
    redirecting: 'Готуємо лист…',
    continue: 'Запросити доступ',
    footer: 'Premium зараз активується вручну.',
    close: 'Закрити',
  },
}

export default function PaywallModal({ open: controlledOpen, onClose }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState(null)
  const [loading, setLoading] = useState(false)
  const { user } = useAuth()
  const { data: entitlements } = useUserEntitlements()
  const copy = isUkrainianLocale() ? COPY.uk : COPY.en

  // Listen for global paywall events
  useEffect(() => {
    function handleEvent(e) {
      if (entitlements?.is_premium) return
      setReason(e.detail?.reason ?? null)
      setOpen(true)
    }
    window.addEventListener('paywall:trigger', handleEvent)
    return () => window.removeEventListener('paywall:trigger', handleEvent)
  }, [entitlements?.is_premium])

  // Also support controlled usage via `open` prop
  useEffect(() => {
    if (entitlements?.is_premium) {
      setOpen(false)
      return
    }
    if (controlledOpen !== undefined) setOpen(controlledOpen)
  }, [controlledOpen, entitlements?.is_premium])

  const isVisible = (open || controlledOpen) && !entitlements?.is_premium

  // Fire once per actual open (reason changes each time paywall:trigger fires
  // with a new detail, and controlled `open` toggles false->true on reuse) —
  // not on every re-render while the modal stays open.
  useEffect(() => {
    if (isVisible) gaPaywallImpression(reason)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible, reason])

  function handleClose() {
    setOpen(false)
    onClose?.()
  }

  async function handlePremiumRequest() {
    setLoading(true)
    try {
      await requestPremiumAccess({
        userEmail: user?.email,
        source: 'paywall_modal',
        successMessage: copy.accessError,
      })
    } catch {
      toast.error(copy.accessError)
    } finally {
      setLoading(false)
    }
  }

  if (!isVisible) return null

  const message = copy.reasons[reason] ?? copy.fallback

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={handleClose}
    >
      <div
        className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 px-6 pt-8 pb-6 text-white text-center">
          <div className="text-4xl mb-2">✓</div>
          <h2 className="text-xl font-bold">{copy.title}</h2>
          <p className="mt-1 text-sm text-emerald-100">{message}</p>
        </div>

        {/* Features list */}
        <div className="px-6 py-5">
          <ul className="space-y-2.5 mb-6">
            {copy.features.map((f) => (
              <li key={f} className="flex items-center gap-2 text-sm text-slate-700">
                <span className="text-emerald-500 font-bold">✓</span>
                {f}
              </li>
            ))}
          </ul>

          <button
            onClick={handlePremiumRequest}
            disabled={loading}
            className="w-full rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold py-3.5 transition"
          >
            {loading ? copy.redirecting : `${copy.continue} — ${PREMIUM_PRICE_LABEL}`}
          </button>
          <p className="mt-2 text-center text-xs text-slate-400">
            {copy.footer}
          </p>
        </div>

        {/* Close */}
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 text-white/70 hover:text-white text-xl leading-none"
          aria-label={copy.close}
        >
          ✕
        </button>
      </div>
    </div>
  )
}
