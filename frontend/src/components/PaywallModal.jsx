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
import api from '../lib/api.js'
import toast from 'react-hot-toast'
import { PREMIUM_PRICE_LABEL } from '../lib/pricing.js'
import { useUserEntitlements } from '../hooks/useQueries.js'

const FEATURES = [
  'Unlimited lab uploads and manual entries',
  'Personal action plans after each report',
  'Biomarker trend tracking and progress charts',
  'Longitudinal history across uploads',
  'Follow-up check-ins and retest planning',
  'Exportable summaries for clinician visits',
]

const REASON_MESSAGES = {
  UPLOAD_LIMIT_REACHED: 'Free plan includes 1 analysis total (PDF upload or manual entry). Upgrade for unlimited analyses.',
  BIOMARKER_QUOTA_EXCEEDED: 'Free plan includes 1 analysis total (PDF upload or manual entry). Upgrade to continue.',
  SUBSCRIPTION_REQUIRED: 'This feature is available with Vitaloop Premium.',
}

export default function PaywallModal({ open: controlledOpen, onClose }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState(null)
  const [loading, setLoading] = useState(false)
  const { data: entitlements, isLoading: entitlementsLoading } = useUserEntitlements()

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

  function handleClose() {
    setOpen(false)
    onClose?.()
  }

  async function handleCheckout() {
    setLoading(true)
    try {
      const { data } = await api.post('/stripe/checkout')
      window.location.href = data.checkout_url
    } catch {
      toast.error('Could not start checkout. Please try again.')
      setLoading(false)
    }
  }

  if (!isVisible) return null

  const message = REASON_MESSAGES[reason] ?? 'Unlock unlimited analyses, action plans, and longitudinal tracking.'

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
          <h2 className="text-xl font-bold">Vitaloop Premium</h2>
          <p className="mt-1 text-sm text-emerald-100">{message}</p>
        </div>

        {/* Features list */}
        <div className="px-6 py-5">
          <ul className="space-y-2.5 mb-6">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-2 text-sm text-slate-700">
                <span className="text-emerald-500 font-bold">✓</span>
                {f}
              </li>
            ))}
          </ul>

          <button
            onClick={handleCheckout}
            disabled={loading}
            className="w-full rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold py-3.5 transition"
          >
            {loading ? 'Redirecting to Stripe…' : `Continue — ${PREMIUM_PRICE_LABEL}`}
          </button>
          <p className="mt-2 text-center text-xs text-slate-400">
            Cancel anytime · Secure checkout via Stripe
          </p>
        </div>

        {/* Close */}
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 text-white/70 hover:text-white text-xl leading-none"
          aria-label="Close"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
